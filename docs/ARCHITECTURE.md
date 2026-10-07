# How us-palimpsest is built

The technical architecture, settled before the M0 vertical slice so that the slice is cheap to
build and the shader work is not done twice.

This document is written to be revised. Settled decisions are dated, so that a later reversal is
visible rather than silent. Where a decision is still open it says so.

The shape of it comes from [sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) — about
10,500 lines of plain JavaScript on three.js, no framework, no engine, one runtime dependency.
It is the closest published match to what we are building: a single authored scene, hand-made
materials, one transition device, a fixed navigation path, and a look that has to survive contact
with a laptop GPU. Its [`docs/ARCHITECTURE.md`](https://github.com/billpwchan/sakura-fantasy/blob/main/docs/ARCHITECTURE.md)
is the model for this file.

No code is copied from it. What we take is structure.

## The decisions we take from it

| Decision | Why it matters here |
| -------- | ------------------- |
| **No framework, no engine** — plain ES modules on three.js | The look is the product. A framework's abstractions sit between us and the shader. The reference carries ~10.5k lines on one dependency; we have no reason to spend that budget on scaffolding. |
| **One set of uniforms drives every material** | A chapter change must reach the whole frame in one frame. If each material holds its own state, a sequence transition arrives in pieces and the illusion dies. |
| **Chapters are a weight vector, not a switch** | The reference's season is a `vec4` of weights easing toward a one-hot target; its weather is a set of target values. This is exactly our chapter model, and it gives cross-chapter blending for free. |
| **Patch built-in materials instead of writing custom ones** | `onBeforeCompile` injects the shared world into three.js's own materials, keeping their pipeline and their uniform plumbing, and we add paper, ink and hatching. The *sheet* is then left unlit on purpose — see the decision log. |
| **The interface is DOM and CSS, never WebGL** | The reference's loader, chapter cards, page-turn, dock and about sheet are HTML, CSS and inline SVG. Only the world is WebGL. Text stays crisp, the DOM stays accessible, and UI iteration costs seconds. |
| **A render-scale governor instead of dropped frames** | Quality degrades, frames do not. Measured over a 1.5 s window, not per frame. |
| **Quick tier draws the first frame; detail streams behind it** | Directly serves the M0 success criterion — something on screen, and looking right, fast. |
| **The view lives in the URL** | The reference's address bar always carries place, season, hour and weather. A share link *is* the capture. For us this is how a reviewer opens chapter 3 on 12 April 1861 without clicking anything. |
| **An offline `pipeline/` directory owns every byte of derived content** | The reference builds its plant atlases, boat and audio there. Ours builds the boundary geometry. Generated output is never committed. |

## The frame

```mermaid
flowchart LR
  P[Paper pass<br/>the drawn plane, paper grain] --> B[Boundaries<br/>per-date outlines, hatching]
  B --> A[Anchors<br/>retained states, sediment]
  A --> F[FX<br/>dots, city lights, ink bloom]
  F --> C[Composite<br/>grade, grain, sharpen upscale]
```

Every pass draws into a render target; one composite shader goes to the canvas. The reference's
last pass does tone mapping, white balance, a split grade, vignette, film grain and a sharpening
upscale from the render scale in a single shader. We do the same, with the paper's own grain
folded in rather than layered on top.

Unlike the reference we do not copy colour and depth into a second target: we have no water to
draw on top of the opaque scene, so the extra pass buys nothing. Revisit if M4 (the camera dive)
needs refraction or depth-driven effects.

## One set of uniforms

`core/shared.js` holds a single exported uniform object. Every patched material reads it.

```js
export const U = {
  uTime:    { value: 0 },
  uChapter: { value: new THREE.Vector4(1, 0, 0, 0) }, // chapter weights, eased toward one-hot
  uDate:    { value: 0 },                             // fractional year, drives boundary growth
  uInk:     { value: 0 },                             // dot dispersal, 0 settled .. 1 dispersed
  uPaper:   { value: 0 },                             // paper grain depth
  uHatch:   { value: 0 },                             // hatch density within the chapter's material
  // ... plus the two or three hues the chapter system is allowed to reach for
};
```

`env/chapter.js` owns the chapter, the date and the transition. It eases toward targets and then
writes the uniforms once per frame — the same contract as the reference's `env/environment.js`.

Two rules this implies, both learned from the reference:

- **Fixed-size loops only.** The reference caps its lamps at a constant and loops to that constant
  so the shader programs never recompile when a light comes on. Any per-element loop we add —
  anchors, lamps, city lights — must be constant-count. The count is the budget.
- **A correct `customProgramCacheKey`.** When a material is patched differently for different
  objects, three.js will happily reuse a program compiled from different injected code unless the
  cache key includes the patch options. The reference builds the key from the patch flags. This bug
  shows up as one object rendering with another object's shader, and it is very hard to read back
  from the symptom.

## Where the interface lives

Everything except the world is DOM.

| Surface | Implementation |
| ------- | -------------- |
| Loader | Inline SVG, animated by `stroke-dashoffset` |
| Chapter card | HTML + CSS, per-character animation delays |
| Chapter-to-chapter transition | A full-bleed paper div, glyph inked in, then out |
| Chapter selector, dock | HTML buttons, state via CSS classes |
| Labels and annotations | MSDF text, but positioned from the DOM layer where possible |
| Photograph / share | `<canvas>` composite of the WebGL buffer, then download or `navigator.share` |

The reference draws its paper fibre as one inline SVG `feTurbulence` tile exposed as a CSS custom
property. For a project whose whole premise is paper, that trick is worth having in addition to the
shader's procedural grain: CSS gives every DOM surface the same substrate for free.

## Loading

Two tiers, in this order:

1. **First frame.** The current chapter's boundaries, the paper, the dot shader. Nothing else.
   Assets for this tier are compressed hard — the reference uses WebP textures and 1K KTX2.
2. **Behind it.** The remaining chapters, higher-detail geometry, labels and audio, streamed in
   while the first chapter is being read. The reference upgrades its boat and props the same way.

### Warming the shaders is not optional on Windows

This is the single most important operational note in this document, and it is a live hazard for
this project specifically.

The reference's comment, verbatim in effect: linking roughly a hundred programs inside the first
frame froze the loader for **fifteen seconds and more on Windows/ANGLE**, in the field. Our
developer machine is Windows. Our shader count is not small.

Its fix has three parts, all of which we adopt:

1. Link programs in parallel off the main thread with `renderer.compileAsync`, instead of letting
   the first draw link them serially.
2. Upload textures one per macrotask (`await new Promise(r => setTimeout(r))` between them) so the
   loader keeps answering clicks. A texture uploads the first time it is drawn, so the first frame
   otherwise pays for all of them at once.
3. Draw the world once in N slices of a few objects each, with frustum culling off, so the first
   draw of each object spreads across several frames instead of landing in one.

Steps 2 and 3 are the ones that are easy to skip and expensive to discover late.

## Quality governor

The reference's approach, which we adopt:

- Draw at a **render scale** between 0.5 and 1.0 of device pixels. Resolution reads as sharpness,
  so the scale is kept as high as the frame budget allows.
- Judge **full 1.5 s windows**, by p90 frame time and by the share of missed frames. A short window
  with two late frames reads as overload and costs the whole frame its sharpness — hence the long
  window.
- Step down 12% when p90 is over budget, 5% when only a few frames miss, so the scale settles just
  under what the GPU holds rather than well below it.
- After a run of clean frames, **probe back up**. A probe that fails halves the next step and
  doubles the wait, so the scale settles instead of oscillating.
- Ignore lone stalls (a shader compiling, a chunk uploading) and the frames its own resizes cost.
  Without this the governor reacts to its own noise.
- 2× MSAA instead of 4× on high-density screens: at 2× device pixels the two cannot be told apart,
  and the GPU time is better spent on resolution.

One thing the reference does *not* do, and we should: **persist the settled tier per browser.**
Otherwise every visit re-discovers it from the top and the first few seconds are always at the
wrong quality.

## Deep links

The URL is the state. Ours:

| Parameter | Meaning | Example |
| --------- | ------- | ------- |
| `chapter` | chapter id | `chapter=division` |
| `date` | a date inside the chapter, ISO | `date=1861-04-12` |
| `anchor` | which retained boundary states are shown | `anchor=1783,1861` |
| `tier` | `lo` forces the quick tier, `hi` streams full detail | `tier=lo` |
| `intro` | play the opening anyway, when a scene is set | `intro` |

So `?chapter=division&date=1861-04-12&anchor=1783,1861` opens directly on the M0 shot. That is the
acceptance test for M0 made linkable, which means it can also be put in a review comment.

## Module layout

```
index.html
vite.config.js
docs/
  ARCHITECTURE.md     this file
src/
  main.js             boot, the frame loop, input, the glue between systems
  core/
    pipeline.js       render passes, render scale, the frame-time governor
    post.js           the composite: tone map, paper grain, grade, sharpen upscale
    shared.js         one set of uniforms; the material patch
    assets.js         loaders and quality tiers
  env/
    chapter.js        chapter weights, palette, date -> the shared uniforms
  world/
    paper.js          the drawn plane: paper, engraved edge
    boundaries.js     interval-coded geometry -> the outline for a given date
    anchors.js        retained boundary states, settling into the paper
    labels.js         MSDF text, resolution independent
    camera.js         the camera director
  fx/
    dots.js           the dispersal device — the only transition
    citylights.js     settlement lights coming on
    inkbloom.js       a boundary growing, a stain spreading
  timeline/
    chapters.js       the eight chapters: years, material, anchors, audio
    narration.js      annotations and the chapter card copy
  audio/
    ambience.js       per-chapter ambience, crossfaded
  ui/
    ui.js             loader, chapter cards, selector, dock, deep links
    ui.css            the chrome's own paper
  lib/
    math.js
pipeline/             AHCB shapefile -> per-chapter TopoJSON bundles
public/assets/        fonts and textures that ship as-is
data/                 generated chapter bundles (not committed)
```

`fx/` is the reference's name for the layer that runs its motion in vertex shaders and only takes a
few weights from the CPU. Our dots must work the same way: the dispersal is the transition, it
happens for every anchor and every boundary at once, and it cannot be driven per-particle from
JavaScript.

## The offline pipeline

```
AHCB shapefile (142 MB, overlapping date-coded polygons)
  -> filter to a chapter's date range
  -> simplify with mapshaper, tolerance tuned per zoom tier
  -> quantize and encode as TopoJSON
  -> one bundle per chapter
```

Generated bundles are not committed. The pipeline directory is, and `npm run data:build`
regenerates them.

### Beyond 2000

Chapter 8 runs to the present and AHCB stops at 2000, so the period needs a second source. The two
sources have different shapes, and they are not interchangeable.

**NHGIS** (IPUMS, University of Minnesota) provides boundary files for states and counties back to
1790, tracts to 1910 and every other standard census unit from 1990. It is free of charge. It is
**not**, however, open-licensed for redistribution: the terms are a limited licence — citation
required, redistribution not permitted without permission, and altered data may not be redistributed
without renaming the dataset and shipping FGDC-compliant metadata. That is a different regime from
AHCB's CC0, and it decides what we can ship.

**So the geometry we distribute comes from TIGER/Line, not NHGIS.** TIGER/Line is a US Census Bureau
product and is not copyrighted — free to use in a product or publication with acknowledgement to the
Census Bureau. NHGIS's own documentation states that from 1990 onward its boundary files are derived
from TIGER/Line with only a few changes. Below 1990 TIGER/Line does not exist digitally and NHGIS is
doing real editorial work; from 1990 on it is largely a repackaging. The split follows the
information rather than the convenience:

| Layer | Source | Why |
| ----- | ------ | --- |
| Chapter 8 geometry, 1989–2000 | AHCB | already in hand, event-dated |
| Chapter 8 geometry, 2000–present | TIGER/Line | uncopyrighted, freely redistributable with acknowledgement |
| Population and settlement statistics, all chapters | NHGIS | the layer NHGIS uniquely provides |
| County geometry cross-check, 1790–2000 | NHGIS | a second reading of the same history |

Two consequences for the loader, and one freebie:

- **A second encoding.** AHCB is interval-coded — a polygon states when it began and ended, so any
  date can be derived. NHGIS and TIGER/Line publish **per-census snapshots** — 1990, 2000, 2010,
  2020 — with no record of what happened in between. Chapter 8 therefore interpolates between fixed
  states instead of growing continuously. That is honest rather than a compromise: the geometry
  barely moves, and a viewer scrubbing the present is reading a narrative, not watching counties
  redraw. The loader needs both paths; it must not assume interval coding.
- **A free cross-check.** AHCB and NHGIS overlap for 1790–2000. Where they disagree, that is worth
  knowing before the shape is baked into a chapter bundle.
- NHGIS ships its files already projected to Esri's USA Contiguous Albers Equal Area Conic — the same
  family as our EPSG:5070, which removes one reprojection step.

## What we do not take from the reference

Being explicit about this, because the two projects look similar from the outside and are not:

- **Worker-pool world generation.** Its valley is generated continuously and can be cut anywhere.
  Our subject is a discontinuous historical dataset with discrete political states; the geometry is
  built offline, once, and shipped. There is no runtime generation problem to solve.
- **Planar reflection, water, photogrammetry vegetation, a generative score.** Different domain. The
  pass architecture is instructive; the content is not.
- **Assets inside the repository.** Its repo is ~137 MB, of which ~142 MB of blobs are textures,
  models and media. It gets away with it because nothing in it exceeds GitHub's per-file limit. Ours
  would not: boundary data is large, and GitHub Pages caps a site at 1 GB with a 100 MB per-file
  limit and no LFS. Keep the current rule — data in its own directory, generated output ignored,
  LFS if it ever needs versioning.
- **Bundle size as a non-goal.** One dependency keeps its payload small. Ours is geometry, and the
  payload is the project. It is why `?tier=lo` exists and why per-chapter bundles are lazy.

## Animation

**Decision: GSAP, not hand-rolled easing.**

An earlier draft of this document argued the other way, on the reference's example. That argument was
reconsidered and dropped, and the reason is about this project rather than about the library.

The reference hand-rolls every easing — usually `x += (target - x) * (1 - Math.exp(-dt * k))` — and
it gets away with it because it never has to choreograph overlapping sequences. Its cinematic mode
cuts between six composed shots with a per-shot `u = t / dur` progress and a `snap` on the cut. That
is close to authored motion, and it is still not authored motion.

M4 here is authored motion. Flying the camera from the map into a historical scene is overlapping
timelines, staggered elements and hand-tuned curves — precisely the case a timeline library exists
for. Writing the camera director against `gsap.timeline` from M0 means it is written once, in the
vocabulary M4 needs, instead of being rewritten when the dives become real sequences.

How GSAP is used, three distinct roles:

- **Authored sequences** — chapter transitions, the camera director, the dot dispersal — are
  `gsap.timeline` with labels and eases.
- **Continuous state** — chapter weights, the date cursor, the camera following a drag — is
  `gsap.quickTo`, which re-aims a property at a new target each call rather than rebuilding a tween.
  This is the case that killed the original objection: the thing being animated moves, so the target
  is different every frame. `quickTo` is built for exactly that; it re-aims, it does not rebuild.
- **Snaps** — deep links and chapter jumps — are `gsap.set`, the instant path. Under the old scheme
  this was `env.update(0, true)`; the contract is the same, the syntax is shorter.

Three things we accept as the price:

- **A second runtime dependency.** The reference ships one. GSAP is small (~70 KB min, ~27 KB
  brotli) and is the only addition; the real payload here is geometry, not JavaScript.
- **`prefers-reduced-motion` becomes ours to honour.** GSAP has no opinion about it. The M5 checklist
  item is implemented as a global `gsap.ticker` gate rather than a per-tween opt-out, so no tween can
  be forgotten.
- **The uniform write stays ours.** `env/chapter.js` still eases what it owns and writes the shared
  uniforms once per frame. GSAP animates values; it does not own the uniform object, and no tween
  touches a uniform directly.

## Projection

Fixed for the whole atlas, decided before M0 draws its first coastline — it determines the paper's
aspect ratio and therefore the camera.

**Albers Equal-Area Conic, EPSG:5070 (NAD83 / Conus Albers) for the main field.** The published
national grid, and the projection the USGS, the Census Bureau and the *National Atlas of the United
States* use for country-scale maps. The property that matters here is area: Albers preserves it
exactly, so a state's drawn weight equals its real weight, which is the correct bias for a project
about territory.

**Web Mercator (EPSG:3857) is the standard for a different job, and the wrong one here.** It is
conformal — angle-preserving — which is what makes square map tiles work and why it is the standard
for slippy web maps. Its area error grows as 1/cos²(latitude): about 2× at 45°N, 4× at 60°N, 8.5× at
70°N. Alaska reaches 71°N. On a Mercator sheet Alaska would dominate the lower forty-eight, and every
chapter's territory would be mis-weighted in the same direction. Use it for tiles; not for this.

**Alaska and Hawaii are composited insets.** EPSG:3338 (Alaska Albers) for Alaska, a conic of its own
for Hawaii, arranged in the conventional composite layout — the one `d3-geo`'s `geoAlbersUsa`
implements, and the one every period US map carried. Forcing one projection across the full latitude
range is the alternative, and it distorts all three areas at once.

Two consequences worth stating:

- **An inset appearing is a boundary event, not a layout choice.** Alaska's panel appears at 1867,
  Hawaii's at 1898. Before those years there is nothing to inset.
- **The sheet grows, so the camera has to reframe.** Because the panels unfold rather than being
  reserved from the start, the sheet's extent changes inside Chapter 4 — twice, at 1867 and 1898.
  Framing is therefore not one fit-to-paper computation done at load: it re-fits when the sheet
  changes size, and that re-fit is the visible event. The base extent for the contiguous states is
  settled at M0, and each panel's extent with it.

The District of Columbia, 68 square miles, is a marker and a label at state-level simplification — no
geometry to derive and none to simplify.

## The anchor window

An anchor is a boundary state retained past the chapter that owns it, drawn as desaturated ink in the
chapter's own material — the same buffer as the live boundaries, at reduced weight and a third of the
opacity. It is line work, not a fill: a translucent polygon on an engraved plate reads as a
registration error. Its life:

- The chapter that owns it draws it at full strength.
- The **two chapters** after that draw it with a lighter hand, at decreasing opacity.
- From the third chapter on it is paper texture only: no geometry, no fill-rate cost.

Two things follow, and an earlier draft of the README stated them as separate rules when they are
not:

- **The visibility cap is the window, arithmetically.** A two-chapter window means the sheet never
  carries more than three anchors at once. "At most two or three visible" is not a second rule.
- **The window is counted in chapters, because chapters are the unit of navigation and carry their
  own time scales.** Counting in years would be incoherent: the 1783 anchor would persist for 82
  years across Chapters 2 and 3, while an anchor in Chapter 6 would be gone in four. What the
  palimpsest metaphor actually describes is *page distance* — how many pages ago you saw the ink —
  not elapsed time. The fade *rate* should still be tuned per chapter, since a chapter's number of
  years and its reading duration are unrelated.

## Decision log

Settled on 2026-10-06:

- **Plain JavaScript. No TypeScript.** The shader work lives in injected GLSL strings and uniform
  objects, where types earn little and cost friction.
- **The anchor window is counted in chapters, not years.** See above.
- **Alaska, Hawaii and the District of Columbia are in scope.** AHCB covers all fifty states and the
  District in the same release, and excluding them is not historically neutral — Chapter 4 acquires
  Alaska (1867) and Hawaii (1898), Chapter 6 opens on Pearl Harbor, the Aleutian campaign of 1942–43
  is the only fighting on North American soil, both become states in 1959, and the capital has been
  in the District since 1800.

Settled on 2026-10-07:

- **GSAP for camera and motion.** See *Animation* above. An earlier draft argued for hand-rolled
  easing; M4's authored scene dives are the reason that was reversed.
- **Albers Equal-Area Conic (EPSG:5070), with Alaska and Hawaii as insets.** See *Projection* above.
  The contiguous states are the main field; the District is a marker, not geometry.
- **The insets unfold when the date reaches them.** The sheet is not pre-sized to hold three panels.
  It grows at 1867 and again at 1898, and the camera reframes with it. The alternative — reserving
  the space from the first frame — would have shown an empty panel for a hundred and sixty years and
  wasted a third of the sheet doing it.
- **Post-2000 change comes from a second source**, but not the one first assumed: geometry from
  **TIGER/Line**, statistics and cross-checks from **NHGIS**. The licence difference decides it. See
  *Beyond 2000* above.

Settled while building M0 (2026-10-07):

- **The sheet is unlit. No lights in the scene at all.** Everything on it — grain, vignette, hatching,
  the torn edge — is drawn rather than illuminated, and a `MeshStandardMaterial` under an ambient
  light divides its albedo by pi on the way out. The first working build came out as grey card for
  exactly that reason: the chapter palettes were right and the lighting model was throwing a third of
  them away. The land, the paper and the lines are all `MeshBasicMaterial` now, so a chapter's colour
  is the colour it was written as. M4's scene dives are where a light will have something to fall on.
- **Line weights are authored in CSS pixels, not sheet units.** A chapter's ink is 1.1 to 2.2 of them,
  which is the only unit in which "a hairline" survives a change of monitor. `uWorldPerPixel` is the
  exchange rate, and it deliberately excludes the governor's render scale: the line keeps its size on
  screen as resolution drops, and only its sampling coarsens.
- **Hatching is measured in pixels too, and this one was a real bug.** The hatch's line width and
  antialiasing used to be fractions of the hatch period, which at eleven lines across a thousand-pixel
  map is a thirty-pixel band with a twenty-pixel soft edge — so the hatching rendered as a broad
  diagonal gradient and the land came out blotchy. Anything drawn as a line needs to know how big a
  pixel is. `hatchScale` is therefore in lines across the sheet, in the 60–400 range where hatching is
  legible on a screen rather than the hundreds-per-inch of a paper plate.
- **The appear window belongs to the chapter, not to history.** A chapter's geometry is cut to the
  chapter, so the earliest boundary version in every bundle starts on the chapter's opening date; a
  fade applied to that meant every chapter opened on blank paper for a year. Each vertex now also
  carries `aFrom`, and only a boundary that *begins* inside the chapter fades in. `aTerminal` is the
  same idea at the other end.
- **The date in a deep link is written to the day.** It used to be written to the month and read to
  the day, so the atlas handed out links it could not read back and a reload moved the date — for the
  1861 anchor, from the secession line to ten days before it. The reader still accepts a month or a
  bare year, because that is what a person types when passing a link on.

M0 is built end to end for **Chapter 2 Expansion (1783–1848)** and **Chapter 3 Division (1848–1865)** —
the vertical slice's success criterion is a fifteen-second capture of Chapter 3. Nothing on the
pre-M0 decision list is outstanding. What remains is implementation-shaped: the remaining six
chapters' bundles, the sheet growing for the Alaska and Hawaii insets, and the quality tiers with
their persistence (M5).

## Attribution

The architecture of this project is our own, informed by studying
[sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) by Bill Chan (MIT). No source code
was copied. If any is ever adapted, its MIT notice must be carried in `NOTICE.md` alongside the
existing third-party data terms.
