/**
 * Anchors: the boundary states that stay on the sheet after their moment.
 *
 * This is the palimpsest rule, and it is the one idea in the project that is
 * not borrowed. A chart of 1865 that still carries the line of 1861 beneath it
 * is not showing two maps at once — it is showing one sheet that has been used
 * more than once, which is what the word means.
 *
 * The rules, all of them load-bearing:
 *
 * - **Sediment, not overlay.** An anchor is drawn as desaturated ink at a
 *   reduced weight, never as a translucent filled shape. On an engraved plate a
 *   faint overlapping polygon reads as a registration error, not as history.
 * - **The window is counted in chapters, not years.** Chapters carry their own
 *   time scales, so "two chapters" and "two chapters' worth of years" are
 *   unrelated durations. Counting in years would have the 1783 line linger for
 *   eighty-two years while a 1941 line vanished in four.
 * - **The cap falls out of the window.** Two chapters of fading means the sheet
 *   never carries more than three anchors, so "at most three visible" is not a
 *   second rule to remember.
 * - **An anchor is not geometry of its own.** It is the same buffer as the live
 *   boundaries, drawn again against a pinned date. Nothing extra is built,
 *   nothing extra is fetched, and it cannot fall out of registration with the
 *   boundary it sits under because it *is* that boundary.
 */

import * as THREE from 'three';

import { GLSL_DATE_ATTRIBUTES, GLSL_DATE_TRANSFER, GLSL_DATE_VARYINGS, patchMaterial } from '../core/shared.js';
import { isoToYear } from '../lib/dates.js';
import { smoothstep } from '../lib/math.js';
import { CHAPTERS } from '../timeline/chapters.js';

/** Fade by page distance: full in the chapter that owns it, gone by the fourth. */
export const ANCHOR_FADE = [1, 0.55, 0.28];

/** Ink weight by page distance. Older sediment is drawn with a lighter hand. */
const ANCHOR_WEIGHT = [0.78, 0.62, 0.5];

/** How long, in years, an anchor takes to ink itself in once its date arrives. */
const REVEAL_YEARS = 0.25;

/** Strength for an anchor `distance` chapters behind the one being read. */
export function anchorStrength(distance) {
  return ANCHOR_FADE[distance] ?? 0;
}

/**
 * The anchors that should be on the sheet right now.
 *
 * Two filters, and both matter. A chapter's own anchors and those of the two
 * chapters before it are candidates — derived from the array length rather than
 * written down, so the visibility cap cannot drift from the fade. And an anchor
 * whose date has not yet arrived is not shown at all: the secession line cannot
 * be sediment in 1855, because in 1855 it had not happened.
 *
 * The result is ordered newest first, so slot 0 is always the most recent thing
 * the sheet remembers.
 */
export function visibleAnchors(chapter, date, max = ANCHOR_FADE.length) {
  const found = [];

  for (const owner of CHAPTERS) {
    if (!owner.anchors) continue;
    const distance = chapter.index - owner.index;
    // distance < 0: the anchor belongs to a chapter not yet reached.
    if (distance < 0 || distance >= ANCHOR_FADE.length) continue;

    for (const anchor of owner.anchors) {
      const year = isoToYear(anchor.date);
      if (date < year) continue;
      found.push({
        ...anchor,
        year,
        distance,
        weight: ANCHOR_WEIGHT[distance],
        strength: anchorStrength(distance) * smoothstep(year, year + REVEAL_YEARS, date),
      });
    }
  }

  return found.sort((a, b) => b.year - a.year).slice(0, max);
}

export function createAnchorMaterial() {
  const uniforms = {
    /** The date the anchor depicts. Pinned; the cursor does not move it. */
    uAnchorDate: { value: 1861.28 },
    /** How strongly the anchor shows. 0 hides it entirely. */
    uAnchorStrength: { value: 0 },
    /** Anchors are drawn lighter than the live boundaries they sit beneath. */
    uWeightScale: { value: 0.75 },
  };

  const material = patchMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    {
      name: 'anchor',
      uniforms,
      vertexCommon: /* glsl */ `
        attribute vec2 aNormal;
        attribute float aSide;
        uniform float uWeightScale;
        varying float vAcross;
        varying vec2 vSheet;
        ${GLSL_DATE_ATTRIBUTES}
      `,
      vertexBody: /* glsl */ `
        vec3 chapterPaper; vec3 chapterInk; vec3 chapterAccent; vec4 chapterStyle; vec4 chapterTone;
        usChapterMix(chapterPaper, chapterInk, chapterAccent, chapterStyle, chapterTone);

        float halfWidth = 0.5 * chapterStyle.z * uWorldPerPixel * uWeightScale;
        transformed.xy += aNormal * aSide * halfWidth;

        vAcross = aSide;
        vSheet = position.xy / uSheetScale;
        ${GLSL_DATE_TRANSFER}
        transformed.xy += usWobble(position.xy);
      `,
      fragmentCommon: /* glsl */ `
        varying float vAcross;
        varying vec2 vSheet;
        uniform float uAnchorDate;
        uniform float uAnchorStrength;
        ${GLSL_DATE_VARYINGS}
      `,
      fragmentBody: /* glsl */ `
        vec3 paper; vec3 ink; vec3 accent; vec4 style; vec4 tone;
        usChapterMix(paper, ink, accent, style, tone);

        // Alive on the anchor's own date, not on the cursor's. This is the only
        // place in the project that evaluates the date mask somewhere other
        // than "now", and it is the whole mechanism of the palimpsest.
        //
        // It reads the varyings, not the a-prefixed attributes: attributes
        // exist only in the vertex stage, and the vertex stage has already
        // transferred them here.
        float onAnchorDate = usAliveAt(vStart, vEnd, vTerminal, vFrom, uAnchorDate);
        if (onAnchorDate <= 0.001 || uAnchorStrength <= 0.001) discard;

        float profile = 1.0 - abs(vAcross);
        float coverage = smoothstep(0.0, 0.6, profile);

        // Desaturated toward the paper: the ink has been scraped back and only
        // its shadow is left in the fibre.
        vec3 col = mix(paper, ink, 0.34) * usPaperGrain(vSheet, tone.y * uPaper * 0.55);

        diffuseColor.rgb = col;
        diffuseColor.a = onAnchorDate * coverage * 0.34 * uAnchorStrength;
      `,
    },
  );

  return { material, uniforms };
}
