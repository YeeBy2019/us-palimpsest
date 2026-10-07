/**
 * Which geometries the atlas can actually place on the sheet.
 *
 * The atlas draws on one sheet, and that sheet is fitted to the lower
 * forty-eight states through a single Albers equal-area projection. Alaska and
 * Hawaii are therefore not merely elsewhere — they are *unrepresentable* here.
 * They need their own projections and their own panels, which do not exist yet.
 *
 * The dangerous part is that nothing fails loudly when they are let through.
 * `geoAlbers()` is a function of longitude and latitude and will return a
 * perfectly finite pair of numbers for Nome. It has no way to know that the
 * frame it is drawing into stops at the 49th parallel, so the coordinates come
 * back legal, plausible-looking, and meaningless — they land outside the sheet,
 * or across a corner of it, and get drawn.
 *
 * Measured, before this rule was applied to the prune as well as to the fit:
 * Alaska landed at sheet x[-0.575, 0.060] y[0.773, 1.251] and Hawaii at
 * x[-0.805, -0.738], on a sheet 1.000 wide and 0.776 high. Hawaii was entirely
 * off the paper; Alaska left a sliver across the top-left corner and cost 6,671
 * points per version, about 44 per cent of those chapters' payload and half
 * their triangulation.
 *
 * So this predicate is applied in three places, and all three are load-bearing:
 * the sheet fit (so the panels do not stretch the sea the mainland is measured
 * against), the prune (so they never enter a bundle), and the annotation (so the
 * notes do not describe a boundary change the drawing cannot show).
 *
 * It lifts when the panels exist. Deleting it early does not produce an error;
 * it produces a smudge on the paper and a bundle that is twice too big.
 */

/** Alaska and Hawaii arrive from AHCB under ids prefixed `ak_` / `hi_`. */
export const INSET_IDS = /^(ak|hi)_/;

/** Can the atlas place this geometry on the sheet as it is drawn today? */
export function placeable(geometry) {
  return !INSET_IDS.test(geometry.properties.ID);
}
