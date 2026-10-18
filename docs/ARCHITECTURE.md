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

### Exactly two chapters are on the sheet at a time

Every loaded chapter holds its own layer — a land fill, an outline and its share of the anchor slots
— and all of them sit in the scene from boot. So somebody has to decide, every frame, which of them
is drawn, and the answer is: the one being read, plus the one arriving if a transition is in flight.

`ChapterState.partner` is what makes that expressible. It names the *other* chapter in flight, and it
moves with the identity: before the swap the state's `chapter` is the outgoing one and the partner is
the incoming one; at the swap they trade, because `chapter` moves at the same instant the date does.
This is also why `isTransitioning` has to consult it. `blend` and `disperse` are written by GSAP, so
between `goTo` returning and the first tick both are still zero — for that one frame the state would
call itself settled while a transition was already running.

The renderer's rule used to read `settled ? active : true`. Written at two chapters, that says the
same thing as `active || arriving`, because the two sets are identical. At seven it does not: every
loaded chapter is drawn at once, so the 1803 Mississippi line returns across the middle of the 1989
map and the ink goes about twice as dark for the length of the dispersal. Measured over a
Chapter 2 → Chapter 8 transition, the peak frame of the dispersal dropped from 9.5% to 4.5% ink once
the rule was narrowed — and the settled frames were unchanged, which is the point: a steady state
should never have been at stake.

The general form of the mistake is worth keeping: *"all of them" is only ever correct while the set
is small enough to be the same as "the two that matter."*

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

### The stylesheet is linked from the HTML, not imported from JavaScript

`ui.css` is a `<link>` in `index.html`, not an `import` in `src/main.js`. Imported from JavaScript it
cannot begin downloading until the module graph behind it has been fetched and executed — here, that
means waiting for three.js — and the chrome is on screen in the browser's own default styling for
that whole time. It was: a white page with an Arial heading, a blue range input and two default
buttons. Measured at three frames spanning 52 ms on localhost, and at 195 frames spanning 3.2 s
under a throttled connection.

Linked from `<head>` the sheet is render-blocking, which is the point: the browser paints nothing
until it lands, so there is no unstyled frame to paint. A production build already behaved this way,
because one emits the sheet as a `<link>` in the head regardless of how the source imported it — so
the flash was development-only, which is also why it survived review. Two consequences:

- The link carries `?direct`, which is how Vite's dev server is told to answer with CSS rather than
  with a module that injects it. A `<link>` given a JavaScript module refuses it, and the app would
  then be unstyled in development and nowhere else. A build resolves the path and drops the suffix.
- `<head>` also carries a small `@layer boot` block that paints the paper and hides the chrome, for
  when the sheet fails outright. It sits in a cascade layer so that it loses to `ui.css` wherever a
  bundler decides to put it — unlayered declarations beat layered ones — instead of depending on
  arriving second. Checked by blocking the request: the page degrades to a plain sheet with the plate
  still drawn on it, and no default-styled controls anywhere.

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
| `still` | open the view without starting the film | `still` |
| `intro` | show the opening chapter card even with the film held still | `intro` |

So `?chapter=division&date=1861-04-12&anchor=1783,1861` opens directly on the M0 shot. That is the
acceptance test for M0 made linkable, which means it can also be put in a review comment. A shot that
is meant to be *looked at* rather than watched adds `&still` — and that is the point of the flag being
a word in the link: whoever receives it can see why the page is not moving.

`still` is a bare flag rather than a value, the same shape `intro` has, because it is a mode and not a
setting. `anchor`, `tier` and `intro` do not survive a reload — `#maybeWriteUrl` rewrites the query
string to the position within a quarter second of the first frame, which is deliberate: those three
are instructions about how to *arrive*, and the URL is meant to be a place. **`still` is carried
through**, because it is not an instruction about arriving — it decides what the page does once it is
there, so a URL that dropped it would be a copy of something else: hand it on and the page starts
moving, which is the same surprise as the one the date rule caused.

The writer's rule is one line and worth reading as a rule: **the day is recorded only while the cursor
is held.** Paused, scrubbed, or arrived by a chapter click, the URL carries `date` to the day, so a
pause is a link someone can be sent. While the film runs it carries the chapter alone. A reload of a
moving picture has always meant *start the reel again*, so there is nothing finer worth recording —
and the alternative is worse than wasteful: the cursor crosses a day in under a millisecond, so
writing it means four `history.replaceState` calls a second for twenty-four minutes. Safari throws a
`SecurityError` after a hundred in thirty seconds, and this runs inside the frame loop, so the first
throw would end the page along with the film, on the one browser this atlas has never been opened in.
Writing on a chapter change instead is eight writes for a whole run.

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
    narration.js      the beats: dated, located, authored story moments, and their routes
  audio/
    ambience.js       per-chapter ambience, crossfaded
  ui/
    ui.js             loader, chapter cards, selector, dock, deep links
    ui.css            the chrome's own paper
  lib/
    math.js
    dates.js          ISO <-> AHCB's YYYYMMDD <-> fractional years
    topojson.js       arc decoding, shared by the pipeline and the runtime
pipeline/             AHCB shapefile -> per-chapter TopoJSON bundles
  build.js            the whole run: decode, prune, project, simplify, route, quantise
  lib/
    project.js        the Albers projection and the sheet fit
    topology.js       prune and remap, without rebuilding shared arcs
    simplify.js       Douglas-Peucker that keeps arc endpoints
    quantize.js       the final TopoJSON transform
    regions.js        which projection each geometry belongs to
public/               shipped as it is
  favicon.ico         the mark, re-encoded for the tab bar
  assets/             fonts and textures
data/                 generated chapter bundles (not committed)
```

`fx/` is the reference's name for the layer that runs its motion in vertex shaders and only takes a
few weights from the CPU. Our dots must work the same way: the dispersal is the transition, it
happens for every anchor and every boundary at once, and it cannot be driven per-particle from
JavaScript.

## The offline pipeline

```
AHCB shapefile (142 MB, overlapping date-coded polygons)
  -> filter to a chapter's date range (half-open: START_N < chapter.endN)
  -> project, each region through its own projector
  -> simplify with Douglas-Peucker, tolerance tuned per zoom tier
  -> append the panel frames and the chapter's authored story routes, un-simplified
  -> quantize and encode as TopoJSON
  -> one bundle per chapter
```

Generated bundles are not committed. The pipeline directory is, and `npm run data:build`
regenerates them.

Two of those steps exist for reasons that are easy to undo by accident. The **half-open** filter is
what makes a chapter's window `[from, to)` in the pipeline and in the tests at the same time; the
inclusive version drew a closing-day feature twice and gave Chapter 1 a 42 KB bundle of boundary that
could never reach opacity. And the **frames and routes go in after simplification**, because both are
already the shape someone meant them to be: Douglas-Peucker would usually keep a rectangle rectangular
and a march on its bends, and "usually" is not a property to ship a border or a road on.

The pipeline reads exactly one field of the story layer — `figures` — and never its prose. That is why
all eight chapters build whether or not anyone has written them, and why the writing is not on the
critical path of the map.

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
  be forgotten. What the gate does is *reduce*, not forbid — see the 2026-10-11 decision log entry for
  why a version of this atlas that declines to run is not a reduced-motion version of anything.
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
for Hawaii, in the conventional composite layout — the one every period US map carried. Forcing one
projection across the full latitude range is the alternative, and it distorts all three areas at
once.

The three projections are composed here rather than taken from `d3-geo`'s `geoAlbersUsa`, which is
the obvious candidate and turned out to be unusable for this atlas. `geoAlbersUsa` does not merely
*place* the insets, it *clips*: it draws Alaska and Hawaii into fixed positions of its own choosing
and cuts every geometry to the frame it believes you want. Two measured consequences. It silently
deleted 3,102 points of `or_country` — the 1818–1846 Oregon Country, which is real historical
territory this atlas has to draw, and whose loss would have been invisible because the remaining
outline still closes. And it puts Alaska above the lower forty-eight and Hawaii in the middle of
them, where this sheet wants both in the open water at the lower left; its rectangles are not
adjustable. Composing three projectors by hand costs one small module and keeps the frames, the
clipping and the fits under our control.

Two consequences worth stating. The first is about dates; the second is the opposite of what this
document said before it was measured:

- **An inset appearing is a boundary event, not a layout choice.** Alaska's panel appears on
  1867-03-30, Hawaii's on 1898-07-07 — the purchase and the annexation, not the statehoods. Before
  those dates there is nothing to inset and the corner stays water.
- **The sheet does not grow, and the camera does not reframe.** The panels are fitted once, from the
  whole record, into rectangles that are open water in every chapter: the lower-left corner, below
  the Gulf coast and west of Texas. Measured against the projected mainland, each rectangle clears
  every piece of land by about 0.012 sheet units — roughly 55 km at the sheet's scale — and that
  clearance is asserted by exact polygon-to-rectangle intersection in `pipeline.test.js`, not by eye.
  So nothing is reserved and nothing is re-fitted: one fit-to-paper computation at load is the whole
  story, and the framing code stays simple. An earlier version of this section claimed the sheet's
  extent changed twice inside Chapter 4 and that the re-fit *was* the visible event. It does not and
  it is not. What is visible is the panel arriving; the paper never moves.

The panels are also static from the day they appear. Alaska's outline is identical in all four of
its dated versions and Hawaii's in all three of its own — hashing the projected coordinates of every
inset geometry collapses fifteen geometries onto exactly two shapes. AHCB re-registers one outline
under a new political name each time the status changes, and a statehood alters nothing that is
drawn. That is why the insets buy Chapter 4 exactly two visual events and buy Chapters 5–8 none: see
*Decision log*, and *Chapters* in the README.

The District of Columbia, 68 square miles, is a marker and a label at state-level simplification — no
geometry to derive and none to simplify.

### A projection that cannot place something does not necessarily fail

`geoAlbers()` is a function of longitude and latitude with no notion of the frame it draws into, so
it returns finite, plausible coordinates for Nome and Honolulu and reports no error at all. Measured
against the single-projector version of the pipeline: Alaska normalised to sheet x[-0.575, 0.060]
y[0.773, 1.251] and Hawaii to x[-0.805, -0.738], on a sheet 1.000 wide and 0.776 high. Hawaii was
entirely off the paper; Alaska left a sliver across the top-left corner. The cost was the larger
problem: 6,671 points per version, roughly 44% of those chapters' payload and half their
triangulation, spent on geometry that was not on the drawing.

That fact is still why this corner of the pipeline needs defending, and it is the reason the guard
is not shaped the way it first was. It used to be a filter — `pipeline/lib/placeable.js`, a module
rather than a constant because the failure is silent and deserved its own test — that asked "can the
sheet hold this?" and dropped what it could not. A filter is the wrong instrument, for two reasons:

- **It fails silently in the direction that matters.** A filter that is wrong about a *mainland*
  feature removes it, and the map still looks like a map. The error has no symptom.
- **It cannot say where anything belongs.** `false` is the only answer it has. "Alaska is not
  allowed" is expressible; "Alaska goes in the Alaska projection" is not.

The guard is now a routing table, `pipeline/lib/regions.js`. Every geometry is assigned a region by
its id — `ak_*`, `hi_*`, everything else — and each region owns a projector and a fit. A geometry
cannot fail to be projected, so the failure mode is no longer *something is missing* but *something
is in the wrong place*, and wrong-place is visible on screen. The three application points the
filter needed (the sheet fit, the prune, the annotation) collapse into one, because the question is
asked once, at projection time, and the answer is a projector rather than a yes or no.

It is pinned by test rather than by inspection. `pipeline.test.js` asserts that the panel regions
route to their own projectors; that the panel rectangles intersect no mainland land, by exact
polygon-to-rectangle intersection; that no arc is shared between two regions, which is what would
make routing ambiguous; and — the assertion that preserves the original lesson — that the *mainland*
projector still returns finite, plausible coordinates for Alaska. That last one states the hazard
positively, so that anyone who "fixes" the projection into refusing is told they have moved the
problem rather than solved it.

## The anchor window

An anchor is a boundary state retained past the chapter that owns it, drawn as desaturated ink in the
chapter's own material — the same buffer as the live boundaries, at reduced weight and a third of the
opacity. It is line work, not a fill: a translucent polygon on an engraved plate reads as a
registration error. Its life:

- The chapter that owns it draws it at full strength.
- The **two chapters** after that draw it with a lighter hand, at decreasing opacity.
- From the third chapter on it is paper texture only: no geometry, no fill-rate cost.

Two things follow, and they are not two rules:

- **The visibility cap is the window, arithmetically.** A two-chapter window means the sheet never
  carries more than three anchors at once. "At most two or three visible" is not a second rule.
- **The window is counted in chapters, because chapters are the unit of navigation and carry their
  own time scales.** Counting in years would be incoherent: the 1783 anchor would persist for 82
  years across Chapters 2 and 3, while an anchor in Chapter 6 would be gone in four. What the
  palimpsest metaphor actually describes is *page distance* — how many pages ago you saw the ink —
  not elapsed time. The fade *rate* should still be tuned per chapter, since a chapter's number of
  years and its reading duration are unrelated.

## The story layer

Everything else the atlas can say is geometry, and geometry has exactly one subject: a place whose
outline changed on a date. That is why Chapters 6, 7 and 8 have nothing of their own to draw — nothing
inside their windows moves — and why Chapter 1 has nothing at all. It is also why the answer could not
be *more* geometry. The narrative layer is a second **content type**, not a second view of the first
one, and the distinction that matters is provenance: a boundary is derived and a story has to be
authored.

- **The unit is a beat** — a date, a geographic place, and one thing that happened. Stored in
  `timeline/narration.js`, keyed by chapter. All eight chapters are written as of 2026-10-10, a
  hundred and eight beats, but the file's contract is unchanged by that: a chapter absent from it has
  not been authored rather than failed to build. A beat carries `year` and `n` derived from its ISO
  date the same way `chapters.js` derives a chapter's bounds, so there is one date form in the project
  and not two.
- **`place` is a real coordinate, not a point picked off the plate.** It would have been easier to
  store sheet coordinates once a camera existed; that would also have been a silent lie about where
  Normandy is, in exactly the case where it matters. Measured, **fourteen of the hundred and eight**
  places are not on the drawing at all — the Canal, the Pacific and European theatres, Berlin, Korea,
  Baikonur, Moscow, the Gulf and Abbottabad — and four more are inside a panel. See *What is on the
  plate* in the README.
- **The panel is a pure function of the date cursor.** `beatAt(beats, state.date)` is evaluated in
  the frame loop beside the date stamp, so there is no story state, no queue and no player. Scrubbing
  backwards, deep links and Play all carry the story because they all already moved the date.

### Figures: the one place a line is drawn by hand

A beat may also carry **`figures`** — one or more polylines in real longitude and latitude — and this
is the only exception to the rule that nothing on the plate is drawn by hand. Fourteen across twelve
beats: the James River, the Great Wagon Road, the crest of the Proclamation Line, Nemacolin's Path,
the road out of Boston to Concord, the march to Yorktown, Lewis and Clark, the Missouri Compromise
parallel, the Erie Canal, the 49th parallel, the Oregon Trail, the Pony Express, Sherman's march, the
first transcontinental railroad.

Three rules keep it from becoming a place to put anything:

- **A figure is a corridor, not a survey.** A boundary in this atlas is a claim about a surveyed edge,
  so it is derived or it is wrong. A figure is a claim about a corridor, traced from published
  descriptions and honest about being approximate — which is why every one carries a `note`, and why
  the `note` says *schematic* when it is one.
- **It belongs to a beat, and has no date of its own.** It is revealed when its beat's date passes and
  is still on the sheet when the chapter closes. A line no sentence needs is decoration.
- **The pipeline reads this field and nothing else.** `pipeline/build.js` projects `figures` into the
  bundle and never looks at `title` or `body`, so an unwritten chapter still builds exactly like a
  written one. The story layer must not become a build dependency of the map.

They cost the runtime nothing, and that is deliberate rather than lucky. A figure enters the bundle as
a `LineString` with a `start` and a `t`, which is precisely what a **panel frame** already is — so it
inherits the date mask, the fade-in, the terminal handling and the dot dispersal from machinery that
was already there. No new uniform, no second material, and no runtime projection that could disagree
with the one the build used. The alternative that was tried first — projecting the routes at runtime,
where the camera could use them directly — was abandoned for exactly that last reason.

**Chapter 1 is the reason the mechanism exists.** Its window contains no state boundary at all: every
feature reaching it starts on the day it closes. So a bundle for that chapter draws nothing but its own
routes, and the chapter is the proof that the story layer is not decoration on the map. It also forced
three changes elsewhere, all three of which are recorded in the decision log: the plate's clip became
half-open, a land buffer that is legitimately empty no longer computes a bounding sphere, and a chapter
marked `built` that produces nothing to draw is now an error rather than a blank sheet.

**And a chapter that depends on figures depends on them from its first frame.** The lesson is worth
stating as a rule rather than as an anecdote, because it is the one failure of this mechanism that no
test could catch: Chapter 1's first written routes were dated 1763 and 1781, so the plate was bare
paper from 1607 until 1763 — a hundred and fifty-six of the chapter's hundred and seventy-six years.
Every guard passed. The bundle built, the routes projected, the geometry was on the drawing; it simply
had not arrived yet. What found it was measuring the sheet rather than reading the tests: with the
interface hidden, the darkest pixel in the first frame was **181** on a 0–255 scale, which is paper and
nothing else. Three earlier routes — the James River at Jamestown, Nemacolin's Path in 1754, the road
to Concord in 1775 — took it to **96**. The general form: *a layer that is revealed over time has to be
checked at the beginning of the window, not at the end.*

### Playing it needs the cursor to stop, not to slow down

The one thing the state machine had to learn. The first version gave a written chapter a slower
`pace` — a fraction of the chapter per second, uniform across it — sized so the chapter took one hold
per beat. A play-through sampled on the real thing showed why that cannot work: a uniform pace makes
the **gap between two dates** the reading time, so Executive Order 9066 (two months after Pearl
Harbor) got six seconds and Midway (a year after that) got twenty-seven. Both numbers are artefacts of
when the history happened.

So `ChapterState` holds a list of dates and stands on each one for a duration:

- `holds` — ascending fractional years, filled from `holdsFor(beats)`; `holdSeconds` — how long to
  stand; `dwell` — seconds left at the current hold; `dwellTotal` — how long *this* hold was set to
  run; `heldAt` — the hold last stood on.
- **A chapter's opening beat is held for less than a reading time.** `openingHoldSeconds` is filled
  from `OPENING_HOLD_SECONDS` in `timeline/narration.js`, and it defaults to `null`, which reads as
  "the same as `holdSeconds`" — `0` is a legitimate value, so it is `??` and never `||`. That beat is
  the one beat that is not *discovered*: it arrives with the chapter card, which is inking itself over
  the sheet to announce it, so it is held for the length of that card instead. Chapter 1 is the case
  that forced it — it opens on its own first beat over a plate with almost nothing on it, and twelve
  seconds of that is the first thing anyone ever sees of this atlas. Whether a hold is the opening is
  decided by the same day comparison, to the same tolerance, that `beginsInsideChapter` makes in
  `world/boundaries.js`; two places deciding what "the chapter's opening" means have to agree.
- `dwellLeft` is `dwell / dwellTotal` — **never** `dwell / holdSeconds`. The two durations are
  different lengths, so a three-second arrival divided by twelve would begin already a quarter spent,
  and that fraction is exactly what the dock draws. `dwellTotal` exists for that one division.
- The comparison in `#nextHold` is **inclusive of `from` and exclusive of `heldAt`**, and both bounds
  are load-bearing. Inclusive, because Chapter 6's first beat is dated the day the chapter opens, so
  on the first tick `from` and the hold are the same number — a strict comparison silently skips the
  first beat of every chapter that opens on its own subject. Exclusive, because otherwise the cursor
  arrives, stands, and finds the same hold again: a frozen atlas, and a failure with no symptom other
  than sitting and watching.
- **A frame that finishes a hold is not thrown away.** The remainder of `dt` goes into travelling;
  otherwise the cursor stands one frame longer than the hold says, on every beat.
- The landing is **exact** — the cursor is set to the hold's date rather than to `date + step` — for
  the same reason a deep link rounds to the day: a card that appears a week early is a card about the
  wrong thing.
- A scrub (`aimDate`, `snapDate`) abandons a hold, and a chapter change clears `heldAt`, because
  chapters share dates: each one opens where the last one closed.

The state machine is told a pace, a list of dates and **two** durations — the reading time and the
arrival. It never learns what is at any of them. `applyStoryTiming` in `main.js` is the whole of the
coupling, and `env/chapter.js` stays free of any knowledge of history or of content. Two durations
rather than one, for the same reason `holds` is a list rather than a count: the shape of the answer is
content, and content belongs on this side of the seam.

### The eight chapters are one run, and it starts itself

With every chapter written, a play-through of one chapter stopped being the interesting unit: eight
chapters of beats in order are a documentary, and a documentary that has to be started eight times is
not one. So the atlas plays itself on opening, and the end of a chapter is a **hand-off**.

Two lines of assignment in `main.js` are the whole of it, and they follow the rule `holds` already
set — the state machine is given the answer without the content:

```js
state.nextChapter = nextBuiltChapter;      // from timeline/chapters.js
state.openingChapter = BUILT_CHAPTERS[0];
```

- `nextBuiltChapter` rather than `nextChapter`. The latter walks all of `CHAPTERS` — the record's
  order, in which a chapter that has never been drawn still has a place. The film has to walk
  `BUILT_CHAPTERS`, or it would travel through a dispersal and come out over a blank plate; and
  nothing downstream would complain, because `main.js`'s prefetch deliberately treats a missing
  sibling as survivable. Both functions give the same answer for all eight chapters today, which is
  exactly why the distinction is written down.
- `#rollOn` is called from two places and they are the same question: the frame loop reaching the
  end of a chapter, and a viewer pressing Play on one that has already run out. The first keeps
  playing; the second has just started, so it starts. Play on a chapter with nothing after it at all
  restarts from `openingChapter`, because the unit that stopped was the run.
- **`goTo` no longer touches `playing`.** It used to pause, on the grounds that a chapter change is
  something the viewer asked for — true when a chapter change could only be asked for. With the film
  running, a chapter click means "go to this one", and pausing there let a viewer browse the selector,
  switch the film off without noticing, and return to a still page wondering what broke. Scrubbing
  still pauses (taking the timeline is leaving the story) and so does Restart (it is a rewind).
- **The end of a chapter must not be mistaken for the end of a beat.** `#atEnd` requires
  `dwell === 0`, or a chapter whose last beat is dated the day it closes would hand off before its
  final card was read — which is Chapter 6, and Chapters 1 and 3 as well. It also requires
  `!isTransitioning`, so that pressing Play mid-dispersal cannot re-aim the transition in flight.

The decision about whether to autoplay at all is `shouldAutoplay` in `ui/ui.js`, next to
`parseDeepLink`, because it is mostly a URL question. It says no for exactly one reason — `?still` in the
link — and it takes **one** argument, which is itself the statement: it was a second reading of the
viewer's environment that made the film not start at all. `ui.test.js` pins that twice, and the order
matters. First behaviourally, by calling it with a spare second argument and requiring the answer to
the same link not to change; then structurally, by asserting the arity. The behavioural assertion is
the load-bearing one, because the natural reintroduction is `(link, reducedMotion = false)` — and
`.length` is **1** for a function with a defaulted parameter, so an arity check alone would stay green
with the gate back in place. A date in the URL is *where to open*, not whether to move;
`prefers-reduced-motion` is now read as *reduction* rather than as a reason not to run. Both are
reversals, and the decision log has them.

`stillReason` sits beside it and answers the other half of the same question — *why not* — because that
reason is invisible in the picture, and a page held still on purpose is otherwise indistinguishable
from a page that failed. It has exactly one line now; the motion setting's line went with the gate it
explained, on the rule that a cause which no longer causes anything is worse than no line. Its wording
is pinned by a test, as is the invariant across the input space — a reason exists exactly when the film
is not going to start — and a third that walks every input and requires exactly one line to be
*possible*, which is what would catch a reason being re-added without a gate behind it. `ui/ui.test.js`
also pins `permalinkFor`, the URL policy, for the same reason — the policy was inside a DOM method and
therefore untestable, so it was extracted rather than trusted.

**The third of those answers is the one that was missing longest, and it is the one a viewer actually
asks out loud: *is this page alive*.** A hold is invisible — for twelve seconds at a time the sheet,
the date stamp and the timeline are all legitimately still, which is the same frame a page that died is
in — and about nine tenths of the film's running time is spent in one. That is why a working film was
read as a frozen one **twice, by the person who asked for it**, and why the second report ("it stops
around 1619" — the film's second beat) was not a rendering fault at all. So the dock draws it instead
of describing it: a hairline under the timeline fills from nothing to full across the hold, and a line
above the Play button counts the same hold down in whole seconds. `dwellLeft` is the single source for
both, and — like the Play button beside them — both are derived from the state on every frame, so a
scrub, a pause, a chapter change and the film's own arrival at a beat all move them without any of
those four knowing they exist. While the film is paused both go empty rather than holding their last
value, because the clock has stopped and a countdown that kept its number would be the one line here
telling a lie. `dwellNote` is pure and `ui.test.js` pins its wording, its `Math.ceil` (the line must
read `1s` and only then may the cursor move; `0s` beside a cursor that has not moved is the same lie
`stillReason` refuses to tell), and its non-breaking-space padding — `12s` and `9s` are a character
apart in a right-aligned line, so without it the dock shifted sideways once per beat as it passed ten.

The hairline is a `scaleX` rather than a `width`, and it carries no CSS transition: a width would lay
the dock out again on every frame of every hold, and a transition would be a second clock — the one the
fill is meant to be *evidence* of.

**One trap, and it cost a run — and the reversal above has turned it inside out.** Headless Chrome
reports `prefers-reduced-motion: reduce` by default, so a headless check used to *inherit* a page that
correctly refused to start; the first autoplay check read that as the feature being broken, and motion
had to be emulated back on with `Emulation.setEmulatedMedia` before the film was visible at all. Autoplay
no longer consults the setting, so the film now starts in headless Chrome unattended — which means the
emulation call has not gone away, it has **swapped sides**. The default is no longer the rendition you
are trying to test: it is the *reduced* one. `setEmulatedMedia` is what you call now to check that the
camera does follow the pointer, and the flag still points the other way for every other headless check
in this project: motion that is not emulated is motion that is not being tested.

**And a second trap, in the opposite direction, which is the one that found the bug.** A headless
walk that samples every two seconds reported the bare URL as *playing but frozen* — the Play button
said Pause and the date stamp never moved. Both readings were correct and the conclusion was wrong:
the opening of a chapter is a deliberate dwell — `HOLD_SECONDS` when this was found, and
`OPENING_HOLD_SECONDS` on the three chapters that open on their own first beat — so the sample window
ended exactly where the film was still standing still. Extend the window past the first hold and it
moves. **A measurement with a window shorter than the phenomenon measures the window.**

**And a third, which is about the clock rather than the window.** A harness timed each hold with
`performance.now()` and reported the three-second arrival as 6.3 s and the twelve-second holds as
15.2 s, on a page that was doing exactly what it said. `dt` is clamped to 50 ms a frame, so on a
headless renderer that cannot hold 20 fps **film time runs slower than wall-clock time** — and taking
a screenshot stalls the renderer on top of that, which is why the first of the two numbers was the
wrong one by the larger margin. Anything the film counts out has to be read *in film seconds*: the
dock's countdown is the measurement, and it is immune to the frame rate because it is a number the
film is writing. Read a clock the film does not own, and the frame rate is what is being measured.

### The `@layer boot` hidden list is a trap

`index.html` carries an `@layer boot` block that hides the chrome, the card, the story panel, the
loader and the fatal message until the stylesheet lands, so a failed `ui.css` cannot leave the page
in the browser's default styling. It sits in a cascade layer precisely so that `ui.css` wins over it
wherever a bundler puts it — unlayered declarations beat layered ones.

**That works only if the element declares its `display` in `ui.css`.** A layered `display: none` also
beats the user agent's own `[hidden]` rule, so an element added to that list without an unlayered
`display` can never be shown at all. Every other element in the list (`.chrome`, `.card`, `.loader`,
`.fatal`) is a grid or a block in `ui.css`, which is what makes the pattern invisible until a new
element joins it. The story panel joined it and did not, and the panel rendered nothing while
reporting `hidden = false` with its text populated — one debugging session, now a `display: block`
with a comment saying why.

## Decision log

Settled on 2026-10-06:

- **Plain JavaScript. No TypeScript.** The shader work lives in injected GLSL strings and uniform
  objects, where types earn little and cost friction.
- **The anchor window is counted in chapters, not years.** See above.
- **Chapters are cut at inflection dates — 1783, 1848, 1865, 1900, 1941, 1945, 1989 — not at the
  documentary's episode boundaries.** The episode ranges overlap and leave a gap: Westward
  (1803–1860s) and Division (1820s–1860) claim the same forty years, Heartland and Cities the same
  twenty-five, and nothing covers the Confederation period, the Northwest Ordinance or the Louisiana
  Purchase. A timeline allows one state per year, so the cuts go where the country's status actually
  changed. The documentary remains the chapter spine — `episodes` in `chapters.js` records which
  episodes each chapter re-cuts — but it does not own the bounds.
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
- **The favicon is a real multi-size ICO, re-encoded from the supplied artwork.** The supplied file
  declared 256×256 in its directory entry while carrying a 1797×1800 PNG, and weighed 2.2 MB — not
  something a tab bar should fetch. It is now 16/32/48 in a container whose entries match their
  payload, with the artwork cropped to its own bounding box and padded back to square; the source
  left 43% of its height empty, which would have put the map in a third of a 16 px tab.
- **`ui.css` is linked from `index.html`, not imported from JavaScript.** See *Loading* above. A
  stylesheet imported from a module cannot start downloading until that module and everything
  behind it has run, and the chrome spends that time on screen in the browser's default styling.
- **The insets appear when the date reaches them, and hold a place that was always open water.** The
  sheet is fitted once, from the whole record; the panels occupy the lower-left corner, which is sea
  in every chapter. Nothing is reserved and nothing is reframed. See *Projection* above.
- **Only the two chapters in flight are drawn.** See *Exactly two chapters are on the sheet at a
  time* above. The earlier rule showed every loaded layer during a transition, which is the same
  thing at two chapters and six extra plates of ink at seven.
- **Inset geometry is routed, not excluded.** Each geometry carries a region, each region owns a
  projector and a fit, and the panels are drawn rather than dropped. `geoAlbers` places Alaska and
  Hawaii without complaining, so an unguarded single projector cost ~44% of Chapters 4–8's payload
  on geometry that was not on the drawing; routing keeps them on the drawing, in the right place.
  See *A projection that cannot place something does not necessarily fail* above.
- **Chapter 1 has no bundle, and that is a data decision rather than a schedule one.** The
  state-level record begins on 1783-09-03, which is the day the chapter closes, so a bundle cut to it
  is 176 years of blank paper. Colonial boundaries exist in AHCB from 1629 at county level only.
- **The panels are static once they arrive, and that is a measured fact rather than an assumption.**
  Alaska's outline is identical in all four of its dated versions and Hawaii's in all three of its
  own — fifteen geometries, two shapes — so the 1959 statehoods change a name and nothing that is
  drawn. The insets therefore give Chapter 4 its two visual events, at 1867 and 1898, and give
  Chapters 5–8 nothing at all. Inside a panel the annotation layer is the only thing that can carry
  history, which is the argument for M2 being a milestone rather than garnish. See *Chapters* in the
  README.
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

Settled on 2026-10-10:

- **The narrative layer is a second content type, not more annotation.** M2 as originally written —
  annotations extracted from AHCB's `CHANGE` field — produces sentences like *"Nevada Territory gained
  from Utah Territory"*: accurate, automatic, and still talk about the map rather than story. A story
  has to be authored. It lives in `timeline/narration.js`, which the pipeline never reads, and a
  chapter absent from it has not been written rather than failed to build.
- **A chapter with beats holds the cursor instead of crawling past them.** See *Playing it needs the
  cursor to stop, not to slow down*. A uniform pace makes the historical gap the reading time, which
  is a number nobody chose.
- **The state machine is told a pace, a list of dates and a duration, and nothing else.**
  `env/chapter.js` stays innocent of content; the whole coupling is `applyStoryTiming` in `main.js`.
- **Beats are bilingual and neither language is a gloss**, which is the shape `chapters.js` already
  uses for `name` / `nameZh`. Pinned by test, because a half-written beat — English only — is not
  obviously a mistake and would survive review.
- **The fourteen places that are not on the drawing are pinned by a test.** It is a *pin* rather than
  a guard: it asserts a measured fact about content and guards no function. Its value is that adding a
  beat off the plate now forces the question while the camera work is still ahead of us. It began as
  five places in Chapter 6 and grew to fourteen across the atlas when the other seven chapters were
  written; ninety land on the sheet and four inside a panel.
- **All eight chapters are written.** The layer was proved on one chapter and then the other seven
  followed — 108 beats, every chapter including Chapter 1. The consequence worth recording is not the
  count but that Chapter 1 became *buildable*: a chapter whose window holds no state boundary has no
  map to fall back on, so writing it forced the mechanism below to be general rather than a garnish.
- **A beat may carry `figures`, and that is the only hand-drawn geometry in the atlas.** Fourteen of
  them, in four chapters. See *Figures* above. The rules that bound it: a corridor rather than a
  survey, always owned by a beat, and the only field of the story layer the pipeline reads. The
  consequence is that the runtime needed no change at all — a figure is a `LineString` and inherits
  everything a panel frame has.
- **A chapter that draws only figures must have one in its first frame.** Chapter 1's first mark is
  dated 1607, not 1763. The earlier arrangement passed every test and still left the plate bare for a
  hundred and fifty-six years, which is the one thing the layer exists to prevent; it was found by
  measuring the darkest pixel on the sheet rather than by reading a green test run. See *Figures*.
- **Chapter 1's `built` flag flipped to true, and `built` now means "has something to draw."** It used
  to mean "AHCB has boundary geometry inside this window." Chapter 1 has none and is not an empty
  chapter, so the predicate was restated in terms of content: boundary geometry *or* authored figures.
  The pipeline backs that up by refusing to write a bundle for a chapter marked built that produces
  nothing, because a blank sheet and a failed build look identical from outside.
- **Chapter 8's window runs to a constant, 2026-12-31, and the pipeline computes terminality against
  the record rather than the window.** `NARRATIVE_PRESENT` is a literal rather than `new Date()` so the
  build stays reproducible and deep links stay stable. The trap it opened is worth keeping: `t` — the
  flag meaning "still alive when the chapter closes, so do not fade it out" — was computed against
  `chapter.endN`, and once a window outlives the record that comparison is never true, so every feature
  goes non-terminal and the whole plate dissolves to blank paper on the last frame. It is computed
  against `min(chapter.endN, recordEndN)` now.
- **The chapter clip is half-open: `START_N < chapter.endN`.** A chapter's window is `[from, to)`,
  which is what `pipeline.test.js` already asserted when it checked that no two chapters claim the same
  instant — and the inclusive version quietly disagreed with it. Two visible symptoms: a feature dated
  exactly on a chapter's closing day was drawn in that chapter *and* the next, and Chapter 1 swept up
  all fifteen features that begin on 1783-09-03, shipping 457 arcs of 42 KB of boundary that faded in
  and never reached opacity before the chapter ended.

Settled on 2026-10-10, on the request that the atlas play itself:

- **The atlas autoplays, and the eight chapters are one continuous run.** A page that has to be
  started is a page most visitors see as a still picture of 1607 with one card on it, and the
  narrative layer only pays for itself if it is read. The cost is that a chapter's end stops being a
  terminus: the frame loop hands the cursor to the next chapter through the dispersal and `playing`
  survives the change. About twenty-four and a half minutes end to end.
- **Navigating no longer pauses.** `goTo` used to set `playing = false`, which was right when a
  chapter change could only be asked for by someone who wanted to stop the film. It is now a reversal,
  and the reason is a failure mode rather than a preference: the common case is a film in progress, so
  pausing on a chapter click let a viewer browse the selector, switch the film off without noticing,
  and come back to a still page wondering what broke. Scrubbing still pauses, because taking hold of
  the timeline is leaving the story; Restart still pauses, because it is a rewind.
- **A date in the URL no longer suppresses autoplay — the one reversal here.** The rule was that a
  dated link holds still, so a shot pasted into a message would not walk away from the frame it was
  sent for. It failed because **the page writes its own URL**: `#maybeWriteUrl` records the position,
  so within a second of arriving every ordinary visitor's address bar held a date, and every reload,
  restored tab and bookmark of the page they had just watched was silently a still frame. Autoplay had
  become a once-ever event, with nothing on screen to say why — reported from a browser, not from a
  test. A rule that turns the common case into the exception is not a rule about links. Stillness is
  now only `?still`, which has a property the old clause could not: it is *legible*, so a page that is
  not moving says so in its own URL.
- **`?still` overrides autoplay, and it is an existing promise rather than a preference.** A chapter can
  be shared without starting a screening. `prefers-reduced-motion` was the second suppressor here until
  2026-10-11 — see below. The predicate is `shouldAutoplay` in `ui/ui.js`, pure so that it can be
  tested — `parseDeepLink` beside it cannot be, and this is the larger blast radius of the two.
- **The URL records the day only while the cursor is held.** Held — paused, scrubbed, or arrived by a
  chapter click — it carries `date` to the day, so a pause is a link someone can be sent. Running, it
  carries the chapter alone, because a reload of a moving picture means *start the reel again* and
  there is nothing finer worth pinning. The second reason is not aesthetic: the cursor crosses a day
  in under a millisecond, so writing it meant four `history.replaceState` calls a second for
  twenty-four minutes, and Safari throws a `SecurityError` after a hundred in thirty seconds. That
  throw would happen inside the frame loop, so the first one would end the page with the film — on the
  one browser this atlas has never been opened in. Extracted to `permalinkFor` in `ui/ui.js`, so the
  policy is testable rather than buried in a DOM method.
- **`still` is carried through the URL rewrite; `anchor`, `tier` and `intro` are not.** Those three
  say how to *arrive*; `still` decides what the page *does* once it is there. Dropping it would hand
  the next person a page that starts moving — the same surprise as the date rule, one step further
  along.
- **The dock says why it is not moving.** `stillReason` in `ui/ui.js`, shown beside the Play button for
  exactly as long as the cursor is stopped. That reason is invisible in the picture, so a page held
  still on purpose and a page that failed are the same screenshot; the bug above is what that costs.
  The wording is pinned by a test, as is the invariant — a reason exists exactly when the film is not
  going to start.
- **The film walks the built chapters, so `chapters.js` gained `nextBuiltChapter`.** The existing
  `nextChapter` walks all of `CHAPTERS`, which is the record's order and the right answer for
  anything that is about the record — but handing the film a chapter with no bundle sends it through a
  dispersal and out over a blank plate, and `main.js` deliberately treats a missing sibling as
  survivable, so nothing would report it. The two answer the same thing today, which is why the
  distinction had to be written down rather than inferred.
- **The state machine still learns no content, and the film did not change that.** It is given
  `nextChapter` as a function of the chapter, exactly as it is given `holds` as a list of dates: it
  asks *where next* without being able to name where. Assigning both is two lines in `main.js`.
  `nextChapter` and `previousChapter` in `chapters.js` remain unused by anything.
- **A chapter's end is not a beat's end.** `#atEnd` requires `dwell === 0` as well as the cursor
  sitting on the chapter's end, because a chapter whose last beat is dated the day it closes is parked
  there while it is still being read — Chapter 6 ends on 1945-08-15, and Chapters 1 and 3 close on
  their own last beats too. Without that half of the condition the film would cut the final card off
  every chapter written to end on its subject.
- **Play on a finished film starts it again.** It is not a chapter restart — that is what Restart is
  for — and it is not a dead button, which was the one outcome worth code to avoid: the unit that
  stopped was the run, so Play returns to `openingChapter`.

Settled on 2026-10-11, on a report that autoplay still did not work:

- **`prefers-reduced-motion` no longer suppresses autoplay — the second reversal.** Reported with a
  screenshot, and the screenshot was the answer: the dock was saying *Reduced motion — press Play to
  start*, which is the atlas correctly declining to start on a machine whose operating system has
  animations switched off. That is an old laptop tuned for speed, a corporate image, a remote session,
  far more often than it is anyone with a vestibular disorder. The reason it counts as a bug rather
  than as a working promise is that **the atlas was already reading the setting two ways on the same
  machine**: `ui/ui.css` reads it as *milder* — the chapter card still inks itself in, in 0.6 s instead
  of two, and the story panel simply appears — while `shouldAutoplay` read it as *do not run*. Same
  class of mistake as the date rule, one step further out: a rule that turns the ordinary case into the
  exception. Cancelling the content is not a reduction of the motion, and it is worth saying plainly
  what the content is — the cursor advancing, the boundaries redrawing, the dispersal between chapters.
  A version of this atlas that does not move is a version with nothing in it.
- **The setting now takes away the pointer parallax, and nothing else.** `main.js` reads it once at
  boot — not watched, because a viewer turning it on mid-film is asking their operating system for
  something, not this page — and skips `applyParallax`. That is the only motion here that is both
  decorative and triggered by an interaction, which is the precise case WCAG 2.3.3 is about. Skipping
  the call is sufficient: that function is what moves the camera off the frame `frameSheet` put it in,
  and `worldPerCssPixel` reads only `position.z`, which it never touches, so the ink keeps its weight
  either way. The rest of the motion is still owed to the setting; it is M5's, and the READMEs say so.
- **A suppressor that is not in the code cannot come back by accident, and arity is not the guard it
  looks like.** `shouldAutoplay` takes one argument now, and `ui.test.js` asserts that behaviourally
  first — called with a spare second argument, the answer for the same link may not change — and only
  then structurally. The order is the point: the natural reintroduction is
  `(link, reducedMotion = false)`, and `.length` is **1** for a function with a defaulted parameter, so
  an arity check alone stays green with the gate back in place. Verified by injection, both halves, red
  then restored; and note what the first injection showed — every other autoplay test in the block
  stayed green with the gate restored.
- **A hold is drawn, because a state nobody can see is indistinguishable from a bug.** `dwellNote` plus
  the hairline under the timeline (`#read`), both driven by `dwellLeft` in `ui/ui.js`, both empty while
  the cursor travels and both still while the film is paused. This is the third answer to *why is it not
  moving*, beside `stillReason`, and it is the one that cost two reports: a hold lasts twelve seconds,
  about nine tenths of the running time is spent inside one, and during it the sheet, the date stamp and
  the timeline are all legitimately still — so a working film and a dead page are the same screenshot.
  The report that identified it was behavioural rather than visual: **"it stops around 1619"**, which is
  the second beat of Chapter 1, and exactly where a viewer first meets a hold nobody has told them about.
  Verified against the running page over CDP (`us-hold.mjs`) rather than in a unit test, because what was
  broken was the wiring: the countdown reads 3, 2, 1 on an arrival and 12 … 1 on every other beat, at any
  frame rate.
- **A chapter's opening beat is held for the length of its arrival card, not for a reading time.**
  `OPENING_HOLD_SECONDS` in `timeline/narration.js` — about three seconds, against
  `TRANSITION.disperse + TRANSITION.reform`, so the sheet is never asked to sit still on a plate that has
  not finished being drawn — pinned by a test, so shortening one without the other fails. That beat is
  *announced* rather than discovered: it arrives with the chapter card, and Chapter 1 opens on it over a
  near-empty plate, so the old behaviour was twelve seconds of nothing as the first thing this atlas ever
  showed anyone. The predicate defaults to `null` rather than to `0`, because `0` is a legitimate "skip
  this hold" and `||` would eat it. The film is 23:49 instead of 24:16, and Chapter 1's opening beat is
  the reason any of this exists.
- **A property of something that repeats has to be asked of one occurrence.** The first version of the
  harness above required the fill to grow monotonically across *every* holding sample at once, and went
  red on a correct page: the bar fills 0 → 1 inside one hold and starts again at 0 on the next beat, so
  what the check measured was the reset between two holds. **An assertion spanning more than one instance
  is an assertion about the repetition**, which is a different thing from the thing it names — the same
  failure mode as the injection harness that reported seven false greens, and as the build that printed
  `125.5 KB` for a 0-byte file, one level out from the code again.

M0 is built end to end for **Chapter 2 Expansion (1783–1848)** and **Chapter 3 Division (1848–1865)** —
the vertical slice's success criterion is a fifteen-second capture of Chapter 3 — and **all eight**
chapter bundles now exist, including Chapter 1's, which contains no boundary polygon at all.

The story layer is the newest part, and the writing is finished. What remains splits cleanly:
**implementation** work, which is a camera treatment for a place that is not on the drawing (M4 — and
its brief is now a measured list of fourteen places), event markers and city lights, and the quality
tiers with their persistence (M5). No **editorial** work remains; if a chapter's beats need revising,
that is a revision rather than a gap.

## Attribution

The architecture of this project is our own, informed by studying
[sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) by Bill Chan (MIT). No source code
was copied. If any is ever adapted, its MIT notice must be carried in `NOTICE.md` alongside the
existing third-party data terms.
