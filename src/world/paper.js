/**
 * The sheet itself.
 *
 * Everything else is drawn *on* this, so it is not a background: it is the one
 * physical object in the scene. Land reads as paper that has been washed and
 * hatched; sea reads as paper that has not. Both come out of the same grain
 * function, which is why the continent does not look like a sticker.
 *
 * The edge is torn rather than ruled. A rectangle would say "viewport"; a
 * ragged edge with a lit rim says "sheet", and that single detail is most of
 * the difference between the two readings.
 */

import * as THREE from 'three';

import { SHEET_SCALE, patchMaterial } from '../core/shared.js';

/** How far the paper extends past the mapped area, in sheet units. */
export const PAPER_MARGIN = 0.14;

export function buildPaper(sheet) {
  const width = (sheet.width + PAPER_MARGIN * 2) * SHEET_SCALE;
  const height = (sheet.height + PAPER_MARGIN * 2) * SHEET_SCALE;

  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);

  const material = patchMaterial(
    // Unlit. Nothing on this sheet is *lit* — the grain, the vignette and the
    // torn edge are all drawn, and a lit material would divide the chapter's
    // own paper tint by pi and hand back grey card. See `createFillMaterial`.
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    {
      name: 'paper',
      uniforms: {
        uSheetExtent: { value: new THREE.Vector2(sheet.width, sheet.height) },
        uDeckle: { value: PAPER_MARGIN },
      },
      vertexCommon: `varying vec2 vSheet;`,
      vertexBody: `vSheet = position.xy / uSheetScale;`,
      fragmentCommon: /* glsl */ `
        varying vec2 vSheet;
        uniform vec2 uSheetExtent;
        uniform float uDeckle;
      `,
      fragmentBody: /* glsl */ `
        vec3 paper; vec3 ink; vec3 accent; vec4 style; vec4 tone;
        usChapterMix(paper, ink, accent, style, tone);

        // Sea is the sheet with nothing on it — a shade cooler than the land so
        // the land has something to be warmer than. Water is never blue here;
        // it is simply paper that has not been worked.
        vec3 col = paper * vec3(0.985, 0.992, 1.006);

        col *= usPaperGrain(vSheet, max(tone.y, 0.34));

        // The plate darkens toward its edges, the way an impression does where
        // the press fell away. Cubic so the middle stays untouched.
        vec2 away = abs(vSheet) / (uSheetExtent * 0.5);
        col *= 1.0 - 0.14 * pow(max(away.x, away.y), 3.0);

        // Deckle edge: two octaves of noise on the distance to the sheet's rim,
        // so the tear reads at two scales at once, as a real one does.
        // (Named halfExtent rather than half: half is reserved in GLSL ES,
        // held back for a future 16-bit type. And no backticks in here — this
        // block is a template literal.)
        vec2 halfExtent = uSheetExtent * 0.5 + vec2(uDeckle);
        vec2 inside = halfExtent - abs(vSheet);
        float tear =
          (usNoise(vSheet * 88.0) - 0.5) * 0.013 +
          (usNoise(vSheet * 265.0) - 0.5) * 0.005;
        float edge = smoothstep(0.0, 0.015, min(inside.x, inside.y) + tear);

        // Catch the light on the way out, so the tear has a thickness.
        col *= mix(0.84, 1.0, edge);

        diffuseColor.rgb = col;
        diffuseColor.a *= edge;
      `,
    },
  );

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 0;
  mesh.frustumCulled = false;
  mesh.name = 'paper';

  return { mesh, material };
}
