/**
 * The pipeline is the risky part: a wrong shape gets baked into a bundle and
 * then looks intentional, so it is the part worth testing directly.
 *
 * These tests cover the arithmetic that has no visible failure mode — a
 * quantisation that rounds the wrong way, an arc that loses its endpoints, two
 * chapters that both claim a date. None of those throw. They just quietly make
 * the map wrong.
 */

import { describe, expect, it } from 'vitest';
import { geoMercator } from 'd3-geo';

import { CHAPTERS, isoToN, isoToYear } from '../src/timeline/chapters.js';
import { decodeArcs, ringArea } from '../src/lib/topojson.js';
import { createProjection, fitSheet } from './lib/project.js';
import { quantizeArcs } from './lib/quantize.js';
import { simplifyArc } from './lib/simplify.js';

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
  const project = createProjection();

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
