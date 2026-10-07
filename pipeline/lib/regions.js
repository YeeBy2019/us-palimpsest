/**
 * Which projection a geometry belongs to.
 *
 * One sheet cannot be covered by one projection. The lower forty-eight is an
 * Albers conic tuned to its own standard parallels; run Alaska through it and
 * you get finite, plausible, meaningless numbers, because a projection is a
 * function of longitude and latitude and has no idea what frame it is being
 * drawn into. That is not a bug in d3 — it is what a projection *is*.
 *
 * ## What this file used to be
 *
 * It used to be `placeable.js`, whose whole job was to answer "no" for Alaska
 * and Hawaii, and it was applied in three places — the sheet fit, the prune and
 * the annotation — because there were three separate ways for an unplaceable
 * geometry to reach the output. Guarding only the sheet fit, which is what it
 * started as, let every bundle from Chapter 4 onward carry a projected Alaska
 * at 6,671 points per version: about 44 per cent of those chapters' payload and
 * half their triangulation, spent on ink that landed off the paper. Hawaii came
 * out wholly off the sheet; Alaska left a sliver across the top-left corner.
 * Fixing that took those chapters from 147.4 KB to 98.5 KB.
 *
 * The exclusion was a holding position, and the note that stood here said so:
 * it lifts when the panels exist. They exist now. Alaska is drawn through an
 * Albers conic for Alaska (EPSG:3338 parameters) and Hawaii through its own
 * conic (ESRI:102007), each fitted into a rectangle in the sheet's south-west
 * ocean. See `project.js` for the rectangles and `docs/ARCHITECTURE.md` for why
 * they fit there.
 *
 * ## What replaced the exclusion, and why the hazard did not go away
 *
 * The failure changed shape rather than disappearing. It used to be
 * **placement** — a geometry that should never have been projected came back
 * with legal coordinates. It is now **routing** — and the mainland projector is
 * exactly as forgiving as it ever was. Send an `ak_` geometry through it today
 * and it will still return Nome at a finite position that is not on the paper.
 * Nothing about the projection got safer.
 *
 * What keeps it safe is that the region is read off the geometry's own id, once
 * per geometry, and that answer is what selects the projector. There is no path
 * through the pipeline that projects a coordinate without having first decided
 * which region it belongs to, so "which projection" is never a judgement made
 * from a coordinate.
 *
 * That routing is only sound while **an arc belongs to exactly one region**:
 * if a single arc were shared between an Alaskan and a mainland polygon, one of
 * the two would have to be projected the other's way. AHCB's state-level file
 * keeps them disjoint — 0 shared arcs out of 2,007, measured 2026-10-07 — but
 * that is a property of the data rather than of this code, so it is asserted in
 * `pipeline.test.js` rather than assumed here.
 */

/** Alaska and Hawaii arrive from AHCB under `ak_` and `hi_` prefixed ids. */
const ALASKA_IDS = /^ak_/;
const HAWAII_IDS = /^hi_/;

/** Everything projected through the lower-48 Albers, fitted to the whole sheet. */
export const MAINLAND = 'mainland';

/** Regions that get their own projection and their own rectangle. */
export const PANEL_REGIONS = ['alaska', 'hawaii'];

/** Which region a geometry id belongs to. */
export function regionOf(id) {
  if (ALASKA_IDS.test(id)) return 'alaska';
  if (HAWAII_IDS.test(id)) return 'hawaii';
  return MAINLAND;
}

/** Is this one of the inset regions? */
export function isPanel(region) {
  return region !== MAINLAND;
}
