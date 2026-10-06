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
- **Nothing stacks forever.** An anchor decays into pure paper texture after two chapters and stops
  being geometry — which also bounds fill-rate cost.
- **At most two or three anchors are visible at any moment.**

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
| Shaders | GLSL | Procedural paper, engraved-edge wobble, hatch, dot dispersal |
| Camera and motion | GSAP | |
| Data format | Interval-coded TopoJSON | Simplified per zoom tier, quantized |
| Labels | MSDF text (`troika-three-text`) | Resolution-independent, holds up at any zoom |
| Audio | Web Audio API | Per-chapter ambience, crossfaded; starts on first user gesture |
| Build | Vite, TypeScript | |
| Quality | ESLint, Prettier, Vitest | Tests target the data pipeline, which is the risky part |
| Deploy | Vercel | See the note on GitHub Pages |

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
  **1629-03-04 → 2000-12-31**, dated to the day, WGS84. The national state and territory synthesis
  begins in 1783; county coverage reaches back to 1629. This is the upstream source for the two
  entries below.
- **lmullen/historical-us-boundaries** — an interactive map over the same data, covering
  **1783–1912** (per the project page and the map's own slider domain). Worth taking two things:
  its `CHANGE` field holds a human-readable explanation of each boundary change, and `cw.csv`
  holds secession and re-admission dates. That is the annotation layer for chapters 3 and 4.
- **ropensci/USAboundaries** — an R package over the same AHCB data. Useful for shaping and for
  sanity-checking derived geometry.
- **OpenHistoricalMap** — an OSM-style historical map that also ingests AHCB. Worth evaluating as a
  cross-check.
- **American Panorama**, **Chronicling America** — references for interaction patterns and for
  event and newspaper metadata.

### Coverage limits, stated plainly

- **Nothing before 1629.** Chapter 1 opens in 1607 for the narrative, but boundary geometry only
  exists from 1629. Pre-1629 is represented by settlement lights, never by filled territory.
- **Nothing authoritative after 2000.** Boundaries are effectively static from then on. Chapter 8
  renders contemporary geometry and treats the period as narrative rather than territorial change.
- **Contiguous United States only.** The Mullen map excludes Alaska, Hawaii, and DC; AHCB covers
  them in separate datasets. Decide per chapter whether to include them.

## Licensing

**Code: MIT.** See `LICENSE`.

**Data: not MIT.** AHCB was originally published under CC BY-NC-SA, and some secondary sources —
including rOpenSci's `USAboundaries` documentation — still quote that label. It is superseded. The
Newberry now states that the data may be reused "for any lawful purpose, commercial or
non-commercial, without licensing or permission fees to the library", and that stale CC notices left
in old files "can be ignored".

The practical consequence: the data is free to use, but it must not be swept under our MIT
declaration. Boundary data lives in its own directory with its own `NOTICE` file, and the source is
credited in-product. Attribution is owed in spirit even where the current terms do not demand it.

**Art and audio assets: to be decided.** Original illustration and sound work is ours to license.
Third-party samples must be CC0 or explicitly cleared, and recorded in `NOTICE`.

**Reference material is cited, never bundled.** The documentary is a structural reference; no frames,
audio, or transcript from it enter this repository.

## Roadmap

Revised to be depth-first. This project's product is the way it looks — if the look is wrong,
nothing else saves it. Ten breadth-first tasks would let all of them move while the one thing that
matters stays unverified.

### M0 — Vertical slice: prove the look

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

### M1 — The spine

All eight chapters. Chapter selector, per-chapter time scales, anchor layers, transitions, camera
states. Audio stubbed.

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

Not scaffolded yet. Intended layout:

```
src/
  chapters/     chapter definitions: years, material, anchors, audio, camera
  data/         per-chapter TopoJSON bundles (generated, not committed)
  shaders/      paper, ink, hatching, dot dispersal
  scene/        renderer, camera, material library
pipeline/       shapefile to TopoJSON build scripts
public/audio/   per-chapter ambience
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
- [sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) — time as the core of the scene.
- [Bruno Simon](https://bruno-simon.com/) — creative Three.js.
- [American Panorama](https://dsl.richmond.edu/panorama/) — interactive historical atlas.
- *America: The Story of Us* (History Channel, 2010) — chapter structure reference.
