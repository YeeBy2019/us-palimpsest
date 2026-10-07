/**
 * Douglas–Peucker, applied arc by arc.
 *
 * In TopoJSON a border shared by two states is a single arc that both
 * geometries reference. That is the whole reason shared borders stay shared:
 * simplify the arc and both sides move together. So there is no need for a
 * topology-aware simplifier here — per-arc simplification is topology-safe by
 * construction, and the endpoints of every arc are always kept, so adjacent
 * arcs never pull apart at the joint.
 *
 * Douglas–Peucker rather than Visvalingam because its tolerance has a direct
 * reading: the maximum distance, in sheet units, that the drawn line may sit
 * from the true line. That makes it easy to state the tolerance in terms of a
 * pixel budget — see `build.js`.
 */

/**
 * @param {number[][]} points  an open polyline
 * @param {number} tolerance   maximum permitted deviation, same units as points
 * @returns {number[][]} a subsequence of `points`, always including the ends
 */
export function simplifyArc(points, tolerance) {
  const n = points.length;
  if (n <= 2 || tolerance <= 0) return points;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const toleranceSq = tolerance * tolerance;
  // Explicit stack rather than recursion: a coastline can be tens of thousands
  // of points long, and the worst case for recursive Douglas–Peucker is deep.
  const stack = [[0, n - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;

    const [x0, y0] = points[first];
    const [x1, y1] = points[last];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const spanSq = dx * dx + dy * dy;

    let worstSq = toleranceSq;
    let worst = -1;

    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let distanceSq;
      if (spanSq === 0) {
        distanceSq = (px - x0) * (px - x0) + (py - y0) * (py - y0);
      } else {
        let t = ((px - x0) * dx + (py - y0) * dy) / spanSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const cx = x0 + t * dx;
        const cy = y0 + t * dy;
        distanceSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      }
      if (distanceSq > worstSq) {
        worstSq = distanceSq;
        worst = i;
      }
    }

    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/** Simplify every arc in a topology, returning the points saved. */
export function simplifyArcs(arcs, tolerance) {
  let before = 0;
  let after = 0;
  const out = arcs.map((arc) => {
    before += arc.length;
    const simplified = simplifyArc(arc, tolerance);
    after += simplified.length;
    return simplified;
  });
  return { arcs: out, before, after };
}
