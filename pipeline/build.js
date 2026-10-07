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
 *     -> project once, into the fixed sheet space
 *     -> simplify, arc by arc, topology safely
 *     -> quantise back to TopoJSON
 *     -> one bundle per chapter
 *
 * Two rules the whole file obeys:
 *
 * 1. **Decode once, quantise once.** All the cutting happens in absolute
 *    coordinates. If a chapter's geometry were projected or rounded separately
 *    from its neighbour's, shared borders would drift apart and the seam would
 *    be visible on an engraved map.
 * 2. **The sheet is fitted once, from the whole record.** The projection is
 *    fixed for the atlas, so the sheet must be too — otherwise an anchor would
 *    no longer lie exactly beneath the boundary that succeeds it.
 *
 * Generated bundles are not committed. `npm run data:build` regenerates them.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS } from '../src/timeline/chapters.js';
import { decodeArcs } from '../src/lib/topojson.js';
import { eachArcIndex, pruneTopology } from './lib/topology.js';
import { createProjection, fitSheet } from './lib/project.js';
import { simplifyArcs } from './lib/simplify.js';
import { quantizeArcs } from './lib/quantize.js';

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

/** Alaska and Hawaii are insets in their own projections; they are not part of the main field. */
const INSET_IDS = /^(ak|hi)_/;

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

/** Every arc index referenced by a mainland geometry. */
function mainlandArcIndices(topology) {
  const indices = new Set();
  for (const geometry of topology.objects.states.geometries) {
    if (INSET_IDS.test(geometry.properties.ID)) continue;
    eachArcIndex(geometry, (i) => indices.add(i < 0 ? ~i : i));
  }
  return indices;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  const started = Date.now();

  const source = JSON.parse(await readFile(SOURCE, 'utf8'));
  const total = source.objects.states.geometries.length;
  const arcsAbsolute = decodeArcs(source);
  const project = createProjection();

  // ---- the sheet, fitted once -------------------------------------------
  const mainland = mainlandArcIndices(source);
  const mainlandPoints = [];
  for (const index of mainland) {
    for (const point of arcsAbsolute[index]) {
      const projected = project(point);
      if (projected) mainlandPoints.push(projected);
    }
  }
  const { normalize, sheet } = fitSheet(mainlandPoints);

  console.log(`source            ${total} geometries, ${arcsAbsolute.length} arcs`);
  console.log(`mainland          ${mainland.size} arcs fitted to the sheet`);
  console.log(
    `sheet             ${sheet.width.toFixed(4)} x ${sheet.height.toFixed(4)} ` +
      `(aspect ${(sheet.width / sheet.height).toFixed(4)})`,
  );
  console.log('');

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const chapter of CHAPTERS) {
    if (!chapter.built) continue;

    // ---- prune to this chapter's window -------------------------------
    const pruned = pruneTopology(
      source,
      arcsAbsolute,
      (geometry) =>
        geometry.properties.START_N <= chapter.endN && geometry.properties.END_N >= chapter.startN,
    );

    // ---- project into sheet space -------------------------------------
    const projected = pruned.arcs.map((arc) =>
      arc.map((point) => {
        const metres = project(point);
        if (!metres) {
          throw new Error(`projection failed inside chapter ${chapter.id} at ${point}`);
        }
        return normalize(metres);
      }),
    );

    // ---- simplify, then quantise ---------------------------------------
    const { arcs: simplified, before, after } = simplifyArcs(projected, TOLERANCE);
    const { arcs, transform } = quantizeArcs(simplified, QUANT_RESOLUTION);

    // Boundary changes whose *start* falls inside the window: the annotation
    // layer, carried here because AHCB's `CHANGE` field is the only record of
    // why a line moved, and it is exactly what Chapter 3's narration needs.
    const changes = source.objects.states.geometries
      .filter(
        (g) =>
          g.properties.START_N >= chapter.startN && g.properties.START_N <= chapter.endN,
      )
      .map((g) => ({
        n: g.properties.START_N,
        id: g.properties.ID,
        name: g.properties.NAME_START,
        change: g.properties.CHANGE,
      }))
      .sort((a, b) => a.n - b.n);

    const bundle = {
      type: 'Topology',
      transform,
      arcs,
      objects: {
        states: {
          type: 'GeometryCollection',
          geometries: pruned.objects.states.geometries.map((g) => ({
            ...g,
            properties: {
              ...slimProperties(g.properties),
              // `t` marks a feature that is still alive when the chapter closes:
              // the chapter's own edge clips it, not history. Without this flag
              // the date mask would fade everything out on the chapter's last
              // day and the map would dissolve into blank paper.
              t: g.properties.END_N >= chapter.endN ? 1 : 0,
            },
          })),
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
        projection: 'Albers equal-area conic, EPSG:5070 parameters (d3.geoAlbers, lower 48)',
        source: 'Newberry Library, Atlas of Historical County Boundaries (CC0 1.0)',
        simplification: TOLERANCE,
        quantisation: QUANT_RESOLUTION,
        stats: {
          geometries: pruned.objects.states.geometries.length,
          arcs: arcs.length,
          pointsBefore: before,
          pointsAfter: after,
        },
      },
    };

    const json = JSON.stringify(bundle);
    await writeFile(path.join(OUT_DIR, `${chapter.id}.json`), json);

    // The annotation layer ships separately. It is prose, it is nine per cent
    // of the payload, and nothing on the first tier reads it: the geometry has
    // to arrive fast, the explanation can wait until M2 asks for it.
    const notes = JSON.stringify({ chapter: chapter.id, changes });
    await writeFile(path.join(OUT_DIR, `${chapter.id}.changes.json`), notes);

    const saved = before > 0 ? (1 - after / before) * 100 : 0;
    console.log(
      `${chapter.id.padEnd(11)} ${String(bundle.meta.stats.geometries).padStart(3)} geoms  ` +
        `${String(arcs.length).padStart(4)} arcs  ` +
        `${String(before).padStart(7)} -> ${String(after).padStart(6)} pts (-${saved.toFixed(0)}%)  ` +
        `${formatKb(json.length).padStart(9)} + ${formatKb(notes.length).padStart(8)} notes`,
    );

    manifest.push({
      chapter: chapter.id,
      file: `${chapter.id}.json`,
      notes: `${chapter.id}.changes.json`,
      bytes: json.length,
      notesBytes: notes.length,
      geometries: bundle.meta.stats.geometries,
      arcs: arcs.length,
      changes: changes.length,
    });
  }

  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(
      {
        generated: new Date().toISOString(),
        sheet,
        projection: 'Albers equal-area conic, EPSG:5070 parameters, lower 48',
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
