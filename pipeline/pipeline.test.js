/**
 * The pipeline is the risky part: a wrong shape gets baked into a bundle and
 * then looks intentional, so it is the part worth testing directly.
 *
 * These tests cover the arithmetic that has no visible failure mode — a
 * quantisation that rounds the wrong way, an arc that loses its endpoints, two
 * chapters that both claim a date. None of those throw. They just quietly make
 * the map wrong.
 */

import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { geoMercator } from 'd3-geo';

import { CHAPTERS, isoToN, isoToYear } from '../src/timeline/chapters.js';
import { BEATS } from '../src/timeline/narration.js';
import { decodeArcs, eachArcIndex, polygonRings, ringArea } from '../src/lib/topojson.js';
import { PANEL_RECTS, createProjectors, fitPanel, fitSheet } from './lib/project.js';
import { MAINLAND, PANEL_REGIONS, regionOf } from './lib/regions.js';
import { quantizeArcs } from './lib/quantize.js';
import { simplifyArc } from './lib/simplify.js';
import { writeJson } from './lib/write.js';

/**
 * The raw record is not committed — see `.gitignore` — so the tests that
 * measure the layout against it can only run where it has been fetched. They
 * are the most valuable tests in this file, so they say so out loud rather than
 * skipping quietly: if the suite reports them as skipped, the layout is
 * unguarded and `npm run data:build` has not been run.
 */
const SOURCE = fileURLToPath(new URL('../data/raw/us.json', import.meta.url));
const hasRecord = existsSync(SOURCE);

describe('quantisation', () => {
  it('survives a round trip within half a grid step', () => {
    const arcs = [
      [
        [0.0, 0.0],
        [0.1234, 0.5678],
        [0.9, 0.1],
        [0.25, 0.75],
      ],
    ];
    const resolution = 1000;
    const { arcs: quantised, transform } = quantizeArcs(arcs, resolution);
    const decoded = decodeArcs({ arcs: quantised, transform });

    expect(decoded[0]).toHaveLength(arcs[0].length);
    for (let i = 0; i < arcs[0].length; i++) {
      expect(decoded[0][i][0]).toBeCloseTo(arcs[0][i][0], 3);
      expect(decoded[0][i][1]).toBeCloseTo(arcs[0][i][1], 3);
      expect(Math.abs(decoded[0][i][0] - arcs[0][i][0])).toBeLessThanOrEqual(transform.scale[0] / 2 + 1e-12);
      expect(Math.abs(decoded[0][i][1] - arcs[0][i][1])).toBeLessThanOrEqual(transform.scale[1] / 2 + 1e-12);
    }
  });

  it('writes a point with no vertical movement as a single number, and reads it back', () => {
    // The one-digit form is legal TopoJSON and is a large share of a real
    // bundle, so a decoder that reads dy as undefined would corrupt rather
    // than throw — every subsequent point in the arc would be NaN.
    const arcs = [
      [
        [0.1, 0.5],
        [0.2, 0.5],
        [0.3, 0.5],
      ],
    ];
    const { arcs: quantised, transform } = quantizeArcs(arcs, 100);
    expect(quantised[0].some((point) => point.length === 1)).toBe(true);

    const decoded = decodeArcs({ arcs: quantised, transform });
    expect(decoded[0].every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(decoded[0][2][0]).toBeCloseTo(0.3, 2);
  });
});

describe('simplification', () => {
  it('keeps both endpoints of every arc, however hard it is pushed', () => {
    // Arc endpoints are the joints between neighbouring arcs. If they could be
    // dropped, two states that share a border would pull apart at the seam.
    const line = Array.from({ length: 50 }, (_, i) => [i / 50, Math.sin(i / 5) * 0.01]);
    for (const tolerance of [0, 1e-9, 1e-4, 1, 100]) {
      const out = simplifyArc(line, tolerance);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(out[0]).toEqual(line[0]);
      expect(out[out.length - 1]).toEqual(line[line.length - 1]);
    }
  });

  it('never moves the line further than the tolerance', () => {
    const line = Array.from({ length: 200 }, (_, i) => [i / 200, Math.sin(i / 3) * 0.005]);
    const tolerance = 1e-4;
    const out = simplifyArc(line, tolerance);
    expect(out.length).toBeLessThan(line.length);
    // Every dropped point is within `tolerance` of the kept polyline. Sampling
    // the kept segments densely is enough to show the bound holds.
    for (const [px, py] of line) {
      let best = Infinity;
      for (let i = 0; i < out.length - 1; i++) {
        const [x0, y0] = out[i];
        const [x1, y1] = out[i + 1];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const span = dx * dx + dy * dy;
        let t = span === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / span;
        t = Math.max(0, Math.min(1, t));
        best = Math.min(best, Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)));
      }
      expect(best).toBeLessThanOrEqual(tolerance + 1e-9);
    }
  });
});

describe('projection and the sheet', () => {
  const project = createProjectors().mainland;

  it('places the lower forty-eight and refuses nothing it is given', () => {
    const seattle = project([-122.33, 47.61]);
    const miami = project([-80.19, 25.76]);
    const maine = project([-69.0, 45.0]);
    for (const point of [seattle, miami, maine]) {
      expect(point).not.toBeNull();
      expect(Number.isFinite(point[0])).toBe(true);
      expect(Number.isFinite(point[1])).toBe(true);
    }
    expect(seattle[0]).toBeLessThan(miami[0]);
    // y runs *downward* here: this is a screen coordinate, not a map coordinate.
    // Everything downstream therefore depends on `fitSheet` flipping it, which
    // the next test pins down.
    expect(seattle[1]).toBeLessThan(miami[1]);
  });

  /**
   * Ground truth for a latitude-longitude cell on a sphere. Its area is
   * proportional to the *difference of sines* of its bounding latitudes, not to
   * cos(latitude) — the cos form is only the local scale factor and is wrong by
   * 30 per cent over a degree-tall cell. Getting this wrong is how an
   * equal-area projection comes to look like it is failing.
   */
  const sphericalCellArea = (lat, dLonDeg, dLatDeg) =>
    ((dLonDeg * Math.PI) / 180) *
    (Math.sin(((lat + dLatDeg) * Math.PI) / 180) - Math.sin((lat * Math.PI) / 180));

  const polygonArea = (corners) => {
    let sum = 0;
    for (let i = 0; i < corners.length; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % corners.length];
      sum += x0 * y1 - x1 * y0;
    }
    return Math.abs(sum / 2);
  };

  const cell = (projection, lat, dLonDeg = 1.4, dLatDeg = 1) =>
    polygonArea(
      [
        [-100, lat],
        [-100 + dLonDeg, lat],
        [-100 + dLonDeg, lat + dLatDeg],
        [-100, lat + dLatDeg],
      ].map(projection),
    );

  it('preserves area, which is the whole reason for choosing it', () => {
    // Two cells of identical angular size, one at 30N and one at 48N. On the
    // globe the northern one is genuinely smaller; an equal-area projection
    // must reproduce that exactly, not exaggerate or flatten it.
    const truth = sphericalCellArea(30, 1.4, 1) / sphericalCellArea(48, 1.4, 1);
    const drawn = cell(project, 30) / cell(project, 48);
    expect(drawn / truth).toBeCloseTo(1, 2);
  });

  it('would not preserve area under Web Mercator, which is why it is not used', () => {
    // The same measurement through the projection we rejected, kept as a test
    // so that the reasoning behind the choice cannot quietly rot. Mercator's
    // area error grows as 1/cos^2(latitude), so the northern cell comes out
    // badly overstated.
    const mercator = geoMercator()
      .scale(6_371_008.8)
      .translate([0, 0]);
    const projectMercator = ([lon, lat]) => mercator([lon, lat]);

    const truth = sphericalCellArea(30, 1.4, 1) / sphericalCellArea(48, 1.4, 1);
    const drawn = cell(projectMercator, 30) / cell(projectMercator, 48);
    expect(drawn / truth).toBeLessThan(0.75);
  });

  it('makes the sheet exactly one unit wide, with y flipped to point up', () => {
    const points = [
      [-125, 25],
      [-66, 25],
      [-125, 50],
      [-66, 50],
      [-96, 38],
    ].map(project);
    const { normalize, sheet } = fitSheet(points);
    expect(sheet.width).toBeCloseTo(1, 10);
    expect(sheet.height).toBeGreaterThan(0);

    const normalized = points.map(normalize);
    const xs = normalized.map((p) => p[0]);
    const ys = normalized.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(0, 10);
    expect(Math.max(...xs)).toBeCloseTo(1, 10);
    // The northern edge is now the *top* of the sheet, so it carries the
    // larger y. This is the flip three.js needs.
    expect(Math.max(...ys)).toBeCloseTo(sheet.height, 10);
    expect(Math.min(...ys)).toBeCloseTo(0, 10);
  });

  it('measures ring area with the correct sign', () => {
    const ccw = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(ringArea(ccw)).toBeGreaterThan(0);
    expect(ringArea([...ccw].reverse())).toBeLessThan(0);
  });
});

describe('regions', () => {
  it('sends the Alaska and Hawaii features to their own panels and everything else to the sheet', () => {
    for (const id of ['ak_dept', 'ak_district', 'ak_terr', 'ak_state']) {
      expect(regionOf(id), id).toBe('alaska');
    }
    for (const id of ['hi_annexation', 'hi_terr', 'hi_state']) {
      expect(regionOf(id), id).toBe('hawaii');
    }
    for (const id of ['wa_state', 'tx_republic', 'dc', 'it_indianterr', 'er_triangleuft', 'or_country', 'mx_cession']) {
      expect(regionOf(id), id).toBe(MAINLAND);
    }
  });

  it('still loses the insets to the mainland projector, which is why routing is by id and not by coordinate', () => {
    // This test guards no function. It exists so the next person cannot read
    // `regions.js` as over-engineering: the lower-48 projection does not fail on
    // Alaska, so a pipeline that decided where to draw a coordinate by looking
    // at the coordinate would ship a plausible-looking wrong answer. Anchorage
    // comes back at y 1.09 and Nome at 1.28 against a sheet 0.776 tall, and
    // Honolulu at x -0.92 against a sheet one unit wide, while Seattle sits at
    // 0.03, 0.62, comfortably inside. Nothing in the pipeline could have
    // noticed, which is exactly what the routing rule is for.
    const mainland = createProjectors().mainland;

    const corners = [
      [-124.7, 48.4], // Cape Flattery
      [-66.9, 44.8], // eastern Maine
      [-80.5, 25.1], // Miami
      [-117.1, 32.5], // San Diego
      [-97.5, 25.8], // the Rio Grande mouth
    ].map(mainland);

    const { normalize, sheet } = fitSheet(corners);

    for (const [lon, lat] of [
      [-149.9, 61.2], // Anchorage
      [-165.4, 64.5], // Nome
      [-157.9, 21.3], // Honolulu
    ]) {
      const point = mainland([lon, lat]);
      expect(point, `${lat}N ${lon}E should project without complaint`).not.toBeNull();
      expect(Number.isFinite(point[0]) && Number.isFinite(point[1])).toBe(true);

      const [x, y] = normalize(point);
      const inside = x >= 0 && x <= sheet.width && y >= 0 && y <= sheet.height;
      expect(inside, `${lon},${lat} normalised to ${x},${y}, which is on the sheet`).toBe(false);
    }

    // And the control, so a sheet that swallowed everything could not pass this.
    const [sx, sy] = normalize(mainland([-122.33, 47.61]));
    expect(sx).toBeGreaterThan(0);
    expect(sx).toBeLessThan(sheet.width);
    expect(sy).toBeGreaterThan(0);
    expect(sy).toBeLessThan(sheet.height);
  });
});

describe('fitting a panel', () => {
  it('fills its rectangle without distorting the shape', () => {
    // A 2:1 shape into a 2:1 rectangle: it should use the whole rectangle.
    const points = [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ];
    const rect = [0, 0, 1, 0.5];
    const drawn = points.map(fitPanel(points, rect).normalize);

    const xs = drawn.map((p) => p[0]);
    const ys = drawn.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 9);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.5, 9);
    expect(Math.min(...xs)).toBeCloseTo(rect[0], 9);
    expect(Math.min(...ys)).toBeCloseTo(rect[1], 9);
  });

  it('keeps a shape inside its rectangle when the two disagree', () => {
    // A tall shape in a wide rectangle. The point is that it shrinks to fit
    // rather than overflowing, and stays centred rather than hugging an edge.
    const points = [
      [0, 0],
      [1, 0],
      [1, 4],
      [0, 4],
    ];
    const rect = [0.1, 0.2, 0.9, 0.5];
    const drawn = points.map(fitPanel(points, rect).normalize);

    for (const [x, y] of drawn) {
      expect(x).toBeGreaterThanOrEqual(rect[0] - 1e-9);
      expect(x).toBeLessThanOrEqual(rect[2] + 1e-9);
      expect(y).toBeGreaterThanOrEqual(rect[1] - 1e-9);
      expect(y).toBeLessThanOrEqual(rect[3] + 1e-9);
    }
    // centred horizontally in the slack it did not use
    const xs = drawn.map((p) => p[0]);
    expect(rect[2] - Math.max(...xs)).toBeCloseTo(Math.min(...xs) - rect[0], 9);
  });

  it('flips y, so north is the top of the rectangle', () => {
    // Projected coordinates are d3's, which are y-down: a northern point has
    // the *smaller* y. The sheet is y-up, so this flip is what stands between a
    // correctly oriented inset and an upside-down Alaska — which, being roughly
    // symmetric about its own middle, is a mistake that could survive review.
    const north = [0, 1];
    const south = [0, 9];
    const rect = [0, 0, 1, 1];
    const { normalize } = fitPanel([north, south], rect);
    expect(normalize(north)[1]).toBeCloseTo(1, 9);
    expect(normalize(south)[1]).toBeCloseTo(0, 9);
  });
});

describe('writing a bundle', () => {
  const tempFile = async (name) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'us-palimpsest-'));
    return path.join(dir, name);
  };

  it('returns what landed on disk, not what was sent', async () => {
    const file = await tempFile('bundle.json');
    const json = JSON.stringify({ chapter: 'industry', geometries: 82 });
    const bytes = await writeJson(file, json);

    expect(bytes).toBe(json.length);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      chapter: 'industry',
      geometries: 82,
    });
  });

  it('refuses to call a truncated document a success', async () => {
    // The exact field symptom that motivated this module. A bundle was written
    // zero bytes long while the build reported `125.5 KB`, and the only evidence
    // was a SyntaxError in a browser console. Cutting a document short has to be
    // a build failure, and the build has to be the thing that says so.
    const file = await tempFile('truncated.json');
    await expect(writeJson(file, '{"objects":{"states":')).rejects.toThrow(/does not parse/);
  });

  it('refuses to call an empty write a success', async () => {
    // The literal version of the incident: a zero-byte file and a green build.
    const file = await tempFile('empty.json');
    await expect(writeJson(file, '')).rejects.toThrow(/does not parse/);
  });
});

describe('the panel layout against the real record', () => {
  const source = hasRecord ? JSON.parse(readFileSync(SOURCE, 'utf8')) : null;

  const regionPoints = (source, projectors, region) => {
    const arcs = decodeArcs(source);
    const points = [];
    for (const geometry of source.objects.states.geometries) {
      if (regionOf(geometry.properties.ID) !== region) continue;
      eachArcIndex(geometry, (i) => {
        for (const point of arcs[i < 0 ? ~i : i]) {
          const projected = projectors[region](point);
          if (projected) points.push(projected);
        }
      });
    }
    return points;
  };

  it.skipIf(!hasRecord)('never lets an arc belong to two regions', () => {
    // The routing in `build.js` reads an arc's region off the geometries that
    // reference it, and a later write silently wins. That is sound only while
    // the regions stay disjoint, which is a property of AHCB's file rather than
    // of this code — so it is checked rather than assumed.
    const owners = new Map();
    for (const geometry of source.objects.states.geometries) {
      const region = regionOf(geometry.properties.ID);
      eachArcIndex(geometry, (i) => {
        const index = i < 0 ? ~i : i;
        if (!owners.has(index)) owners.set(index, new Set());
        owners.get(index).add(region);
      });
    }
    const shared = [...owners.entries()].filter(([, regions]) => regions.size > 1);
    expect(
      shared.map(([index, regions]) => `${index}:${[...regions].join('+')}`),
      'arcs referenced by more than one region',
    ).toEqual([]);
  });

  it.skipIf(!hasRecord)('places every panel inside the sheet', () => {
    const projectors = createProjectors();
    const { sheet } = fitSheet(regionPoints(source, projectors, MAINLAND));
    for (const region of PANEL_REGIONS) {
      const [x0, y0, x1, y1] = PANEL_RECTS[region];
      expect(x0, region).toBeGreaterThanOrEqual(0);
      expect(y0, region).toBeGreaterThanOrEqual(0);
      expect(x1, region).toBeLessThanOrEqual(sheet.width);
      expect(y1, region).toBeLessThanOrEqual(sheet.height);
    }
  });

  it.skipIf(!hasRecord)('draws one shape per panel, however many dated versions the record holds', () => {
    // The measurement behind a claim made in the README and in `chapters.js`:
    // the panels are static plates. AHCB re-registers the same outline under a
    // new political name whenever a territory changes status, so a statehood
    // moves no line at all. Fifteen inset geometries — eight Alaska versions,
    // seven Hawaii versions — collapse onto two shapes.
    //
    // It is a test because the claim is load-bearing. It is the argument for the
    // annotation layer being a milestone rather than garnish: inside a panel, the
    // `CHANGE` field and the label are the only things that can carry history.
    // If a future data swap made the insets move, that argument would become
    // false silently, and prose does not fail a build.
    const arcs = decodeArcs(source);
    const projectors = createProjectors();
    const shapes = new Map();
    const counts = new Map();

    for (const geometry of source.objects.states.geometries) {
      const region = regionOf(geometry.properties.ID);
      if (!PANEL_REGIONS.includes(region)) continue;

      const points = [];
      eachArcIndex(geometry, (i) => {
        for (const point of arcs[i < 0 ? ~i : i]) {
          const projected = projectors[region](point);
          if (projected) points.push(projected);
        }
      });

      // Rounded to the bundle's own precision, so this compares the drawn shape
      // rather than floating-point noise.
      const shape = points.map(([x, y]) => `${x.toFixed(9)},${y.toFixed(9)}`).join(';');
      if (!shapes.has(region)) shapes.set(region, new Set());
      shapes.get(region).add(shape);
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }

    for (const region of PANEL_REGIONS) {
      // Without this the test would pass vacuously if the routing broke and no
      // geometry reached a panel at all.
      expect(counts.get(region) ?? 0, `${region} should have dated versions`).toBeGreaterThan(1);
      expect(shapes.get(region).size, `${region} should draw exactly one shape`).toBe(1);
    }
  });

  it.skipIf(!hasRecord)('keeps every panel rectangle clear of mainland land', () => {
    // The rectangles are the largest that fit in the sheet's south-west ocean,
    // and they were found by scanning the ceiling rather than by eye. This
    // re-derives the answer from the geometry: a polygon-versus-rectangle
    // intersection, exact for the vector data, rather than a sample of vertices.
    // Sampling vertices would not have caught this — most of the mainland's area
    // carries no vertex at all, so a rectangle sitting inside Arizona looks
    // empty. It did, in fact, look empty, until this test was written.
    const projectors = createProjectors();
    const { normalize } = fitSheet(regionPoints(source, projectors, MAINLAND));
    const arcs = decodeArcs(source);

    const crosses = (a, b, c, d) => {
      const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const d1 = side(c, d, a);
      const d2 = side(c, d, b);
      const d3 = side(a, b, c);
      const d4 = side(a, b, d);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    };

    const overlaps = (rings, rect) => {
      const corners = [
        [rect[0], rect[1]],
        [rect[2], rect[1]],
        [rect[2], rect[3]],
        [rect[0], rect[3]],
      ];
      const within = ([x, y]) => x > rect[0] && x < rect[2] && y > rect[1] && y < rect[3];
      for (const ring of rings) {
        for (const point of ring) if (within(point)) return true;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          for (let k = 0; k < 4; k++) {
            if (crosses(a, b, corners[k], corners[(k + 1) % 4])) return true;
          }
        }
      }
      return false;
    };

    for (const region of PANEL_REGIONS) {
      const rect = PANEL_RECTS[region];
      const offenders = [];
      for (const geometry of source.objects.states.geometries) {
        if (regionOf(geometry.properties.ID) !== MAINLAND) continue;
        for (const polygon of polygonRings(geometry, arcs)) {
          const rings = polygon
            .map((ring) =>
              ring
                .map((point) => {
                  const metres = projectors.mainland(point);
                  return metres ? normalize(metres) : null;
                })
                .filter(Boolean),
            )
            .filter((ring) => ring.length >= 3);
          if (rings.length && overlaps(rings, rect)) {
            offenders.push(geometry.properties.ID);
            break;
          }
        }
      }
      expect(offenders, `${region} panel runs into ${offenders.join(', ')}`).toEqual([]);
    }
  });
});

describe('the story places against the real map', () => {
  /**
   * **This is a pin, not a guard.** It asserts a measured fact about content —
   * which of the story's places the drawing actually contains — and it guards
   * no function. Its value is the failure it produces when someone adds a beat:
   * a beat whose place is off the plate is not an error, but it is a decision,
   * and the camera work in M4 will have to treat those places differently. This
   * makes that decision visible at the moment it is made instead of when the
   * camera is written.
   */
  const source = hasRecord ? JSON.parse(readFileSync(SOURCE, 'utf8')) : null;

  it.skipIf(!hasRecord)('has a place on the drawing for four of these beats and none for five', () => {
    const arcs = decodeArcs(source);
    const projectors = createProjectors();

    const pointsIn = (region) => {
      const points = [];
      for (const geometry of source.objects.states.geometries) {
        if (regionOf(geometry.properties.ID) !== region) continue;
        eachArcIndex(geometry, (i) => {
          for (const point of arcs[i < 0 ? ~i : i]) {
            const projected = projectors[region](point);
            if (projected) points.push(projected);
          }
        });
      }
      return points;
    };

    const { normalize: toSheet, sheet } = fitSheet(pointsIn(MAINLAND));
    const panelFits = {};
    for (const region of PANEL_REGIONS) {
      panelFits[region] = fitPanel(pointsIn(region), PANEL_RECTS[region]);
    }

    const onSheet = ([x, y]) => x >= 0 && x <= sheet.width && y >= 0 && y <= sheet.height;
    const inRect = ([x, y], [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

    const where = {};
    for (const [chapterId, beats] of Object.entries(BEATS)) {
      for (const beat of beats) {
        const { lon, lat } = beat.place;
        const found = [];
        const metres = projectors.mainland([lon, lat]);
        // `not null` is not the question. The lower-48 projector returns finite,
        // plausible coordinates for Tokyo — that is the hazard `regions.js`
        // exists for — so the question is whether the result lands on the sheet.
        if (metres && onSheet(toSheet(metres))) found.push('sheet');
        for (const region of PANEL_REGIONS) {
          const projected = projectors[region]([lon, lat]);
          if (projected && inRect(panelFits[region].normalize(projected), PANEL_RECTS[region])) {
            found.push(region);
          }
        }
        where[`${chapterId}/${beat.id}`] = found.join('+') || null;
      }
    }

    // Off the plate entirely. Midway and Iwo Jima are in the Pacific beyond the
    // sheet's west edge at its scale, Normandy past the east edge, and Japan
    // further past it again.
    expect(
      Object.entries(where)
        .filter(([, place]) => place === null)
        .map(([id]) => id),
    ).toEqual([
      'wwii/midway',
      'wwii/d-day',
      'wwii/iwo-jima',
      'wwii/hiroshima',
      'wwii/vj-day',
    ]);

    // Pearl Harbor is the interesting one: it is not on the sheet and it is on
    // the drawing, because the Hawaii panel is where it belongs. A beat can be
    // placed by an inset without the inset knowing anything about beats.
    expect(where['wwii/pearl-harbor']).toBe('hawaii');
    expect(where['wwii/trinity']).toBe('sheet');
    expect(where['wwii/willow-run']).toBe('sheet');
    expect(where['wwii/executive-order-9066']).toBe('sheet');
  });
});

describe('chapter partition', () => {
  it('is contiguous: each chapter opens exactly where the last one closed', () => {
    for (let i = 1; i < CHAPTERS.length; i++) {
      expect(CHAPTERS[i].from).toBe(CHAPTERS[i - 1].to);
      expect(CHAPTERS[i].start).toBeCloseTo(CHAPTERS[i - 1].end, 10);
    }
  });

  it('never lets two chapters claim the same instant', () => {
    for (let i = 0; i < CHAPTERS.length; i++) {
      for (let j = i + 1; j < CHAPTERS.length; j++) {
        const a = CHAPTERS[i];
        const b = CHAPTERS[j];
        const overlaps = a.startN < b.endN && b.startN < a.endN;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('opens Chapter 6 on Pearl Harbor, which is what integer years could not express', () => {
    const wwii = CHAPTERS.find((c) => c.id === 'wwii');
    expect(wwii.from).toBe('1941-12-07');
    // December, so the fractional year is well past the year boundary.
    expect(wwii.start).toBeGreaterThan(1941.9);
  });

  it('converts dates the way AHCB numbers them', () => {
    expect(isoToN('1861-04-12')).toBe(18610412);
    expect(isoToN('1783-09-03')).toBe(17830903);
    expect(isoToN('2000-12-31')).toBe(20001231);
    // 1848 is a leap year: 2 February is day 33 of 366.
    expect(isoToYear('1848-02-02')).toBeCloseTo(1848 + 32 / 366, 6);
  });
});
