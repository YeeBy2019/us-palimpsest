/**
 * The projection, and the sheet it draws onto.
 *
 * Fixed for the whole atlas. This is not a per-chapter setting: an anchor has
 * to lie exactly beneath the boundary that succeeds it, and re-projecting
 * between chapters would break that registration deliberately. One projection,
 * one sheet, for all eight chapters.
 *
 * `d3.geoAlbers()` is EPSG:5070 for the lower forty-eight. The standard
 * parallels (29.5N and 45.5N), the central meridian (96W) and the origin
 * latitude (23N) are the same numbers the Census Bureau and the USGS publish;
 * only the translation differs, and the sheet transform below normalises that
 * away anyway. Albers is used because it preserves area exactly, so a state's
 * drawn weight equals its real weight — the correct bias for a map whose whole
 * subject is territory.
 */

import { geoAlbers } from 'd3-geo';

/** Geometric mean radius of the GRS80 ellipsoid, in metres. */
const EARTH_RADIUS_M = 6_371_008.8;

/**
 * A projector that returns [x, y] in a stable planar space, or null for a
 * coordinate the projection cannot place.
 */
export function createProjection() {
  // Scale is arbitrary: the sheet transform normalises it to a unit width, and
  // nothing downstream depends on the absolute magnitude. It is set to the
  // earth's radius so the intermediate numbers are at least honest metres.
  const albers = geoAlbers().scale(EARTH_RADIUS_M).translate([0, 0]);
  return ([lon, lat]) => {
    const point = albers([lon, lat]);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    return point;
  };
}

/**
 * Build the sheet transform: project every point it is given, take the bounding
 * box, and return a function that maps projected metres into sheet units.
 *
 * The returned sheet is one unit wide with a y-up axis, because that is what
 * the renderer wants and because a unit width makes every other measurement in
 * the shader (hatch spacing, line weight, bleed radius) read as a fraction of
 * the sheet rather than as a magic number.
 *
 * @param {import('./projection.js').Point[]} projectedPoints
 */
export function fitSheet(projectedPoints) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of projectedPoints) {
    if (!point) continue;
    if (point[0] < minX) minX = point[0];
    if (point[1] < minY) minY = point[1];
    if (point[0] > maxX) maxX = point[0];
    if (point[1] > maxY) maxY = point[1];
  }
  if (!Number.isFinite(minX)) throw new Error('nothing to fit: no finite projected points');

  const metresWide = maxX - minX;
  const scale = 1 / metresWide;

  return {
    /** Map a projected metre coordinate into sheet units. */
    normalize([x, y]) {
      return [(x - minX) * scale, (maxY - y) * scale];
    },
    sheet: {
      // One unit wide, height follows from the projplied extent.
      width: 1,
      height: (maxY - minY) * scale,
      // Kept so the pipeline can report the real-world size of the sheet.
      metresWide,
      metresHigh: maxY - minY,
    },
  };
}
