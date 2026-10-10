#!/usr/bin/env node
/**
 * The offline pipeline: AHCB -> one TopoJSON bundle per chapter.
 *
 * This is the real work of the project. Everything downstream is drawing; this
 * is where the drawing is made possible, and where a mistake is expensive,
 * because a wrong shape gets baked and then looks intentional.
 *
 * The shape of it:
 *
 *   us.json (interval-coded, lon/lat)
 *     -> decode arcs to absolute coordinates
 *     -> prune to the geometries a chapter's window touches
 *     -> project, each region through its own projection, into the fixed sheet
 *     -> simplify, arc by arc, topology safely
 *     -> quantise back to TopoJSON
 *     -> one bundle per chapter
 *
 * Three rules the whole file obeys:
 *
 * 1. **Decode once, quantise once.** All the cutting happens in absolute
 *    coordinates. If a chapter's geometry were projected or rounded separately
 *    from its neighbour's, shared borders would drift apart and the seam would
 *    be visible on an engraved map.
 * 2. **The sheet, and every panel, is fitted once from the whole record.** The
 *    projections are fixed for the atlas, so what they draw into must be too —
 *    otherwise an anchor would no longer lie exactly beneath the boundary that
 *    succeeds it, and a panel would change size when a chapter's window clipped
 *    one version of its outline. Fitting is a property of the record, not of a
 *    chapter.
 * 3. **A geometry is projected by its own region's projector.** See
 *    `lib/regions.js` for why that is a routing rule and not a filter, and for
 *    what the previous version of it got wrong.
 *
 * Generated bundles are not committed. `npm run data:build` regenerates them.
 */

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS } from '../src/timeline/chapters.js';
import { BEATS } from '../src/timeline/narration.js';
import { decodeArcs } from '../src/lib/topojson.js';
import { eachArcIndex, pruneTopology } from './lib/topology.js';
import { PANEL_RECTS, createProjectors, fitPanel, fitSheet } from './lib/project.js';
import { MAINLAND, PANEL_REGIONS, regionOf } from './lib/regions.js';
import { simplifyArcs } from './lib/simplify.js';
import { quantizeArcs } from './lib/quantize.js';
import { writeJson } from './lib/write.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(ROOT, 'data/raw/us.json');
const OUT_DIR = path.join(ROOT, 'data/chapters');

/**
 * Grid steps across the sheet's longer axis.
 *
 * Set to match the source's own precision rather than to an ideal. AHCB's
 * bundled file is already quantised to roughly 1.2 km; re-quantising it at
 * 46 m adds digits that carry no information and costs about 40 KB a bundle,
 * because the delta between neighbouring points stops fitting in one digit.
 * Quantising finer than the thing you are quantising is not precision, it is
 * payload.
 */
const QUANT_RESOLUTION = Number(process.env.SHEET_RESOLUTION ?? 2_000);

/**
 * Simplification tolerance, in sheet units. The sheet is exactly one unit wide,
 * so this number reads directly as a fraction of the map's width: 4e-4 is
 * 0.56 px with the continent filling a 1400-pixel screen.
 *
 * Chosen from the render budget rather than from taste. Douglas–Peucker
 * guarantees no drawn point sits further than this from the true line, so
 * detail below the pixel grid is detail we would ship and never see. The cost
 * of being wrong in either direction is measured: loosening from 1.5e-4 to
 * 4e-4 takes a chapter from 177 KB to 133 KB (39 KB to 31 KB gzipped) and the
 * difference is invisible at the zoom M0 uses.
 *
 * One tolerance, not one per zoom tier. Per-tier geometry is what the
 * architecture calls for once county polygons arrive; at state level a single
 * tier is honest, and splitting it now would double the file count to buy
 * nothing.
 */
const TOLERANCE = Number(process.env.SHEET_TOLERANCE ?? 4e-4);

/** Fields worth the bytes; the rest of AHCB's forty-column properties are dropped. */
function slimProperties(properties) {
  return {
    id: properties.ID,
    abbr: properties.ABBR_NAME,
    name: properties.NAME_START,
    type: properties.TERR_TYPE,
    area: properties.AREA_SQMI,
    start: properties.START_N,
    end: properties.END_N,
    change: properties.CHANGE,
  };
}

/** Every arc index referenced by a geometry in the given region. */
function regionArcs(topology, region) {
  const indices = new Set();
  for (const geometry of topology.objects.states.geometries) {
    if (regionOf(geometry.properties.ID) !== region) continue;
    eachArcIndex(geometry, (i) => indices.add(i < 0 ? ~i : i));
  }
  return indices;
}

/** Every projected point of a region, in the whole record, as [x, y] metres. */
function regionPoints(topology, arcsAbsolute, project, region) {
  const points = [];
  for (const index of regionArcs(topology, region)) {
    for (const point of arcsAbsolute[index]) {
      const projected = project(point);
      if (projected) points.push(projected);
    }
  }
  return points;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * The authored routes a chapter's beats carry, projected into the sheet.
 *
 * This is the only place the pipeline reads the story layer, and it reads one
 * field of it. `figures` are polylines in real longitude and latitude, written
 * by hand in `timeline/narration.js`; everything else in that file — the titles,
 * the dates people read, the prose — is invisible here. So a chapter nobody has
 * written still builds the same way a written one does, and the story layer
 * cannot become a build dependency of the map.
 *
 * Why a route is allowed to be hand-drawn when a boundary is not: a boundary in
 * this atlas is a claim about a surveyed edge, so it is derived or it is wrong.
 * A route is a claim about a corridor, and the corridors below are traced from
 * published descriptions of the roads and marches they depict. Each carries a
 * `note` saying so, and Chapter 1 depends on them outright — its window contains
 * no state boundary at all, so this is the only thing its plate can draw.
 */
function chapterFigures(chapter, { projectors, toSheet, panelFits }) {
  const out = [];
  for (const beat of BEATS[chapter.id] ?? []) {
    for (const figure of beat.figures ?? []) {
      const region = figure.region ?? MAINLAND;
      const project = projectors[region];
      if (!project) throw new Error(`figure ${figure.id} names an unknown region: ${region}`);
      const place = region === MAINLAND ? toSheet : panelFits[region].normalize;

      out.push({
        figure,
        startN: beat.n,
        points: figure.points.map((point) => {
          const metres = project(point);
          if (!metres) {
            throw new Error(`figure ${figure.id} (${chapter.id}) does not project at ${point}`);
          }
          return place(metres);
        }),
      });
    }
  }
  return out;
}

/**
 * The frame around a panel: a closed rectangle, drawn as one arc.
 *
 * It is a `LineString`, not a `Polygon`, and that is what makes it work with no
 * new machinery anywhere. The fill pass asks `polygonRings` for a geometry's
 * polygons, gets an empty list for a LineString and draws nothing; the outline
 * pass walks `eachArcIndex`, gets the rectangle's five points and draws four
 * segments; and both carry the same date attributes as everything else, so the
 * frame fades in with its panel, disperses into dots with the rest of the
 * chapter, and needs no uniform and no second material.
 *
 * Without it the atlas would be asserting that Alaska is an island in the
 * Pacific, which is a cartographic lie rather than a stylistic choice.
 */
function panelFrame(region, startN) {
  const [x0, y0, x1, y1] = PANEL_RECTS[region];
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

async function main() {
  const started = Date.now();

  const source = JSON.parse(await readFile(SOURCE, 'utf8'));
  const total = source.objects.states.geometries.length;
  const arcsAbsolute = decodeArcs(source);
  const projectors = createProjectors();

  // The last day the record speaks to. Used as the end of a panel frame's
  // validity, because a frame is not a boundary: once the panel exists it is
  // there to the end, and `t` is what says so.
  const recordEndN = Math.max(...source.objects.states.geometries.map((g) => g.properties.END_N));

  // ---- the sheet, fitted once from the mainland alone ---------------------
  const { normalize: toSheet, sheet } = fitSheet(
    regionPoints(source, arcsAbsolute, projectors.mainland, MAINLAND),
  );

  // ---- and each panel, also fitted once from the whole record -------------
  const panelFits = {};
  for (const region of PANEL_REGIONS) {
    const fit = fitPanel(regionPoints(source, arcsAbsolute, projectors[region], region), PANEL_RECTS[region]);
    panelFits[region] = fit;
    // The frame deserves to be there from the day the region's first geometry
    // begins — the purchase, the annexation — not from the day it becomes a
    // state. Derived from the data rather than written down, so it follows.
    fit.debut = Math.min(
      ...source.objects.states.geometries
        .filter((g) => regionOf(g.properties.ID) === region)
        .map((g) => g.properties.START_N),
    );
    fit.againstMainland = fit.scale * sheet.metresWide;
  }

  console.log(`source            ${total} geometries, ${arcsAbsolute.length} arcs`);
  console.log(
    `sheet             ${sheet.width.toFixed(4)} x ${sheet.height.toFixed(4)} ` +
      `(aspect ${(sheet.width / sheet.height).toFixed(4)}, ${(sheet.metresWide / 1000).toFixed(0)} km wide)`,
  );
  for (const region of PANEL_REGIONS) {
    const fit = panelFits[region];
    console.log(
      `panel ${region.padEnd(8)}  rect ${PANEL_RECTS[region].join(', ')}  ` +
        `drawn at ${fit.againstMainland.toFixed(3)} x the lower-48  from ${fit.debut}`,
    );
  }
  console.log('');

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const chapter of CHAPTERS) {
    if (!chapter.built) continue;

    // The last date this chapter can show: its own end, or the record's when the
    // window runs past the data. See the `t` note below.
    const windowEndN = Math.min(chapter.endN, recordEndN);

    // ---- prune to this chapter's window -------------------------------
    // Date only, now. The insets are no longer excluded: they are routed.
    //
    // Half-open on the chapter's end: `START_N < chapter.endN`, not `<=`. A
    // chapter's window is `[from, to)`, which is what `pipeline.test.js` already
    // asserts when it checks that no two chapters claim the same instant — and
    // the inclusive version quietly disagreed with it. Two things were wrong
    // with the inclusive one. A feature dated exactly on a chapter's closing day
    // was drawn in that chapter *and* the next; and Chapter 1, whose window
    // closes on 1783-09-03, swept up all fifteen features that begin on that
    // very day — 457 arcs of boundary that appear at the fade-in rate and reach
    // no opacity before the chapter ends, so a chapter with no visible boundary
    // at all shipped a 42 KB bundle of geometry nobody could ever see.
    const pruned = pruneTopology(
      source,
      arcsAbsolute,
      (geometry) =>
        geometry.properties.START_N < chapter.endN && geometry.properties.END_N >= chapter.startN,
    );

    // Which region each surviving arc belongs to. Read off the geometries that
    // reference it rather than from the source indices, because pruning
    // renumbers arcs. An arc referenced by two regions would be silently won by
    // the last write, which is why `pipeline.test.js` asserts that cannot
    // happen rather than trusting it.
    const arcRegion = new Map();
    for (const geometry of pruned.objects.states.geometries) {
      const region = regionOf(geometry.properties.ID);
      eachArcIndex(geometry, (i) => arcRegion.set(i < 0 ? ~i : i, region));
    }

    // ---- project into sheet space, each region its own way -------------
    const projected = pruned.arcs.map((arc, index) => {
      const region = arcRegion.get(index) ?? MAINLAND;
      const project = projectors[region];
      const place = region === MAINLAND ? toSheet : panelFits[region].normalize;
      return arc.map((point) => {
        const metres = project(point);
        if (!metres) {
          throw new Error(`projection failed inside chapter ${chapter.id} (${region}) at ${point}`);
        }
        return place(metres);
      });
    });

    // ---- simplify, then frame, then quantise ---------------------------
    const { arcs: simplified, before, after } = simplifyArcs(projected, TOLERANCE);

    // The frames go in *after* simplification, so a rectangle cannot be
    // reduced to something that is no longer a rectangle. Simplifying it would
    // usually keep all four corners and occasionally would not, and "usually"
    // is not a property to ship a border on.
    const frames = [];
    let framePoints = 0;
    for (const region of PANEL_REGIONS) {
      if (panelFits[region].debut > chapter.endN) continue; // no such panel yet
      const ring = panelFrame(region, panelFits[region].debut);
      simplified.push(ring);
      framePoints += ring.length;
      frames.push({ arc: simplified.length - 1, region });
    }

    // Story routes go in here too, and for the same reason the frames do: they
    // are authored, they are already as simple as they were written, and
    // Douglas-Peucker would happily straighten a march that took a bend
    // somebody chose on purpose.
    const routes = [];
    let routePoints = 0;
    for (const { figure, points, startN } of chapterFigures(chapter, {
      projectors,
      toSheet,
      panelFits,
    })) {
      if (points.length < 2) continue;
      simplified.push(points);
      routePoints += points.length;
      routes.push({ arc: simplified.length - 1, figure, startN });
    }

    const { arcs, transform } = quantizeArcs(simplified, QUANT_RESOLUTION);

    // Boundary changes whose *start* falls inside the window: the annotation
    // layer, carried here because AHCB's `CHANGE` field is the only record of
    // why a line moved. The insets are included now that they are drawn, and
    // they are the only reason Chapters 4, 5 and 7 have anything to say at all.
    const changes = source.objects.states.geometries
      .filter(
        (g) => g.properties.START_N >= chapter.startN && g.properties.START_N <= chapter.endN,
      )
      .map((g) => ({
        n: g.properties.START_N,
        id: g.properties.ID,
        name: g.properties.NAME_START,
        change: g.properties.CHANGE,
      }))
      .sort((a, b) => a.n - b.n);

    const geometries = pruned.objects.states.geometries.map((g) => ({
      ...g,
      properties: {
        ...slimProperties(g.properties),
        // `t` marks a feature that is still alive when the chapter closes: the
        // chapter's own edge clips it, not history. Without this flag the date
        // mask would fade everything out on the chapter's last day and the map
        // would dissolve into blank paper.
        //
        // `windowEndN` rather than `chapter.endN` because Chapter 8's window
        // runs past the record. "Still alive at the end" has to mean alive on
        // the last date the *record* speaks to; measured against a window that
        // outlives the data, no feature would ever be terminal and that whole
        // plate would dissolve on its last frame.
        t: g.properties.END_N >= windowEndN ? 1 : 0,
      },
    }));

    for (const { arc, region } of frames) {
      geometries.push({
        type: 'LineString',
        arcs: [arc],
        properties: {
          id: `${region}_panel`,
          abbr: '',
          name: `${region[0].toUpperCase()}${region.slice(1)} panel`,
          type: 'Inset frame',
          area: 0,
          start: panelFits[region].debut,
          end: recordEndN,
          // Always terminal: the frame outlives the chapter it first appears
          // in, so the chapter's edge is what ends it, not history.
          t: 1,
        },
      });
    }

    for (const { arc, figure, startN } of routes) {
      geometries.push({
        type: 'LineString',
        arcs: [arc],
        properties: {
          id: figure.id,
          abbr: '',
          name: figure.note ?? 'Story route',
          type: 'Story route',
          area: 0,
          // A route has no validity of its own. It is revealed when its beat's
          // date passes and it is still on the sheet when the chapter closes,
          // because the chapter's edge ends it and not history — the same shape
          // a panel frame has, and for the same reason.
          start: startN,
          end: recordEndN,
          t: 1,
        },
      });
    }

    // A chapter marked `built` that produces nothing to draw is a mistake and
    // not a quiet empty chapter. The loader would fetch a bundle with no
    // geometry at all, the sheet would come up blank, and from outside that is
    // indistinguishable from a broken build — which is exactly the state this
    // pipeline exists to make impossible.
    if (!geometries.length) {
      throw new Error(`chapter ${chapter.id} is marked built but has nothing to draw`);
    }

    const bundle = {
      type: 'Topology',
      transform,
      arcs,
      objects: {
        states: {
          type: 'GeometryCollection',
          geometries,
        },
      },
      meta: {
        chapter: chapter.id,
        index: chapter.index,
        name: chapter.name,
        nameZh: chapter.nameZh,
        from: chapter.from,
        to: chapter.to,
        start: chapter.start,
        end: chapter.end,
        sheet: { width: sheet.width, height: sheet.height },
        projection:
          'Composite: Albers equal-area conic (EPSG:5070 parameters) for the lower 48, ' +
          'Alaska conic (EPSG:3338 parameters), Hawaii conic (ESRI:102007)',
        panels: PANEL_REGIONS.filter((region) => panelFits[region].debut <= chapter.endN).map(
          (region) => ({
            region,
            rect: PANEL_RECTS[region],
            scale: panelFits[region].againstMainland,
          }),
        ),
        source: 'Newberry Library, Atlas of Historical County Boundaries (CC0 1.0)',
        simplification: TOLERANCE,
        quantisation: QUANT_RESOLUTION,
        stats: {
          geometries: geometries.length,
          arcs: arcs.length,
          pointsBefore: before + framePoints + routePoints,
          pointsAfter: after + framePoints + routePoints,
          routes: routes.length,
        },
      },
    };

    const json = JSON.stringify(bundle);
    const bytes = await writeJson(path.join(OUT_DIR, `${chapter.id}.json`), json);

    // The annotation layer ships separately. It is prose, it is nine per cent
    // of the payload, and nothing on the first tier reads it: the geometry has
    // to arrive fast, the explanation can wait until M2 asks for it.
    const notes = JSON.stringify({ chapter: chapter.id, changes });
    const notesBytes = await writeJson(path.join(OUT_DIR, `${chapter.id}.changes.json`), notes);

    const saved = before > 0 ? (1 - after / before) * 100 : 0;
    console.log(
      `${chapter.id.padEnd(11)} ${String(geometries.length).padStart(3)} geoms  ` +
        `${String(arcs.length).padStart(4)} arcs  ` +
        `${String(before).padStart(7)} -> ${String(after).padStart(6)} pts (-${saved.toFixed(0)}%)  ` +
        `${formatKb(bytes).padStart(9)} + ${formatKb(notesBytes).padStart(8)} notes` +
        `${frames.length ? `  panels ${frames.map((f) => f.region).join('+')}` : ''}` +
        `${routes.length ? `  routes ${routes.map((r) => r.figure.id).join('+')}` : ''}`,
    );

    manifest.push({
      chapter: chapter.id,
      file: `${chapter.id}.json`,
      notes: `${chapter.id}.changes.json`,
      bytes,
      notesBytes,
      geometries: geometries.length,
      arcs: arcs.length,
      changes: changes.length,
      panels: bundle.meta.panels.map((p) => p.region),
    });
  }

  await writeJson(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(
      {
        generated: new Date().toISOString(),
        sheet,
        projection:
          'Composite: Albers equal-area conic (EPSG:5070 parameters) for the lower 48, ' +
          'Alaska conic (EPSG:3338 parameters), Hawaii conic (ESRI:102007)',
        panels: Object.fromEntries(
          PANEL_REGIONS.map((region) => [
            region,
            {
              rect: PANEL_RECTS[region],
              scale: panelFits[region].againstMainland,
              debut: panelFits[region].debut,
            },
          ]),
        ),
        tolerance: TOLERANCE,
        chapters: manifest,
      },
      null,
      2,
    )}\n`,
  );

  console.log('');
  console.log(`done in ${Date.now() - started} ms -> data/chapters/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
