/**
 * Reading our own bundle format.
 *
 * The bundles the pipeline writes are TopoJSON: shared arcs, delta-encoded and
 * quantised. That is the smallest honest representation of a set of boundaries,
 * and shared arcs are also what keeps a border shared — two states that meet
 * along a line reference the *same* arc, so simplifying, projecting or warping
 * it moves both sides together and the seam cannot open.
 *
 * Expansion back to rings is about twenty-five lines, which is why there is no
 * topojson dependency in the runtime.
 */

/**
 * Walk every arc index a geometry references, including through collections.
 *
 * Shared by the pipeline (which uses it to decide what survives pruning) and
 * the runtime (which uses it to work out which dates an arc is alive for).
 */
export function eachArcIndex(geometry, visit) {
  const arcs = geometry.arcs;
  if (!arcs) return;
  switch (geometry.type) {
    case 'LineString':
      for (const i of arcs) visit(i);
      break;
    case 'MultiLineString':
    case 'Polygon':
      for (const ring of arcs) for (const i of ring) visit(i);
      break;
    case 'MultiPolygon':
      for (const polygon of arcs) for (const ring of polygon) for (const i of ring) visit(i);
      break;
    default:
      break;
  }
}

/**
 * Decode an arc list into absolute coordinates.
 *
 * Each arc is a run of deltas from its previous point; the topology's transform
 * then scales and translates the lot. A point may legally carry only a `dx`,
 * with `dy` implied to be zero — the encoder emits that form because it is
 * common and it is two bytes cheaper.
 *
 * @param {{arcs: number[][][], transform?: {scale: number[], translate: number[]}}} topology
 * @returns {number[][][]} arcs of absolute [x, y]
 */
export function decodeArcs(topology) {
  const scale = topology.transform?.scale ?? [1, 1];
  const translate = topology.transform?.translate ?? [0, 0];
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const out = new Array(arc.length);
    for (let i = 0; i < arc.length; i++) {
      const point = arc[i];
      x += point[0];
      y += point.length > 1 ? point[1] : 0;
      out[i] = [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    }
    return out;
  });
}

/**
 * Stitch a list of ring arc-references into one closed ring of points.
 *
 * A negative reference means the arc is traversed backwards. Consecutive arcs
 * share an endpoint, so every arc after the first contributes its points from
 * index 1 onward — otherwise the ring would carry a duplicate vertex at every
 * joint, which shows up as a bright dot on a stroke and as degenerate triangles
 * in a fill.
 */
function stitchRing(ringRefs, arcs) {
  const points = [];
  for (let k = 0; k < ringRefs.length; k++) {
    const ref = ringRefs[k];
    const arc = ref < 0 ? arcs[~ref].slice().reverse() : arcs[ref];
    for (let j = k === 0 ? 0 : 1; j < arc.length; j++) points.push(arc[j]);
  }
  return points;
}

/**
 * Expand a Polygon or MultiPolygon into polygons of rings.
 *
 * @returns {number[][][][]} one entry per polygon, each an array of closed rings
 */
export function polygonRings(geometry, arcs) {
  if (geometry.type === 'Polygon') {
    return [geometry.arcs.map((ringRefs) => stitchRing(ringRefs, arcs))];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.arcs.map((polygon) => polygon.map((ringRefs) => stitchRing(ringRefs, arcs)));
  }
  return [];
}

/** Signed planar area of a ring, positive for counter-clockwise. */
export function ringArea(ring) {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/**
 * Normalise a raw ring for triangulation: drop non-finite points and the
 * closing duplicate.
 *
 * TopoJSON rings are implicitly closed — the last point of the last arc is
 * again the first point of the first — and the triangulator removes the
 * duplicate itself, but only after it has been handed the ring. Counting the
 * duplicate as a real vertex would let a degenerate two-point ring pass the
 * "is this a polygon" check.
 */
export function cleanRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y]);
  }
  while (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12) out.pop();
    else break;
  }
  return out;
}
