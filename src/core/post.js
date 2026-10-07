/**
 * The composite: one shader between the render target and the canvas.
 *
 * Everything the atlas draws lands in a half-float target at whatever render
 * scale the governor has settled on, and this pass does the rest — grade, paper
 * grain, and a sharpening upscale to the canvas.
 *
 * The sharpening is not a flourish, it is what makes the governor affordable.
 * Resolution reads as sharpness, and an unsharp mask recovers most of what a
 * reduced render scale gave away, so the governor can drop to 0.7 and the frame
 * still reads as crisp. Without it, the honest choice would be between full
 * resolution and a visibly soft picture, and the whole quality strategy would
 * have nothing to trade with.
 *
 * Colour management note: the target is linear and this shader converts to sRGB
 * itself. A custom `ShaderMaterial` gets none of three.js's automatic output
 * conversion, and asking for it twice would leave the sheet bleached.
 */

import * as THREE from 'three';

import { GLSL_COMMON, U } from './shared.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  ${GLSL_COMMON}

  uniform sampler2D uScene;
  uniform vec2 uTexel;
  uniform float uSharpness;
  uniform vec2 uAspect;

  varying vec2 vUv;

  vec3 fetch(vec2 uv) {
    return texture2D(uScene, uv).rgb;
  }

  void main() {
    vec3 centre = fetch(vUv);

    // Unsharp mask. Four taps, which at this stage is nearly free, and it is
    // doing the work the render scale would otherwise have to do alone.
    vec3 blur = (
      fetch(vUv + vec2(uTexel.x, 0.0)) +
      fetch(vUv - vec2(uTexel.x, 0.0)) +
      fetch(vUv + vec2(0.0, uTexel.y)) +
      fetch(vUv - vec2(0.0, uTexel.y))
    ) * 0.25;

    vec3 col = centre + (centre - blur) * uSharpness;

    // A gentle contrast curve. The plate is a printed thing, and printed things
    // have less latitude than a screen — the shadows close a little, the paper
    // holds its highlights.
    col = max(col, vec3(0.0));
    col = pow(col, vec3(0.965));
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

    // Film grain, at a scale tied to the canvas rather than the render scale, so
    // it does not change character when the governor moves.
    float grain = usNoise(vUv * uAspect * 1400.0 + vec2(7.3, 19.1)) - 0.5;
    col += grain * 0.014 * (0.55 + 0.45 * (1.0 - dot(col, vec3(0.333))));

    // Linear to sRGB, done here and only here.
    vec3 srgb = mix(
      col * 12.92,
      1.055 * pow(max(col, vec3(0.0001)), vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), col)
    );

    gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
  }
`;

export function createComposite() {
  const uniforms = {
    ...U,
    uScene: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uSharpness: { value: 0.62 },
    uAspect: { value: new THREE.Vector2(1, 1) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  return { scene, camera, material, uniforms };
}
