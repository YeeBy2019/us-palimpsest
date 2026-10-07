/**
 * The camera.
 *
 * Deliberately the least interesting file in the project. The atlas is drawn in
 * a fixed projection onto a fixed sheet, so the camera's job is to frame that
 * sheet and then get out of the way — any orbit, tilt or perspective here would
 * foreshorten the map and quietly undo the one property the projection was
 * chosen for.
 *
 * So: straight down, long lens. A 24-degree field of view from a distance is
 * very nearly orthographic without the flatness of a true orthographic camera,
 * which keeps a little depth in the dot cloud during a transition.
 *
 * The authored camera work — the dive into a historical scene — is M4, and this
 * is where its director will live.
 */

import * as THREE from 'three';

import { SHEET_SCALE } from '../core/shared.js';
import { damp } from '../lib/math.js';
import { PAPER_MARGIN } from './paper.js';

/**
 * Long lens. Wide angles would fan the sheet out at the edges and make a
 * rectangle of paper read as a room.
 */
export const FOV = 24;

/** How far the sheet may drift toward the pointer, in world units. */
const PARALLAX = 0.42;

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 500);
  camera.position.set(0, 0, 60);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Place the camera so the whole sheet — paper margin included — fits, with a
 * little air around it.
 *
 * Uses both the vertical and horizontal fields of view and takes whichever is
 * more demanding, so a wide window does not crop the top and a tall one does
 * not crop the sides.
 */
export function frameSheet(camera, sheet, aspect) {
  camera.aspect = aspect;

  const margin = 1.07;
  const width = (sheet.width + PAPER_MARGIN * 2) * SHEET_SCALE * margin;
  const height = (sheet.height + PAPER_MARGIN * 2) * SHEET_SCALE * margin;

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const neededForHeight = height / 2 / Math.tan(vFov / 2);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const neededForWidth = width / 2 / Math.tan(hFov / 2);

  camera.position.set(0, 0, Math.max(neededForHeight, neededForWidth));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return camera.position.z;
}

/**
 * How many world units one CSS pixel covers, at the depth of the sheet.
 *
 * The inverse of this is the exchange rate between the units line weights are
 * authored in and the units the shaders displace vertices in. The sheet is a
 * plane at the camera's focal distance, so the frustum's height there is
 * `2 * z * tan(fov / 2)` world units across the whole viewport.
 */
export function worldPerCssPixel(camera, cssHeight) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  return (2 * camera.position.z * Math.tan(vFov / 2)) / Math.max(1, cssHeight);
}

/**
 * Ease the camera toward the pointer.
 *
 * Half a world unit of travel is not much, but it is the difference between
 * looking at a picture of a sheet and looking at a sheet. It costs one damped
 * number per frame.
 */
export function applyParallax(camera, pointer, dt) {
  const targetX = pointer.x * PARALLAX;
  const targetY = pointer.y * PARALLAX * 0.62;
  camera.position.x = damp(camera.position.x, targetX, 2.4, dt);
  camera.position.y = damp(camera.position.y, targetY, 2.4, dt);
  camera.lookAt(camera.position.x * 0.28, camera.position.y * 0.28, 0);
}
