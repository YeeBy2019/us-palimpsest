# us-palimpsest

**English** | [简体中文](./README.zh-CN.md)

> An American history map you can walk into. Engraved by hand, dissolved in dots, time as the first citizen.

**us-palimpsest** is an interactive 3D atlas of American history built with Three.js. It draws
the changing territory, the rise of cities, and decisive events onto a single hand-drawn map you
can explore. Time is the primary axis: the timeline advances chapter by chapter, boundaries bleed
outward like ink, cities light up one by one, and one era gives way to the next through a
dispersal of dots that settles back into the paper.

Art direction follows [Chartogne-Taillet](https://chartogne-taillet.com/en) — built by Immersive
Garden with Bruno Simon, Awwwards Site of the Day, 2 December 2020. What we take from it: an
engraved-map aesthetic, watercolour washes on visible paper, a restrained palette, and one single
transition device — the animated dot — that carries matter from one scene into the next.

## Aesthetic direction

Five rules, taken from the reference and treated as binding.

**1. One material per chapter.** Each chapter is rendered as a single believable physical
substance: engraved line, ink wash, watercolour bleed, blueprint grid, newsprint, radar phosphor.
Materials do not mix inside a chapter.

**2. A restrained palette with three deliberate breaks.** The reference builds an entire site on a
single colour (`#987654`). We keep a paper-and-ink spine across the whole atlas and differentiate
chapters by *technique* — hatch density, line weight, wash softness, bleed radius — not by hue.
Only three moments earn a hard hue shift: the dark red of Division, the radar green of WWII, and
the screen white of Millennium. Because they are rare, they land.

**3. The dot is the only transition.** One device, applied consistently. The reference never cuts
and never cross-fades; the previous scene is dispersed into dots that become the next scene's
material. We do the same thing, and we do not add a second transition vocabulary.

**4. Time is chaptered, not globally scrubbed.** See *Timeline model* below.

**5. Layers settle, they do not stack.** See *The palimpsest rule* below.

## The palimpsest rule

**Decision: layering is in — but as sediment beneath the paper, not as translucent overlays on top
of it.**

The reasoning comes from the reference. Chartogne-Taillet convinces because everything on screen
belongs to one physical material: engraved line, watercolour, sepia. Its transitions do not
preserve the previous scene — the brush *becomes* bubbles, and the bubbles *become* the next
illustration. A translucent ghost polygon layered over a new scene would break that unity. On an
engraved plate, a faint overlapping outline reads as a registration error, not as history.

So the rule is a scoped yes:

- **Anchors, not every layer.** A chapter may retain at most one to three *anchors* — boundary
  states that were historically decisive (the 1783 treaty line, the 1803 purchase, the 1848
  cession, the 1861 secession line). Not every era, and never the whole history at once.
- **Anchors are drawn in the chapter's own material.** A retained boundary is desaturated engraved
  hatch, never a filled translucent shape.
- **The transition does double duty.** The dots that disperse the outgoing boundary are the same
  dots that then lie down as hatching. Dissolve and deposit are one motion, not two.
- **An anchor is legible for two more chapters, then it is only paper.** The chapter that owns an
  anchor draws it at full strength; the two chapters after that draw it at decreasing hatch density;
  from the third chapter on it is paper texture — no geometry, no fill-rate cost.
- **That window is the visibility cap, not a second rule.** Because the window is two chapters, the
  sheet never carries more than three anchors at once. "At most two or three visible" is the
  arithmetic of the rule above.
- **The window is counted in chapters, not years.** Chapters are the unit of navigation and carry
  their own time scales. Counting in years would be incoherent — the 1783 anchor would persist for
  82 years across Chapters 2 and 3, while one in Chapter 6 would be gone in four. What the
  palimpsest describes is page distance: how many pages ago you saw the ink.

This is what the name means: the paper is reused, and the earlier ink is still faintly legible.

## Chapters

Eight chapters. Contiguous, non-overlapping: every year belongs to exactly one chapter.

| # | Chapter | Years | Documentary episodes | Material family | Transition motif | Audio layer |
| - | ------- | ----- | -------------------- | --------------- | ---------------- | ----------- |
| 1 | Founding | 1607–1783 | 1 Rebels, 2 Revolution | Parchment, iron-gall ink, wax seal | Ink blooming across paper | Church bell, sawing |
| 2 | Expansion | 1783–1848 | 3 Westward | Watercolour wash, wheel ruts | Dust lifting off the map | Wind, wagon wheels |
| 3 | Division | 1848–1865 | 4 Division, 5 Civil War | Torn paper edge, dark red ink stain | The sheet tearing into ash | Distant cannon fire |
| 4 | Industry | 1865–1900 | 6 Heartland, 7 Cities | Blueprint grid, rust | Soot and sparks drifting | Steam rhythm, rail rumble |
| 5 | Boom and Bust | 1900–1941 | 8 Boom, 9 Bust | Dry newsprint, gold foil then dust yellow | Grit flaking off the page | Jazz, city hum, tumbleweed |
| 6 | WWII | 1941–1945 | 10 WWII | Radar green, gunmetal | Dots pulsing outward like radar | Radio static, engines |
| 7 | Superpower | 1945–1989 | 11 Superpower | Radar green decaying toward paper | Dots returning inward | Broadcast, city hum |
| 8 | Millennium | 1989–present | 12 Millennium | Clean screen white, survey blue | A stream of light data | Keyboard, city hum |

### Build status

Seven of the eight chapters have geometry. What a chapter can show is a property of the data,
not of the schedule, and the state-level record is bounded at both ends: its earliest feature is
dated **1783-09-03** and its last boundary change is **1912-02-14**.

| Chapter | Geometry | Boundary change inside the window | Notes |
| ------- | -------- | --------------------------------- | ----- |
| 1 Founding | none | — | AHCB's state-level synthesis begins at 1783, on this chapter's closing day. See below. |
| 2 Expansion | yes | 108 features begin | |
| 3 Division | yes | 63 | |
| 4 Industry | yes | 29 | |
| 5 Boom and Bust | yes | 10 | Arizona completes the lower forty-eight on 1912-02-14. |
| 6 WWII | yes | 0 | Static by history: nothing moved between 1912 and 1959. |
| 7 Superpower | yes | 0 | The 1959 statehoods are the last dated events in the record, and they change nothing that is drawn: each inset keeps the outline it has had since 1867 and 1898. See below. |
| 8 Millennium | yes | 0 | AHCB ends at 2000-12-31; see the TIGER/Line note under *Coverage limits*. |

Two chapters need something the current data does not provide, and neither is a scheduling
problem:

- **Chapter 1 has no geometry at all.** Every feature that reaches its window starts on its closing
  day, so a bundle cut to it would be one hundred and seventy-six years of blank paper followed by a
  map on the last frame. AHCB does hold colonial boundaries, but from 1629 and at county level;
  drawing them means adopting a second, much larger dataset. Left off deliberately — an empty
  chapter is indistinguishable from a broken one from the outside.
- **Chapters 6, 7 and 8 are plates, not histories.** This is not a gap in the data; it is what the
  record says. After 1912 the outline of the country stops moving, so those chapters cannot be
  carried by boundary change and have to be carried by something else — cities and events. The
  inset panels are no help here either: both appear inside Chapter 4, at 1867 and 1898, and are
  static from the day they appear. So they buy Chapter 4 two visual events and buy Chapters 5–8
  none at all.

### What changed from the earlier draft, and why

- **The documentary's episode ranges overlap and leave a gap.** Westward (1803–1860s) and Division
  (1820s–1860) claimed the same forty years; Heartland (1865–1890s) and Cities (1870–1900) the
  same twenty-five. That works for thematic television, but a timeline allows one state per year.
  The chapters above are re-cut at inflection points — 1783 (treaty of Paris), 1848 (Mexican
  Cession), 1865, 1900, 1941, 1945, 1989 — so the ranges no longer collide.
- **The gap at 1783–1803 is closed.** No episode covered it: the Confederation period, the
  Northwest Ordinance of 1787, the Constitutional Convention, and the Louisiana Purchase of 1803.
  These are precisely the decisions that shaped every later boundary. Chapter 2 now owns them.
- **Twelve visual themes were really seven.** Episodes 1≡2, 4≡5, 6≡7 and 10≡11 were given identical
  materials, and 8 and 9 shared newsprint. The table above is the honest count.
- **The merge strategy contradicted the theme table.** It folded episodes 6/7/8 into one continuous
  phase even though episode 8's material (newsprint, gold) differed from 6/7 (blueprint, rust).
  Fixed by splitting at 1900 instead.

## Timeline model

**Continuous inside a chapter, discrete between chapters.** This resolves the tension between
"time as the first citizen" and a chaptered narrative:

- **A chapter is the unit of navigation.** The chapter selector is the primary control — a list of
  chapter names, as in the reference's list of vineyard plots, each one a click away.
- **Within a chapter, time is continuous.** The date can be moved freely; boundaries are derived
  per date from interval-coded geometry, so ink genuinely grows rather than switching between
  stored frames.
- **Each chapter carries its own time scale.** Chapters do not compete for a fixed share of the
  axis, so a four-year chapter is not crushed against a hundred-and-sixty-year one. This is the
  crowding problem, solved by construction rather than by hand-tuning.
- **Anchors are declared per chapter.** One to three anchor boundary states plus a set of key
  events, sourced from AHCB's `CHANGE` field, which carries a human-readable explanation of every
  boundary change.

## Tech stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Renderer | Three.js | WebGL2 |
| Projection | Albers Equal-Area Conic (EPSG:5070) | The published national grid — what the USGS, the Census Bureau and the *National Atlas* use. Alaska and Hawaii are drawn as insets in their own Albers |
| Shaders | GLSL | Procedural paper, engraved-edge wobble, hatch, dot dispersal |
| Post-processing | Custom GLSL composite | Tone map, paper grain, grade and sharpen-upscale in one pass. No `EffectComposer` |
| Camera and motion | GSAP | `timeline` for authored sequences, `quickTo` for continuous state, `set` for snaps — see the note below |
| Data format | Interval-coded TopoJSON | Simplified per zoom tier, quantized |
| Labels | MSDF text (`troika-three-text`) | Resolution-independent, holds up at any zoom |
| Audio | Web Audio API | Per-chapter ambience, crossfaded; starts on first user gesture |
| Build | Vite, plain JavaScript | ES modules. No TypeScript: the shader work lives in injected GLSL strings and uniform objects, where types earn little and cost friction |
| Quality | ESLint, Prettier, Vitest | Tests target the data pipeline, which is the risky part |
| Deploy | Vercel | See the note on GitHub Pages |

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) specifies the render passes, the shared-uniform
contract, the quality governor and the loading order, and gives the reasoning behind the rows
above.

### The data pipeline is the real work

AHCB ships a national shapefile of roughly 142 MB containing overlapping date-coded polygons. None
of it can reach a browser as-is. The pipeline is:

```
AHCB shapefile
  → filter to a chapter's date range
  → simplify with mapshaper (tolerance tuned per zoom tier)
  → quantize and encode as TopoJSON
  → one bundle per chapter, lazy-loaded
```

Each feature keeps its `START_DATE` / `END_DATE`, so boundaries are derived per date at runtime
rather than pre-baked per date. There are no snapshot piles to ship — which is also how the
reference project works.

### Animation: GSAP, and why it is not hand-rolled

An earlier draft of this table said *no animation library*, following the reference. That was
reversed. The reference hand-rolls its easing because it never has to choreograph overlapping
sequences — its cinematic mode cuts between six composed shots with a single progress value. **M4 is
the case that changes the answer**: flying the camera from the map into a historical scene is
authored, multi-track motion — overlapping timelines, staggered elements, hand-tuned curves — which
is what a timeline library is for. Adopting it at M0 means the camera director is written once, in
the vocabulary M4 already needs.

Three uses, kept distinct:

- **Authored sequences** — chapter transitions, the camera director, the dot dispersal — are
  `gsap.timeline`.
- **Continuous state** — chapter weights, the date cursor, the camera following a drag — is
  `gsap.quickTo`, which re-aims at a moving target every frame instead of rebuilding a tween.
- **Snaps** — deep links and chapter jumps — are `gsap.set`.

### Projection and the insets

The map is drawn in the **Albers Equal-Area Conic projection** (EPSG:5070, NAD83 / Conus Albers).
It is the standard for country-scale US maps — the USGS, the Census Bureau and the *National Atlas
of the United States* all use it — for a reason specific to us: it preserves area exactly, so a
state's visual weight matches its real size. Mercator preserves angle instead, which is what makes
square map tiles possible and why it is the standard for web maps; but its area error grows as
1/cos²(latitude), reaching about 4× at 60°N. Drawn in Mercator, Alaska would read several times its
true size against the lower forty-eight. That is the wrong tool for a map whose entire subject is
territory.

**Alaska and Hawaii are inset panels**, not part of the main field. This is the period-correct
solution — historical US maps carried them that way — and the one the projection literature
recommends, since forcing a single projection across the full latitude range distorts all three
areas at once. Alaska uses Alaska Albers (EPSG:3338), Hawaii its own conic; the arrangement is the
composite layout `d3-geo`'s `geoAlbersUsa` implements. The District of Columbia is 68 square miles —
at state-level simplification it is a marker and a label, not a polygon.

**The panels hold a fixed place on the sheet, and the sheet does not grow to hold them.** Each
panel is fitted once, from the whole record, into a rectangle that is open water in every chapter:
the lower-left corner of the sheet, below the Gulf coast and west of Texas. Measured against the
projected mainland, each rectangle clears every piece of land by roughly 0.012 sheet units — some
55 km at the sheet's scale — and that clearance is asserted by exact polygon-to-rectangle
intersection in `pipeline.test.js`, not by eye. There is therefore nothing to reserve and nothing
to re-frame: the space is already there. An earlier draft of this document said the sheet grows
when the date reaches 1867 and the camera reframes with it. That was wrong, and it was wrong for a
reason worth keeping: the panels were assumed to need room, and nobody had measured the corner.

**What is tied to the date is the panel's contents, not its place.** Alaska's first geometry is the
1867-03-30 purchase; Hawaii's is the 1898-07-07 annexation. Until the date cursor reaches them the
panel is not drawn and the corner stays water. The frame arrives on the same day as the first thing
inside it, which is why it is hung off the data rather than written down — the rule is "a frame is
as old as the oldest geometry it contains" — and it never leaves, because a frame is not a
boundary. An inset appearing is a boundary event; an inset *being there* is cartography.

**Which is just as well, because the panels never change shape.** Alaska's outline is identical in
all four of its dated versions — department 1867, district 1884, territory 1912, state 1959 — and
Hawaii's is identical in all three of its own. Hashing the projected coordinates of every inset
geometry in every bundle collapses **fifteen geometries onto exactly two shapes**. AHCB
re-registers one outline under a new political name each time; the extent never moves. So what the
panels contribute is *appearance*, not motion: a corner that was water is Alaska from 1867 on, and
after that the only thing that changes inside it is the name. That is a smaller contribution than
"two more chapters' worth of boundary" and it is worth stating at full strength, because it is the
argument for the annotation layer being a milestone rather than garnish — inside a panel, the
`CHANGE` field and the label *are* the history, and there is nothing else to show.

**Routing, not exclusion, is what keeps the insets off the mainland sheet.** A single Albers
projection cannot place Alaska or Hawaii — not because it errors, but because it does not: it
returns finite coordinates that fall outside the sheet the lower forty-eight are fitted to, and
they get drawn anyway. Measured before this was handled, Alaska left a sliver across the top-left
corner of the sheet and cost 6,671 points per version, about 44 per cent of those chapters'
payload and half their triangulation, on geometry that was not on the drawing.

The first fix for that was a filter: `pipeline/lib/placeable.js` asked "should this be projected?"
and dropped what failed. That is the wrong shape of guard, and it has been deleted. A filter is
wrong about a *mainland* feature silently — the feature disappears and the map still looks like a
map — and it cannot express "Alaska belongs in the Alaska projection", only "Alaska is not
allowed". The rule is now a routing table, `pipeline/lib/regions.js`: each geometry is assigned a
region by its id, and each region has its own projector and its own fit. A geometry cannot fail to
be projected, so the failure mode is no longer *something is missing* but *something is in the
wrong place* — and wrong-place is visible on screen. `pipeline.test.js` pins both halves: that
`ak_*` and `hi_*` route to their panels, and that the mainland projection still returns finite
coordinates for Alaska, which is the exact fact the filter was compensating for and the reason an
inset drawn by accident used to look plausible.

The projection is fixed for the whole atlas. An anchor must lie exactly beneath the boundary that
succeeds it; re-projecting per chapter would break that registration deliberately.

### Why not GitHub Pages

Pages caps a site at 1 GB, a single file at 100 MB, and does not support Git LFS. That is the wrong
shape for a project whose payload is geometry. Use Vercel — or keep Pages and cap the initial
bundle to a single chapter.

### Performance

The reference deliberately degrades quality rather than dropping frames: it samples frame rate at
key moments, lowers parameters when it falls short, and remembers the chosen quality level per
browser. Adopt the same approach. Target 60 fps on a mid-range laptop with an integrated GPU, and
require every quality tier to stay legible.

## Data sources

- **Newberry Library — Atlas of Historical County Boundaries (AHCB)**, John H. Long et al., Dr.
  William M. Scholl Center for American History and Culture. Coverage
  **1629-03-04 → 2000-12-31**, dated to the day, WGS84; **all fifty states and the District of
  Columbia**, Alaska and Hawaii included. The national state and territory synthesis begins in 1783;
  county coverage reaches back to 1629. The national data files were released in 2012, all fifty
  states were documented by 2010, and the project is now closed. This is the upstream source for the
  two entries below.
- **lmullen/historical-us-boundaries** — an interactive map over the same data, covering
  **1783–1912** (per the project page and the map's own slider domain). Worth taking two things:
  its `CHANGE` field holds a human-readable explanation of each boundary change, and `cw.csv`
  holds secession and re-admission dates. That is the annotation layer for chapters 3 and 4.
- **ropensci/USAboundaries** — an R package over the same AHCB data. Useful for shaping and for
  sanity-checking derived geometry.
- **OpenHistoricalMap** — an OSM-style historical map that also ingests AHCB. Worth evaluating as a
  cross-check.
- **NHGIS / IPUMS (University of Minnesota)** — boundary files for states and counties back to 1790,
  every census unit from 1990, and the population tables that would drive city lights and settlement
  density. Free of charge, but a **limited licence**: citation required, redistribution not permitted
  without permission. That is why it supplies statistics and cross-checks rather than the geometry we
  ship.
- **TIGER/Line (US Census Bureau)** — the modern boundary source, and the one we ship. It is not
  copyrighted and may be used in a product with acknowledgement. NHGIS's own files from 1990 on are
  a light repackaging of it, so this is the same information under a simpler licence.
- **American Panorama**, **Chronicling America** — references for interaction patterns and for
  event and newspaper metadata.

### Coverage limits, stated plainly

- **Nothing before 1629.** Chapter 1 opens in 1607 for the narrative, but boundary geometry only
  exists from 1629. Pre-1629 is represented by settlement lights, never by filled territory. In the
  bundled state-level record the floor is later still — **1783-09-03** — which is why Chapter 1 has
  no bundle: see *Build status* above.
- **Nothing moves after 1912.** No state was admitted between Arizona in February 1912 and Alaska in
  January 1959, and the two admissions after that gap move no line either — both are in the insets,
  and the insets keep the outline they already had. Chapters 6, 7 and 8 therefore draw a lower
  forty-eight whose outline is fixed alongside two panels that were fixed long before them, so their
  content has to come from another layer. This is a fact about American history rather than a
  shortcoming of the source.
- **AHCB stops at 2000; the record does not.** Chapter 8 runs to the present, so its geometry from
  2000 on comes from **TIGER/Line** and its statistics from **NHGIS**. Those sources publish
  per-census snapshots rather than event-dated intervals, so Chapter 8 interpolates between fixed
  states instead of growing continuously. Honest rather than a compromise: post-2000 change is real
  but thin, and the geometry barely moves.
- **Alaska, Hawaii and the District of Columbia cannot simply be dropped.** The Mullen map excludes
  them, and an earlier draft of this document inherited that scope without examining it. AHCB itself
  covers all fifty states and the District. Excluding them is not historically neutral: the Alaska
  purchase (1867) and the annexation of Hawaii (1898) both fall inside Chapter 4; Chapter 6 opens on
  Pearl Harbor; the Aleutian campaign of 1942–43 is the only fighting on North American soil; both
  become states in 1959, inside Chapter 7; and the capital has been in the District since 1800, with
  Alexandria County retroceded to Virginia in 1846 — a genuine boundary change. Both *that* they
  appear and *how* they are drawn are now settled: inset panels for Alaska and Hawaii, a marker for
  the District. See *Projection and the insets* above.

## Licensing

**Code: MIT.** See `LICENSE`.

**Data: CC0 1.0, and no longer ambiguous.** AHCB was originally published under CC BY-NC-SA, and some
secondary sources — including rOpenSci's `USAboundaries` documentation — still quote that label. It
has since been superseded twice over: the Newberry's rebuilt site (2025) states plainly that the
Atlas data is released under **Creative Commons CC0 1.0 Universal (Public Domain Dedication)** and
"may be used without requesting permission".

That closes the question an earlier draft of this document left open. CC0 is a public-domain
dedication, so the data can live inside a repository whose code is MIT without either licence
touching the other — the two no longer need to be kept apart out of caution.

We still keep boundary data in its own directory with its own `NOTICE` file, and credit the source
in-product. Not because the terms demand it — they do not — but because forty years of session-law
transcription by named people should not become anonymous, and a compilation of this quality
deserves to be cited.

**The modern sources are not CC0, and are treated as what they are.** AHCB's openness is the
exception rather than the rule. **TIGER/Line** is not copyrighted and may be redistributed with a
Census Bureau acknowledgement, so that is what Chapter 8's geometry ships as. **NHGIS** is free of
charge but is under a limited licence: citation required, redistribution not permitted without
permission, and altered data not redistributable without renaming the dataset and shipping
FGDC-compliant metadata. So NHGIS supplies statistics and cross-checks and never shipped geometry —
its 1990-onward boundary files are a light repackaging of TIGER/Line in any case. Both sets of terms,
with the required citations, are recorded in `NOTICE.md`.

**Art and audio assets: to be decided.** Original illustration and sound work is ours to license.
Third-party samples must be CC0 or explicitly cleared, and recorded in `NOTICE`.

**Reference material is cited, never bundled.** The documentary is a structural reference; no frames,
audio, or transcript from it enter this repository.

## Roadmap

Revised to be depth-first. This project's product is the way it looks — if the look is wrong,
nothing else saves it. Ten breadth-first tasks would let all of them move while the one thing that
matters stays unverified.

### M0 — Vertical slice: prove the look — **done**

One chapter, chosen for the most dramatic boundary change and the cleanest material: **Chapter 3,
Division (1848–1865)**.

- Data pipeline for that chapter only
- Procedural paper and engraved-edge shader
- Continuous boundary morph inside the chapter
- One dot transition in, one out
- One anchor layer — the 1861 secession line, still legible beneath the 1865 state
- A two-chapter selector, so the transition can actually be felt

*Success criterion:* a fifteen-second capture that makes someone ask how it was made. If it does not,
iterate on the shader before writing another feature.

### M1 — The spine — **in progress**

All eight chapters. Chapter selector, per-chapter time scales, anchor layers, transitions, camera
states. Audio stubbed.

Seven of eight chapters are built and navigate; Chapter 1 is blocked on pre-1783 data rather than on
code. The inset panels are in: both appear inside Chapter 4, at 1867 and 1898, and each is static
from the day it appears. They are the last new shapes the record draws. See *Projection and the
insets* for what they do and do not buy, and *Build status*.

### M2 — Anchors and annotation

Boundary-change annotations from AHCB's `CHANGE` field, city lights, event markers. This is content
depth — exactly where the reference scored lowest with juries (content 7.89 against creativity 8.53).
Treat it as a feature, not garnish.

### M3 — Sound

Per-chapter ambience, crossfaded on chapter change, started on the first user gesture. The reference
treats sound as a first-class layer; so do we.

### M4 — Depth

Camera dive from the map into a local historical scene. Note the scale change: this is not data
visualisation, it is per-scene 3D art production — a colonial town, a Civil War field, each an
independent content project. Track it separately and do not let it block M1–M3.

### M5 — Ship

Quality tiers with persistence, keyboard chapter navigation, `prefers-reduced-motion`, mobile
fallback, deployment.

### Non-goals for now

- **Real 3D topography.** The map is a drawn plane, not a terrain model, until the look is proven
  without it.
- **County-level geometry at launch.** Seventeen thousand plus polygons. State and territory level
  first.
- **Anything before 1629 or after 2000.**

## Development

Not scaffolded yet. The module layout, the render passes, the quality governor and the loading
order are specified in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); in summary:

```
src/
  main.js         boot, the frame loop, input, the glue between systems
  core/           render passes, the composite, one set of uniforms, loaders
  env/            chapter state: weights, palette, date -> the shared uniforms
  world/          paper, boundaries, anchors, labels, camera
  fx/             dots, city lights, ink bloom
  timeline/       the eight chapters and their narration
  audio/          per-chapter ambience
  ui/             loader, chapter cards, selector, dock, deep links
pipeline/         AHCB shapefile -> per-chapter TopoJSON bundles
public/           the favicon set; fonts and textures — shipped as they are
data/             generated chapter bundles (not committed)
```

```
npm install
npm run data:build    # regenerate chapter bundles from AHCB source
npm run dev
npm run build
```

## References

- [Chartogne-Taillet](https://chartogne-taillet.com/en) — Immersive Garden, with Bruno Simon and
  Mooders. Art direction and transition reference.
- [sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) — Bill Chan. Technical architecture
  reference: a plain-JavaScript three.js scene with no framework, one shared uniform set, an
  adaptive render scale, and a single transition device. What we take from it, and what we do not,
  is set out in `docs/ARCHITECTURE.md`.
- [Bruno Simon](https://bruno-simon.com/) — creative Three.js.
- [American Panorama](https://dsl.richmond.edu/panorama/) — interactive historical atlas.
- *America: The Story of Us* (History Channel, 2010) — chapter structure reference.
