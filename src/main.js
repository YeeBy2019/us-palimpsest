/**
 * Boot, the frame loop, input, and the glue between systems.
 *
 * The order here is the loading order, and the loading order is the point: the
 * opening chapter's geometry, the paper and the outlines are needed for the
 * first frame; everything else — the remaining chapters, the annotation layer,
 * a sound bed — streams in behind a picture that is already worth looking at.
 */

import * as THREE from 'three';

import { loadChapter, prefetchChapter } from './core/assets.js';
import { Stage } from './core/pipeline.js';
import { U } from './core/shared.js';
import { ChapterState } from './env/chapter.js';
import { buildDots } from './fx/dots.js';
import { BUILT_CHAPTERS } from './timeline/chapters.js';
import { HOLD_SECONDS, beatsFor, holdsFor, paceFor } from './timeline/narration.js';
import { Interface, parseDeepLink } from './ui/ui.js';
import { createAnchorMaterial, visibleAnchors } from './world/anchors.js';
import { buildBoundaries } from './world/boundaries.js';
import { applyParallax, createCamera, frameSheet, worldPerCssPixel } from './world/camera.js';
import { buildPaper } from './world/paper.js';

// `ui.css` is deliberately not imported here. It is a `<link>` in `index.html`,
// so the browser starts fetching it while it is still parsing the page; from
// here it could not begin until this module and three.js had been downloaded
// and run, and the chrome would spend that time on screen in the browser's own
// default style. See the `@layer boot` block in `index.html`.

/**
 * How many anchors can be on the sheet at once.
 *
 * Derived from the fade in `world/anchors.js` rather than chosen: a two-chapter
 * window over a set of chapters whose anchors each last three chapters can
 * never put more than three lines on the paper.
 */
const ANCHOR_SLOTS = 3;

const pointer = { x: 0, y: 0 };

async function boot() {
  const canvas = document.getElementById('scene');
  const stage = new Stage(canvas);

  const scene = new THREE.Scene();

  // No lights. Every material on the sheet is unlit by design: the paper, the
  // wash, the hatch and the engraved line are *drawn*, not illuminated, so a
  // chapter's palette reaches the screen as the numbers it was written with.
  // A `MeshStandardMaterial` plus an ambient light would divide the albedo by
  // pi and turn the whole atlas grey. M4's dive into historical scenes is where
  // a light has something with a shape to fall on.
  const camera = createCamera();

  const link = parseDeepLink();
  const opening =
    BUILT_CHAPTERS.find((chapter) => chapter.id === link.chapterId) ?? BUILT_CHAPTERS[0];
  if (!opening) throw new Error('no chapters have been built — run `npm run data:build`');

  const ui = new Interface(null);
  ui.setLoaderText('Grinding the ink');

  // ---- the quick tier: the opening chapter, and nothing else --------------

  const first = await loadChapter(opening.id);

  const paper = buildPaper(first.sheet);
  scene.add(paper.mesh);

  /** Anchor slots are shared across chapters: the sediment is the same ink. */
  const anchorSlots = Array.from({ length: ANCHOR_SLOTS }, () => createAnchorMaterial());
  const anchorMaterials = anchorSlots.map((slot) => slot.material);

  /** Built chapter layers, kept so a chapter change is a visibility flip. */
  const layers = new Map();

  async function ensureLayer(chapter) {
    const existing = layers.get(chapter.id);
    if (existing) return existing;

    const bundle = await loadChapter(chapter.id);
    const boundaries = buildBoundaries(bundle, { anchorMaterials });
    boundaries.group.visible = false;
    scene.add(boundaries.group);

    const dots = buildDots(boundaries.outlineGeometry);
    dots.points.visible = false;
    scene.add(dots.points);

    const layer = { ...boundaries, bundle, dots };
    layers.set(chapter.id, layer);
    return layer;
  }

  const firstLayer = await ensureLayer(opening);
  firstLayer.group.visible = true;
  firstLayer.dots.points.visible = true;

  // ---- state -------------------------------------------------------------

  // How a written chapter plays is the one thing the story layer asks of the
  // state machine, and it is set here rather than inside `ChapterState` so that
  // the state machine stays innocent of content: it is told a pace, a list of
  // dates, and how long to stand at them, and it never learns what is at any of
  // those dates. Set on both paths — the opening chapter and every arrival —
  // because timing that is only right at boot is timing that is wrong the first
  // time anyone navigates.
  function applyStoryTiming(chapter) {
    const beats = beatsFor(chapter);
    state.pace = paceFor(beats);
    state.holds = holdsFor(beats);
    state.holdSeconds = HOLD_SECONDS;
  }

  const state = new ChapterState(opening);
  if (link.year !== null) state.snap(opening, link.year);
  applyStoryTiming(opening);

  ui.state = state;
  ui.mount();

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    stage.setSize(width, height);
    frameSheet(camera, first.sheet, width / Math.max(1, height));
    // After `frameSheet`, because it is what sets the camera's distance — and
    // the pixel scale is a function of that distance.
    U.uWorldPerPixel.value = worldPerCssPixel(camera, height);
  };
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
  });

  // A chapter change has to be covered by the dispersal, so the incoming
  // chapter's layer must be on the sheet *before* the timeline starts rather
  // than appearing part-way through it.
  state.onChange((chapter) => {
    const layer = layers.get(chapter.id);
    if (layer) layer.group.visible = true;
    applyStoryTiming(chapter);
  });

  // ---- warm the shaders, then draw ---------------------------------------

  ui.setLoaderText('Inking the plate');
  await stage.warmUp(scene, camera);
  ui.setLoaderText('Pressing the sheet');
  await ui.hideLoader();

  if (link.intro) ui.announce(opening);

  let last = performance.now();
  let elapsed = 0;

  function frame(now) {
    // Clamped: a tab returning from the background must not advance the date by
    // the length of the nap.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    state.update(dt, elapsed);

    // The sediment has to be re-evaluated against the cursor every frame: an
    // anchor appears the instant its date passes, and fades as pages turn.
    const anchors = visibleAnchors(state.chapter, state.date, ANCHOR_SLOTS);
    for (let i = 0; i < anchorSlots.length; i++) {
      const slot = anchorSlots[i];
      const anchor = anchors[i];
      slot.uniforms.uAnchorDate.value = anchor ? anchor.year : 0;
      slot.uniforms.uAnchorStrength.value = anchor ? anchor.strength : 0;
      slot.uniforms.uWeightScale.value = anchor ? anchor.weight : 0.6;
    }

    // Visibility is "the one being read", plus the one arriving while a
    // transition is in flight — and nothing else.
    //
    // This used to read `settled ? active : true`, which was written when the
    // atlas had two chapters and showing both of them was the same thing as
    // showing the right two. At seven it is not: every loaded chapter would be
    // drawn at once, so the 1803 Mississippi line came back across the middle
    // of the 1989 map and the ink went about twice as dark for the length of
    // the dispersal. The lesson generalises — "all of them" is only ever
    // correct while the set is small enough to be the same as "the two that
    // matter".
    const settled = !state.isTransitioning;
    const reading = state.chapter.id;
    const arriving = state.partner?.id ?? null;
    for (const [id, layer] of layers) {
      const visible = settled ? id === reading : id === reading || id === arriving;
      layer.group.visible = visible;
      layer.dots.points.visible = visible;
    }

    for (const layer of layers.values()) {
      layer.dots.uniforms.uPixelScale.value = stage.pixelScale;
    }

    applyParallax(camera, pointer, dt);
    stage.render(scene, camera, dt);
    ui.syncDate(state.date);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // ---- behind the first frame --------------------------------------------

  for (const chapter of BUILT_CHAPTERS) {
    if (chapter.id === opening.id) continue;
    prefetchChapter(chapter.id);
    ensureLayer(chapter).catch(() => {
      // A missing sibling is not fatal: the atlas simply cannot travel there.
      ui.setLoaderText('');
    });
  }
}

boot().catch((error) => {
  console.error(error);
  const loaderText = document.getElementById('loader-text');
  if (loaderText) {
    loaderText.textContent = error?.message ?? String(error);
    loaderText.style.color = '#7a1e22';
    loaderText.style.textTransform = 'none';
    loaderText.style.letterSpacing = '0';
    loaderText.style.maxWidth = '42ch';
    loaderText.style.textAlign = 'center';
  }
});
