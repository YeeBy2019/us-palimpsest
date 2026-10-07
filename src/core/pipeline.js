/**
 * The render stage: one target, one composite, and a governor that degrades
 * quality instead of dropping frames.
 *
 * The atlas draws a fixed picture of a fixed sheet. There is no depth sorting
 * to do, no shadow map to render, no second camera. So the frame is short and
 * the whole budget goes on resolution and on the shaders — which is exactly the
 * trade a paper-and-ink look wants.
 *
 * One note on the WebGL setup, because it is a real hazard on Windows: the
 * materials here are patched at compile time, and the first draw would link
 * every program serially on the main thread. The reference project measured
 * that at fifteen seconds on Windows/ANGLE. `warmUp()` exists for that and is
 * called by the loader before the first visible frame; see the loading section
 * of docs/ARCHITECTURE.md.
 */

import * as THREE from 'three';

import { clamp } from '../lib/math.js';
import { createComposite } from './post.js';

/** Frame budget, in milliseconds. 60 fps is the target on a mid-range laptop. */
const BUDGET_MS = 1000 / 60;

/** Below this, the sheet stops reading as paper and starts reading as a smear. */
const MIN_SCALE = 0.5;

/** Above this there is nothing to gain: at 2x device pixels 4x MSAA is invisible. */
const MAX_DPR = 2;

const WINDOW_SECONDS = 1.5;

/**
 * Adaptive render scale.
 *
 * Judges whole 1.5-second windows rather than individual frames. A short window
 * that happens to contain two late frames reads as overload and would cost the
 * entire frame its sharpness; the long window is what stops the governor
 * reacting to its own noise. Lone stalls — a shader compiling, a chunk
 * arriving — are ignored for the same reason.
 */
class Governor {
  constructor(apply) {
    this.apply = apply;
    this.scale = 0.9;
    this.frames = [];
    this.elapsed = 0;
    this.cleanWindows = 0;
    this.probeStep = 0.05;
    this.probeWait = 5;
    this.direction = 0;
  }

  /** Report a frame. `suppress` marks frames our own resize is responsible for. */
  sample(dt, suppress = false) {
    if (suppress) return;

    this.frames.push(dt * 1000);
    this.elapsed += dt;
    if (this.elapsed < WINDOW_SECONDS) return;

    const frames = this.frames;
    const missedShare = frames.length > 0 ? this.#missedShare(frames) : 0;
    const p90 = frames.length > 0 ? this.#percentile(frames, 0.9) : 0;
    this.frames = [];
    this.elapsed = 0;

    if (frames.length < 10) return;

    // A window with a lone stall in it is not an overloaded window.
    const stalled = p90 > BUDGET_MS * 2.5 && missedShare < 0.12;
    if (stalled) return;

    let next = this.scale;

    if (p90 > BUDGET_MS * 1.25) {
      // Over budget: give up 12 per cent of resolution, which is where the
      // difference starts being visible but is not yet a step change.
      next = this.scale * 0.88;
      this.cleanWindows = 0;
      this.direction = -1;
    } else if (missedShare > 0.08) {
      // Only a few frames late: the scale is close, so nudge it.
      next = this.scale * 0.95;
      this.cleanWindows = 0;
      this.direction = -1;
    } else {
      this.cleanWindows++;
      // Probe back up only after a run of clean windows, and never immediately
      // after stepping down — otherwise the scale oscillates between two values
      // and every visit spends its first seconds at the wrong quality.
      if (this.cleanWindows >= this.probeWait) {
        next = this.scale + this.probeStep;
        this.direction = 1;
        this.cleanWindows = 0;
      }
    }

    next = clamp(next, MIN_SCALE, 1);

    if (Math.abs(next - this.scale) < 0.005) {
      if (this.direction === 1) {
        // The probe failed: it is as sharp as this machine holds. Halve the
        // step and wait twice as long before trying again, so it settles rather
        // than hunting.
        this.probeStep = Math.max(0.01, this.probeStep * 0.5);
        this.probeWait = Math.min(40, this.probeWait * 2);
      }
      this.cleanWindows = 0;
      return;
    }

    if (this.direction === 1 && next <= this.scale) {
      this.probeStep = Math.max(0.01, this.probeStep * 0.5);
      this.probeWait = Math.min(40, this.probeWait * 2);
      return;
    }

    this.scale = next;
    this.apply(next);
  }

  #missedShare(frames) {
    let missed = 0;
    for (const frame of frames) if (frame > BUDGET_MS * 1.35) missed++;
    return missed / frames.length;
  }

  #percentile(frames, p) {
    const sorted = [...frames].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }
}

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      // The sheet is composited by draw order, not by depth, so the buffer is
      // one more thing to allocate and clear every frame for no reason.
      depth: false,
      powerPreference: 'high-performance',
    });
    this.renderer.toneMapping = THREE.NoToneMapping;
    // The surface the sheet lies on. Must match `--paper-deep` in `ui/ui.css`,
    // or the paper's torn edge ends in a visible rectangle where the canvas
    // meets the page.
    this.renderer.setClearColor(0xd8c7a4, 1);

    this.composite = createComposite();
    this.target = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });

    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.cssWidth = 1;
    this.cssHeight = 1;
    this.framesSinceResize = 0;

    this.governor = new Governor((scale) => {
      this.#resizeTarget(scale);
    });

    /** Device pixels per CSS pixel of the on-screen canvas, for point sizing. */
    this.pixelScale = this.dpr;
  }

  /** The render scale currently in use, 0.5..1. */
  get scale() {
    return this.governor.scale;
  }

  setSize(cssWidth, cssHeight) {
    this.cssWidth = Math.max(1, Math.floor(cssWidth));
    this.cssHeight = Math.max(1, Math.floor(cssHeight));

    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.cssWidth, this.cssHeight, false);

    this.#resizeTarget(this.governor.scale);

    this.composite.uniforms.uAspect.value.set(
      this.cssWidth / Math.max(1, this.cssHeight),
      1,
    );
  }

  #resizeTarget(scale) {
    const width = Math.max(2, Math.round(this.cssWidth * this.dpr * scale));
    const height = Math.max(2, Math.round(this.cssHeight * this.dpr * scale));
    this.target.setSize(width, height);

    this.composite.uniforms.uScene.value = this.target.texture;
    this.composite.uniforms.uTexel.value.set(1 / width, 1 / height);
    this.pixelScale = this.dpr * scale;

    // The frames this resize costs are ours, not the machine's. Counting them
    // would make the governor react to its own decisions.
    this.framesSinceResize = 4;
  }

  /**
   * Link every program before the first visible frame.
   *
   * On Windows/ANGLE, letting the first draw link a hundred programs serially
   * freezes the loader for fifteen seconds and more. `compileAsync` links them
   * off the main thread, and drawing each object once spreads the remaining
   * per-object work — texture upload, buffer residency — across several frames
   * instead of landing it in one.
   */
  async warmUp(scene, camera, { slices = 6 } = {}) {
    const objects = [];
    scene.traverse((object) => {
      if (object.isMesh || object.isPoints || object.isLine) objects.push(object);
    });

    try {
      await this.renderer.compileAsync(scene, camera);
    } catch {
      // compileAsync needs KHR_parallel_shader_compile; without it three falls
      // back to a synchronous compile, which is slower but correct.
      this.renderer.compile(scene, camera);
    }

    const perSlice = Math.max(1, Math.ceil(objects.length / slices));
    for (let start = 0; start < objects.length; start += perSlice) {
      const visible = objects.map((object, index) => {
        const on = index >= start && index < start + perSlice;
        const had = object.visible;
        object.visible = on;
        return [object, had];
      });
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(scene, camera);
      for (const [object, had] of visible) object.visible = had;
      // Yield to the event loop so the loader keeps answering clicks while the
      // world warms up.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    this.renderer.setRenderTarget(null);
  }

  /** Draw one frame. Returns the frame time in milliseconds. */
  render(scene, camera, dt) {
    const started = performance.now();

    this.renderer.setRenderTarget(this.target);
    this.renderer.clear(true, false, false);
    this.renderer.render(scene, camera);

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.composite.scene, this.composite.camera);

    const spent = performance.now() - started;
    const suppress = this.framesSinceResize > 0;
    if (suppress) this.framesSinceResize--;
    this.governor.sample(dt, suppress);

    return spent;
  }
}
