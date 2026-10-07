/**
 * The dispersal. The only transition device in the atlas.
 *
 * The reference never cuts and never cross-fades: the previous scene is
 * dispersed into dots and those dots become the next scene's material. We do
 * the same, and the important word is *become* — there is one motion here, not
 * two. The dots are not a curtain over the change; they are the boundary coming
 * apart, and the same particles settle back as the next chapter's ink.
 *
 * So the particles are seeded from the boundary geometry itself, one per few
 * segments, standing exactly where the ink was. Nothing is invented, and no
 * second system has to be kept in step with the first.
 *
 * The motion lives in the vertex shader. The dispersal happens to every line at
 * once, so driving it from JavaScript per particle would be both slower and
 * wrong — the CPU cannot see the whole sheet at the instant it moves.
 */

import * as THREE from 'three';

import { GLSL_COMMON, GLSL_DATE_MASK, U } from '../core/shared.js';
import { hash1 } from '../lib/math.js';

const DEFAULTS = {
  /** Upper bound on particles; the boundary set is subsampled down to this. */
  maxDots: 18_000,
  /** Base point size in CSS pixels. */
  pixelSize: 2.6,
};

export function buildDots(outlineGeometry, options = {}) {
  const { maxDots, pixelSize } = { ...DEFAULTS, ...options };

  const position = outlineGeometry.getAttribute('position');
  const start = outlineGeometry.getAttribute('aStart');
  const end = outlineGeometry.getAttribute('aEnd');
  const terminal = outlineGeometry.getAttribute('aTerminal');
  const from = outlineGeometry.getAttribute('aFrom');

  // Four vertices per segment, all sharing a position; the first is the
  // segment's own start, so sampling every fourth vertex walks the polylines.
  const segments = Math.floor(position.count / 4);
  const stride = Math.max(1, Math.ceil(segments / maxDots));

  const positions = [];
  const starts = [];
  const ends = [];
  const terminals = [];
  const froms = [];
  const directions = [];
  const delays = [];

  let count = 0;
  for (let s = 0; s < segments; s += stride) {
    const i = s * 4;
    const x = position.getX(i);
    const y = position.getY(i);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    positions.push(x, y, 0);
    starts.push(start.getX(i));
    ends.push(end.getX(i));
    terminals.push(terminal.getX(i));
    froms.push(from.getX(i));

    // A stable direction and delay per particle: the sheet lifts differently
    // each time in space, and identically on every load.
    const angle = hash1(s * 2246822519) * Math.PI * 2;
    directions.push(Math.cos(angle), Math.sin(angle));
    delays.push(hash1(s * 3266489917));

    count++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 1));
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  geometry.setAttribute('aTerminal', new THREE.Float32BufferAttribute(terminals, 1));
  geometry.setAttribute('aFrom', new THREE.Float32BufferAttribute(froms, 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute(directions, 2));
  geometry.setAttribute('aDelay', new THREE.Float32BufferAttribute(delays, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  const uniforms = {
    uPointSize: { value: pixelSize },
    uPixelScale: { value: 1 },
    uWeightScale: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    // The same uniform objects as every other material, so the dispersal is one
    // number away from the rest of the frame.
    uniforms: { ...U, ...uniforms },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      ${GLSL_DATE_MASK}
      attribute float aStart;
      attribute float aEnd;
      attribute float aTerminal;
      attribute float aFrom;
      attribute vec2 aDirection;
      attribute float aDelay;
      uniform float uPointSize;
      uniform float uPixelScale;

      varying float vAlive;
      varying float vAmount;

      void main() {
        float alive = usAlive(aStart, aEnd, aTerminal, aFrom);

        // Each particle has its own moment within the dispersal, so the sheet
        // comes apart as a field of dots rather than as one rigid fade.
        float lift = clamp((uInk - aDelay * 0.34) / 0.66, 0.0, 1.0);
        lift = lift * lift * (3.0 - 2.0 * lift);

        vec3 p = position;
        float reach = uInkSpread * uSheetScale * (0.45 + aDelay * 1.15);
        p.xy += aDirection * lift * reach;
        // A little height, so the cloud has volume when the camera is not
        // perfectly overhead and so the dots pass in front of one another.
        p.z += lift * 0.55 * (0.25 + aDelay);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        float grow = 1.0 + lift * 1.7;
        gl_PointSize = uPointSize * uPixelScale * grow;

        vAlive = alive;
        // The dots are only ever *material in flight*. They are invisible when
        // the sheet is settled, which is what makes the transition read as the
        // same substance changing state rather than as an effect laid on top.
        vAmount = alive * smoothstep(0.015, 0.45, uInk) * (1.0 - smoothstep(0.86, 1.0, uInk) * 0.25);
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      varying float vAlive;
      varying float vAmount;

      void main() {
        if (vAmount <= 0.002) discard;

        vec2 offset = gl_PointCoord - 0.5;
        float distance = length(offset);
        // Soft-edged, because a hard-edged square is a sprite and a soft-edged
        // point is a speck of pigment.
        float mask = 1.0 - smoothstep(0.22, 0.5, distance);
        if (mask <= 0.002) discard;

        vec3 paper; vec3 ink; vec3 accent; vec4 style; vec4 tone;
        usChapterMix(paper, ink, accent, style, tone);

        vec3 col = mix(ink, accent, tone.x * 0.35);
        gl_FragColor = vec4(col, mask * vAmount * 0.85);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  points.frustumCulled = false;
  points.name = 'dots';

  return { points, material, uniforms, count };
}
