/**
 * Quantise a set of absolute arcs back into TopoJSON's delta-encoded form.
 *
 * Two savings, both worth having since the payload is the product here. Rounding
 * to a fixed grid makes the deltas small integers, and a delta of zero in `y`
 * lets the point be written as a single number — the encoder emits that form
 * whenever it can, which is often, because most boundary runs are axis-tending.
 */

/**
 * @param {number[][][]} arcs      absolute coordinates
 * @param {number} resolution      grid steps across the longer axis
 * @returns {{arcs: number[][][], transform: {scale: number[], translate: number[]}}}
 */
export function quantizeArcs(arcs, resolution = 1e5) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const arc of arcs) {
    for (const [x, y] of arc) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) throw new Error('nothing to quantise: no finite coordinates');

  const steps = Math.max(2, resolution);
  const scale = [
    maxX > minX ? (maxX - minX) / (steps - 1) : 1,
    maxY > minY ? (maxY - minY) / (steps - 1) : 1,
  ];
  const translate = [minX, minY];

  const quantized = arcs.map((arc) => {
    const out = new Array(arc.length);
    let previousX = 0;
    let previousY = 0;
    for (let i = 0; i < arc.length; i++) {
      const x = Math.round((arc[i][0] - translate[0]) / scale[0]);
      const y = Math.round((arc[i][1] - translate[1]) / scale[1]);
      const dx = x - previousX;
      const dy = y - previousY;
      previousX = x;
      previousY = y;
      // A point with no vertical movement is written as a single number. This
      // is valid TopoJSON and `decodeArcs` reads it back.
      out[i] = dy === 0 ? [dx] : [dx, dy];
    }
    return out;
  });

  return { arcs: quantized, transform: { scale, translate } };
}
