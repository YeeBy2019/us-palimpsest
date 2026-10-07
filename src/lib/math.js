/** Small numeric helpers. Nothing here is worth a dependency. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const inverseLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

/**
 * Frame-rate independent easing toward a target.
 *
 * `lambda` is roughly "how many e-folds per second": 3 is a slow settle, 12 is
 * almost immediate. Because it is expressed with `exp(-dt * lambda)` the result
 * is the same at 30 fps and 144 fps, which is why every continuous value in
 * the project uses this rather than a per-frame fraction.
 */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

/** A smooth 0..1 ramp that is flat at both ends — the usual ease-in-out. */
export const easeInOut = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Positive modulo. */
export const mod = (a, n) => ((a % n) + n) % n;

/**
 * Deterministic pseudo-random in [0, 1) from an integer. Used to give each
 * boundary version a stable personality — the same seed produces the same
 * scatter on every load, so a reload does not reshuffle the map.
 */
export const hash1 = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
