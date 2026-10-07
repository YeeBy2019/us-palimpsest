/**
 * TopoJSON surgery: filter and prune.
 *
 * Everything here works on absolute (unquantised) coordinates. The pipeline
 * decodes once, does all its cutting and projecting in that space, and only
 * quantises again at the very end — which is what keeps shared borders exactly
 * shared. A polygon that is projected separately from its neighbour will drift
 * off it by a hair, and on an engraved map a hair is a visible seam.
 *
 * No topology is ever rebuilt. The arcs that come out of the source are the
 * arcs that go into the bundle; we only remove the ones nothing references.
 *
 * Decoding and arc-walking live in `src/lib/topojson.js` and are shared with
 * the runtime, so the encoder in the pipeline and the decoder in the browser
 * cannot drift.
 */

import { eachArcIndex } from '../../src/lib/topojson.js';

export { decodeArcs, eachArcIndex } from '../../src/lib/topojson.js';

/** Remap a geometry's arc references through `map`, preserving reversal. */
function remapGeometryArcs(geometry, map) {
  const swap = (i) => {
    const index = i < 0 ? ~i : i;
    const mapped = map.get(index);
    if (mapped === undefined) {
      throw new Error(`arc ${index} survived pruning but has no mapping`);
    }
    return i < 0 ? ~mapped : mapped;
  };

  const arcs = geometry.arcs;
  if (!arcs) return geometry;

  let next;
  switch (geometry.type) {
    case 'LineString':
      next = arcs.map(swap);
      break;
    case 'MultiLineString':
    case 'Polygon':
      next = arcs.map((ring) => ring.map(swap));
      break;
    case 'MultiPolygon':
      next = arcs.map((polygon) => polygon.map((ring) => ring.map(swap)));
      break;
    default:
      throw new Error(`cannot remap arcs of a ${geometry.type}`);
  }
  return { ...geometry, arcs: next };
}

/**
 * Keep only the geometries `predicate` accepts, and drop every arc they do not
 * reference.
 *
 * Pruning is not housekeeping. Filtering a chapter's date range typically
 * leaves two thirds of the source arcs unreferenced, and unreferenced arcs are
 * still bytes on the wire — the payload is the product here, so they go.
 */
export function pruneTopology(topology, absoluteArcs, predicate) {
  const kept = topology.objects.states.geometries.filter(predicate);

  const used = new Set();
  for (const geometry of kept) {
    eachArcIndex(geometry, (i) => used.add(i < 0 ? ~i : i));
  }

  // Preserve the source ordering so a diff of two bundles stays readable.
  const ordered = [...used].sort((a, b) => a - b);
  const map = new Map(ordered.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  const arcs = ordered.map((i) => absoluteArcs[i]);
  const geometries = kept.map((g) => remapGeometryArcs(g, map));

  return {
    type: 'Topology',
    arcs,
    objects: {
      states: { type: 'GeometryCollection', geometries },
    },
  };
}

/** Bounding box of a list of [x, y] points. */
export function boundsOf(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Every coordinate in every arc, as one flat list. */
export function allPoints(arcs) {
  const out = [];
  for (const arc of arcs) for (const point of arc) out.push(point);
  return out;
}
