/**
 * The projections, the sheet, and the two panels.
 *
 * Fixed for the whole atlas. This is not a per-chapter setting: an anchor has
 * to lie exactly beneath the boundary that succeeds it, and re-projecting
 * between chapters would break that registration deliberately. One sheet, one
 * set of projections, for all eight chapters.
 *
 * ## Three projections on one sheet
 *
 * `d3.geoAlbers()` is EPSG:5070 for the lower forty-eight. The standard
 * parallels (29.5N and 45.5N), the central meridian (96W) and the origin
 * latitude (23N) are the same numbers the Census Bureau and the USGS publish;
 * only the translation differs, and the sheet transform below normalises that
 * away anyway. Albers is used because it preserves area exactly, so a state's
 * drawn weight equals its real weight — the correct bias for a map whose whole
 * subject is territory.
 *
 * Alaska and Hawaii are not in that projection and cannot be. Each gets the
 * conic the cartographic literature gives it, borrowed from d3's own composite
 * rather than invented here:
 *
 * - **Alaska**, `conicEqualArea` rotated to 154W, centred at (-2, 58.5), on
 *   parallels 55N and 65N. These are EPSG:3338's parameters.
 * - **Hawaii**, `conicEqualArea` rotated to 157W, centred at (-3, 19.9), on
 *   parallels 8N and 18N. These are ESRI:102007's.
 *
 * All three are built at the same scale, so the *rectangles* below are what set
 * each panel's size. That is deliberate: an inset's scale is a layout decision,
 * and writing it as a rectangle makes it one number in one place instead of a
 * factor buried in a projection call.
 *
 * ## The panels, and why they need no room made for them
 *
 * Alaska and Hawaii are drawn in the sheet's south-west ocean, in the quarter
 * between the California coast and the sheet's corner. That region is empty in
 * every frame the atlas has ever drawn, because the nearest land to it is Baja
 * California — which is not in this dataset — and then San Diego.
 *
 * Measured 2026-10-07, the lowest mainland land by column runs from y 0.307 at
 * x 0.05 down to y 0.156 at x 0.25 and y 0.086 at x 0.375: a ceiling that falls
 * away to the south-east, set by the California coast, the Mexican border and
 * the Rio Grande in turn. The two rectangles below are the largest that clear
 * that ceiling by 0.012 of a sheet unit — about 17 px on a 1400-pixel sheet —
 * with 0.024 between them, found by scanning the ceiling rather than by eye.
 *
 * An earlier draft of the README said the sheet *grows* when the date reaches
 * the insets, and that is wrong: the space is already there, and has been in
 * every frame of Chapters 2 and 3. Nothing is reserved, because ocean is not
 * reserved space. What the panels change is that two pieces of land come to be
 * drawn in it, Alaska from 1867 and Hawaii from 1898, and before those dates
 * there is no panel — no outline, no frame, nothing.
 *
 * ## The one number this costs
 *
 * An inset in a real atlas is not at true scale, and neither are these. Alaska
 * is drawn at about **0.32** of the lower-48's scale and Hawaii at about
 * **0.90**, which is what fits. Alaska at true scale would be 0.68 of the
 * sheet's width and would not go in the ocean at all — it would need the sheet
 * to grow, which is the design this file's numbers exist to avoid. The atlas's
 * equal-area argument is an argument about the lower forty-eight, where it
 * holds exactly; the insets are labelled as insets and are not part of it.
 */

import { geoAlbers, geoConicEqualArea } from 'd3-geo';

/** Geometric mean radius of the GRS80 ellipsoid, in metres. */
const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Where each panel goes, as [x0, y0, x1, y1] in sheet units, y up.
 *
 * The sheet is one unit wide and 0.776 high, so these are direct fractions of
 * it. They are the largest rectangles that clear the mainland by 0.012 and each
 * other by 0.024; the scan that produced them is described at the head of this
 * file, and `pipeline.test.js` re-derives the clearance from the geometry so
 * the numbers cannot rot quietly if the source data moves.
 */
export const PANEL_RECTS = {
  alaska: [0.012, 0.012, 0.232, 0.146],
  hawaii: [0.256, 0.012, 0.364, 0.082],
};

/** A projector returning [x, y] in a stable planar space, or null. */
function toProjector(projection) {
  // Scale is arbitrary: every consumer normalises it away. It is set to the
  // earth's radius so the intermediate numbers are at least honest metres.
  const placed = projection.scale(EARTH_RADIUS_M).translate([0, 0]);
  return ([lon, lat]) => {
    const point = placed([lon, lat]);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
    return point;
  };
}

/**
 * The three projectors, keyed by region. {@link import('./regions.js').regionOf}
 * decides which one a geometry is handed to.
 */
export function createProjectors() {
  return {
    mainland: toProjector(geoAlbers()),
    alaska: toProjector(
      geoConicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]),
    ),
    hawaii: toProjector(
      geoConicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]),
    ),
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
 * **Fitted from the mainland alone.** A panel folded into this fit would stretch
 * the sea the mainland is measured against, and every mainland coordinate would
 * shift to suit it. The panels are placed inside the sheet instead; see
 * {@link fitPanel}.
 *
 * @param {number[][]} projectedPoints
 */
export function fitSheet(projectedPoints) {
  const box = boundsOf(projectedPoints);
  const metresWide = box.maxX - box.minX;
  const scale = 1 / metresWide;

  return {
    /** Map a projected metre coordinate into sheet units. */
    normalize: ([x, y]) => [(x - box.minX) * scale, (box.maxY - y) * scale],
    sheet: {
      // One unit wide, height follows from the projected extent.
      width: 1,
      height: (box.maxY - box.minY) * scale,
      // Kept so the pipeline can report the real-world size of the sheet.
      metresWide,
      metresHigh: box.maxY - box.minY,
    },
  };
}

/**
 * Fit one region's projected points into its rectangle, preserving aspect.
 *
 * Unlike the sheet, this is fitted **once from the whole record** and reused by
 * every chapter. Fitting it per chapter would resize the panel wherever a
 * chapter's window happened to clip a version of its outline, so Alaska would
 * be a different size in Chapter 4 than in Chapter 7 — a scale that changes
 * with the date, which is the one thing a printed inset never does.
 *
 * @param {number[][]} projectedPoints  every point of this region in the record
 * @param {number[]} rect               [x0, y0, x1, y1] in sheet units, y up
 */
export function fitPanel(projectedPoints, rect) {
  const box = boundsOf(projectedPoints);
  const [x0, y0, x1, y1] = rect;

  const width = x1 - x0;
  const height = y1 - y0;
  const scale = Math.min(width / (box.maxX - box.minX), height / (box.maxY - box.minY));

  // Centred in its rectangle, so the panel sits in the middle of its box rather
  // than hugging a corner when the rectangle and the shape disagree by a
  // fraction of a per cent.
  const drawnWidth = (box.maxX - box.minX) * scale;
  const drawnHeight = (box.maxY - box.minY) * scale;
  const originX = x0 + (width - drawnWidth) / 2;
  const originY = y0 + (height - drawnHeight) / 2;

  return {
    /** Map this region's projected metres into sheet units. */
    normalize: ([x, y]) => [originX + (x - box.minX) * scale, originY + (box.maxY - y) * scale],
    rect,
    /**
     * Sheet units per projected metre. Multiply by the sheet's width in metres
     * for the factor against the lower forty-eight, which is the number the
     * atlas reports: the sheet is one unit wide, so its own scale is
     * `1 / metresWide`, and the quotient of the two is dimensionless.
     *
     * Multiplying by the earth radius instead — which is what the first version
     * of this did — gives the factor against the *projection's* nominal scale
     * rather than against the map, and those are different by the ratio of the
     * lower-48's drawn width to the earth's radius. It reported Alaska at 0.44
     * where the truth is 0.32.
     */
    scale,
  };
}

/** Bounding box of a list of [x, y]; throws rather than returning an empty one. */
function boundsOf(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (!point) continue;
    if (point[0] < minX) minX = point[0];
    if (point[1] < minY) minY = point[1];
    if (point[0] > maxX) maxX = point[0];
    if (point[1] > maxY) maxY = point[1];
  }
  if (!Number.isFinite(minX)) throw new Error('nothing to fit: no finite projected points');
  return { minX, minY, maxX, maxY };
}
