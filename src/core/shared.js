/**
 * One set of uniforms, and the patch that gets them into every material.
 *
 * A chapter change has to reach the whole frame in a single frame. If each
 * material kept its own copy of the paper tint and the hatch density, a
 * transition would arrive in pieces — one object changing before its neighbour
 * — and the illusion that the whole sheet is one substance would die in the
 * half-second it took to finish.
 *
 * So there is exactly one uniform object in the project, and every material
 * reads it. `env/chapter.js` is the only thing that writes to it.
 *
 * The chapter itself is a **weight vector, not a switch**: `uChapter` holds up
 * to four weights, and the shader blends four whole sets of material values by
 * them. Cross-chapter blending is then not a feature anyone had to write, it is
 * what the arithmetic already does.
 */

import * as THREE from 'three';

/** How many chapter material slots the shader can blend at once. */
export const CHAPTER_SLOTS = 4;

/**
 * World units per sheet unit.
 *
 * The sheet is defined as exactly one unit wide (see the pipeline's `fitSheet`),
 * which makes every measurement in this codebase readable as a fraction of the
 * map — hatch spacing, line weight, bleed radius. That is a good space to think
 * in and a bad space to hand to a renderer, so the geometry is built in world
 * units of this size and the shaders convert back with `uSheetScale`.
 */
export const SHEET_SCALE = 20;

const colorSlot = () => new THREE.Color();
const fillSlots = (factory) => Array.from({ length: CHAPTER_SLOTS }, factory);

/**
 * The one set of uniforms. Every patched material reads this object; nobody
 * else writes it.
 */
export const U = {
  /** Seconds since the first frame. Only ever used for drift, never for timing. */
  uTime: { value: 0 },

  /**
   * The date cursor, as a fractional year. This is the atlas's real axis: the
   * boundaries are not a sequence of stored frames, they are a function of this
   * number, so ink genuinely grows rather than switching.
   */
  uDate: { value: 1861.28 },

  /** Length of the fade a boundary has when it arrives or leaves, in years. */
  uAppearWindow: { value: 0.9 },

  /** Dot dispersal. 0 settled, 1 fully dispersed. The only transition device. */
  uInk: { value: 0 },

  /** How far dispersed matter flies, in sheet units. */
  uInkSpread: { value: 0.06 },

  /** Paper grain depth. */
  uPaper: { value: 0.5 },

  /** Global multiplier on hatch density. */
  uHatch: { value: 1 },

  /** Hand-drawn edge wobble amplitude, in world units. */
  uWobble: { value: 0.02 },

  /** World units per sheet unit. Lets shaders work in sheet space and draw in world space. */
  uSheetScale: { value: SHEET_SCALE },

  /**
   * World units covered by one CSS pixel, at the sheet's own depth.
   *
   * Line weights are authored in CSS pixels — a chapter's ink is 1.1 to 2.2 of
   * them — because that is the only unit in which "a hairline" means the same
   * thing on a laptop and on a 4K panel. The shader works in world units, so
   * this is the exchange rate, and it is recomputed whenever the viewport or the
   * camera's framing changes.
   *
   * Note it does *not* include the governor's render scale: the line keeps its
   * size on screen as the render resolution drops, and only its sampling
   * coarsens. Folding the scale in here would make the ink thicken and thin as
   * the frame rate changed, which is the one thing a printed plate never does.
   */
  uWorldPerPixel: { value: 0.02 },

  // ---- the chapter, as four blended material slots ----------------------

  /** Weights over the four slots. They are kept summing to one. */
  uChapter: { value: new THREE.Vector4(1, 0, 0, 0) },

  /** Paper tint per slot, linear RGB. */
  uPaperTint: { value: fillSlots(colorSlot) },

  /** Engraved line colour per slot. */
  uInkTint: { value: fillSlots(colorSlot) },

  /** The hue a chapter may reach for. Kept separate from the ink so it can be withheld. */
  uAccentTint: { value: fillSlots(colorSlot) },

  /**
   * Per slot: x = hatch lines per sheet unit, y = hatch angle in radians,
   * z = line weight in sheet units, w = how far ink bleeds past a boundary.
   */
  uChapterStyle: { value: fillSlots(() => new THREE.Vector4(8, 0.4, 1.5, 0.8)) },

  /** Per slot: x = accent mix, y = grain depth, z = wash strength, w = unused. */
  uChapterTone: { value: fillSlots(() => new THREE.Vector4(0.3, 0.4, 0.5, 0)) },
};

/**
 * Load a chapter's material into one of the four slots.
 *
 * Slot contents are plain numbers and colours, so this costs a few writes and
 * happens only on a chapter change — never per frame.
 */
export function writeChapterSlot(chapter, slot) {
  const m = chapter.material;
  U.uPaperTint.value[slot].setHex(m.paper, THREE.SRGBColorSpace);
  U.uInkTint.value[slot].setHex(m.ink, THREE.SRGBColorSpace);
  U.uAccentTint.value[slot].setHex(m.accent, THREE.SRGBColorSpace);
  U.uChapterStyle.value[slot].set(m.hatchScale, m.hatchAngle, m.lineWeight, m.bleed);
  U.uChapterTone.value[slot].set(m.accentMix, m.grain, 1, 0);
}

/**
 * Shared GLSL. Everything the atlas draws is made of the same four things —
 * paper fibre, ink, hatch, and a hand that is not quite steady — so they live
 * here once rather than in three materials.
 *
 * A hazard worth naming, because it has cost two debugging cycles already:
 * **these blocks are JavaScript template literals, so a backtick inside a GLSL
 * comment ends the string.** The file then fails to parse with an error that
 * points at whatever identifier happened to follow, which reads like a typo in
 * working code. Never put a backtick in a GLSL comment; write the name plain.
 */
export const GLSL_COMMON = /* glsl */ `
// Every shared uniform is declared here, in the chunk both stages receive.
// three.js only uploads uniforms that exist in the compiled program, so a
// uniform that is used but never declared silently reads as zero — which looks
// like a design decision rather than a bug, and costs an afternoon.
uniform float uTime;
uniform float uDate;
uniform float uAppearWindow;
uniform float uInk;
uniform float uInkSpread;
uniform float uPaper;
uniform float uHatch;
uniform float uWobble;
uniform float uSheetScale;
uniform float uWorldPerPixel;

uniform vec4 uChapter;
uniform vec3 uPaperTint[${CHAPTER_SLOTS}];
uniform vec3 uInkTint[${CHAPTER_SLOTS}];
uniform vec3 uAccentTint[${CHAPTER_SLOTS}];
uniform vec4 uChapterStyle[${CHAPTER_SLOTS}];
uniform vec4 uChapterTone[${CHAPTER_SLOTS}];

float usHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float usNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = usHash21(i);
  float b = usHash21(i + vec2(1.0, 0.0));
  float c = usHash21(i + vec2(0.0, 1.0));
  float d = usHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float usFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * usNoise(p);
    p = p * 2.03 + vec2(11.3, 7.1);
    a *= 0.5;
  }
  return v;
}

// Hand-drawn wobble, as a displacement of a point. It is a function of the
// point's *position* and nothing else, which is what keeps the fill and the
// outline registered: both meshes compute the same offset for the same point,
// so the ink cannot drift off its own territory.
vec2 usWobble(vec2 world) {
  vec2 s = world / uSheetScale;
  vec2 coarse = vec2(usNoise(s * 24.0), usNoise(s * 24.0 + vec2(19.3, 7.7))) - 0.5;
  vec2 fine = vec2(usNoise(s * 82.0 + vec2(3.1, 0.0)), usNoise(s * 82.0 + vec2(0.0, 5.9))) - 0.5;
  return (coarse + fine * 0.35) * uWobble;
}

// Hatching, in sheet space: parallel lines that are not quite parallel.
//
// The first argument pair is the hatch field — lines per sheet unit, and the
// angle they run at. The second is the ink's width in CSS pixels. That width
// used to be a fraction of the period, and it is worth recording why that was
// wrong, because the failure did not look like a bug: at eleven lines across a
// thousand-pixel map, a third of a period is a thirty-pixel band with a
// twenty-pixel soft edge, so the hatching rendered as a broad diagonal gradient
// and the land came out blotchy and pale. Hatching has to know how big a pixel
// is, or it is not hatching.
float usHatch(vec2 sheet, float scale, float angle, float widthPx) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 r = vec2(sheet.x * c - sheet.y * s, sheet.x * s + sheet.y * c);

  // One pixel expressed in periods of the hatch, and in r.y units. Everything
  // below is measured against these two, which is what keeps the hatching's
  // character fixed as the density or the window size changes.
  float aa = (uWorldPerPixel / uSheetScale) * scale;
  float pixel = aa / scale;

  // The hand is not steady: the lines wander a pixel or two out of true, over a
  // wavelength much longer than their own spacing. A wander proportioned to the
  // spacing instead — which is what this was — is invisible when the lines are
  // far apart and turns them to mush when they are close.
  r.y += (usNoise(sheet * 9.0) - 0.5) * (2.5 * pixel);

  // Half the ink's width. The band a line covers comes out widthPx wide, because
  // d is a distance to the nearest line and so runs over half a period.
  float halfInk = widthPx * 0.5 * aa;
  float f = fract(r.y * scale);
  float d = min(f, 1.0 - f);
  return 1.0 - smoothstep(halfInk - aa * 0.5, halfInk + aa * 0.5, d);
}

// Paper fibre: two scales that do not share a period, so the eye cannot find
// the repeat. One is the tooth of the sheet, the other is the fibre in it.
float usPaperGrain(vec2 sheet, float depth) {
  float tooth = usFbm(sheet * 160.0);
  float fibre = usNoise(vec2(sheet.x * 900.0, sheet.y * 26.0));
  return mix(1.0, 0.86 + 0.28 * (tooth * 0.72 + fibre * 0.28), depth);
}

// The chapter, blended across its slots. Every material ends up calling this,
// which is why a chapter change is one uniform write rather than four thousand.
void usChapterMix(
  out vec3 paper, out vec3 ink, out vec3 accent,
  out vec4 style, out vec4 tone
) {
  paper = vec3(0.0);
  ink = vec3(0.0);
  accent = vec3(0.0);
  style = vec4(0.0);
  tone = vec4(0.0);
  for (int i = 0; i < ${CHAPTER_SLOTS}; i++) {
    float w = uChapter[i];
    if (w <= 0.0) continue;
    paper += uPaperTint[i] * w;
    ink += uInkTint[i] * w;
    accent += uAccentTint[i] * w;
    style += uChapterStyle[i] * w;
    tone += uChapterTone[i] * w;
  }
}
`;

/**
 * The date mask: is this thing on the sheet right now, and how strongly.
 *
 * `aStart` and `aEnd` are the boundary version's own validity, in fractional
 * years, taken straight from AHCB's `START_N` / `END_N` (see `lib/dates.js` for
 * the two forms and why they are kept apart). So the mask is a function of the
 * date cursor, which is why the boundary can grow rather than pop: the date
 * moves continuously and so does the ink.
 *
 * `aTerminal` marks a feature that is still alive when the chapter ends — the
 * chapter's own boundary clips it, not history. Those must not fade out, or a
 * chapter would dissolve into nothing on its last day.
 *
 * `aFrom` is that same idea at the other end, and it is not optional. A
 * chapter's geometry is cut to the chapter, so the first boundary version in
 * every bundle starts exactly on the chapter's opening date. Applying the
 * appear window to it would mean every chapter opened on blank paper and took
 * a year to ink itself in — the viewer arrives to an empty sheet and has to
 * wait for history to happen. So the fade belongs to boundaries that *begin*
 * inside the chapter; a line that was already drawn when the chapter opened is
 * already drawn on the first frame.
 */
export const GLSL_DATE_MASK = /* glsl */ `
float usAliveAt(float start, float end, float terminal, float from, float date) {
  float appear = mix(1.0, smoothstep(start, start + uAppearWindow, date), from);
  float retreat = 1.0 - terminal;
  float vanish = 1.0 - retreat * smoothstep(end - uAppearWindow, end, date);
  return appear * vanish;
}

float usAlive(float start, float end, float terminal, float from) {
  return usAliveAt(start, end, terminal, from, uDate);
}
`;

/**
 * The date attributes every boundary vertex carries, in the forms the two
 * shader stages need them in.
 *
 * Kept together and shared, because getting them out of step between two
 * materials produces a shader that links but draws the wrong century — and
 * because `attribute` declarations are vertex-stage only, which is exactly the
 * kind of thing that is easy to get wrong once and then copy.
 */
export const GLSL_DATE_ATTRIBUTES = /* glsl */ `
attribute float aStart;
attribute float aEnd;
attribute float aTerminal;
attribute float aFrom;
varying float vStart;
varying float vEnd;
varying float vTerminal;
varying float vFrom;
`;

export const GLSL_DATE_TRANSFER = /* glsl */ `
vStart = aStart;
vEnd = aEnd;
vTerminal = aTerminal;
vFrom = aFrom;
`;

export const GLSL_DATE_VARYINGS = /* glsl */ `
varying float vStart;
varying float vEnd;
varying float vTerminal;
varying float vFrom;
`;

/**
 * Patch a built-in three.js material, keeping its lighting and its pipeline and
 * adding ours.
 *
 * `customProgramCacheKey` is not optional. three.js caches compiled programs and
 * will happily hand an object a program built from a different set of injected
 * code unless the key says otherwise. The symptom is one object rendering with
 * another object's shader, which is close to impossible to read backwards from
 * the picture, so the key is built from the patch name and its defines.
 *
 * `defines` lands on the material itself rather than on the shader object inside
 * the callback, and that is deliberate. three.js builds its program parameters
 * in `getParameters` as `defines: material.defines` and computes the program
 * cache key straight afterwards — *before* `onBeforeCompile` runs. A define
 * added in the callback therefore still compiles, but it is invisible to three's
 * own cache key and, on a stock material where `material.defines` is undefined,
 * assigning to it throws. Putting it on the material keeps it upstream of both.
 */
export function patchMaterial(material, options) {
  const {
    name,
    defines = {},
    uniforms = {},
    vertexCommon = '',
    vertexBody = '',
    fragmentCommon = '',
    fragmentBody = '',
  } = options;

  material.defines = { ...material.defines, ...defines };

  material.onBeforeCompile = (shader) => {
    // `shader` here *is* the parameters object three will build the program
    // from, and `shader.uniforms` is already a fresh clone it owns (see
    // `getUniforms`), so writing into it reaches the program and nothing else.
    // The same uniform *objects*, not copies: this is what makes one write
    // reach every material in the scene.
    Object.assign(shader.uniforms, U);
    // Material-local uniforms go in afterwards. A layer that needs its own
    // clock — the anchor layer runs on a pinned date, not the cursor — owns a
    // differently-named uniform rather than fighting for a shared one.
    Object.assign(shader.uniforms, uniforms);
    shader.defines = { ...shader.defines, ...defines };

    const vertexPrelude = `${GLSL_COMMON}\n${vertexCommon}`;
    const fragmentPrelude = `${GLSL_COMMON}\n${GLSL_DATE_MASK}\n${fragmentCommon}`;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexPrelude}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentPrelude}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragmentBody}`);
  };

  material.customProgramCacheKey = () =>
    `us|${name}|${Object.entries(defines)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')}`;

  return material;
}
