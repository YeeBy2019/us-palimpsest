<div align="center">

<p><b>English</b> &nbsp;·&nbsp; <a href="./README.zh-CN.md">简体中文</a></p>

<a href="#the-eight-chapters"><img src="docs/media/preview.gif" width="100%" alt="The date cursor running across Chapter 3, Division: the outline of the United States redrawing itself from February 1848 to April 1865, while the story card at the right changes at each dated moment"></a>

<h1>us-palimpsest</h1>

<p><b>An American history map you can walk into.<br>Engraved by hand, dissolved in dots, time as the first citizen.</b></p>

<p>
<a href="#the-eight-chapters"><b>The&nbsp;eight&nbsp;chapters</b></a> &nbsp;·&nbsp;
<a href="#run-it">Run&nbsp;it</a> &nbsp;·&nbsp;
<a href="docs/ARCHITECTURE.md">How&nbsp;it&nbsp;works</a> &nbsp;·&nbsp;
<a href="NOTICE.md">Sources&nbsp;&amp;&nbsp;licence</a>
</p>

<p>
<a href="LICENSE"><img alt="Code: MIT" src="https://img.shields.io/badge/code-MIT-7a6446?style=flat-square"></a>
<a href="NOTICE.md"><img alt="Boundary data: CC0" src="https://img.shields.io/badge/boundary%20data-CC0-7a6446?style=flat-square"></a>
<img alt="three.js r186" src="https://img.shields.io/badge/three.js-r186-3f3f3f?style=flat-square">
<img alt="WebGL 2" src="https://img.shields.io/badge/WebGL-2-3f3f3f?style=flat-square">
<img alt="No TypeScript" src="https://img.shields.io/badge/TypeScript-none-3f3f3f?style=flat-square">
</p>

</div>

<br>

**us-palimpsest** is an interactive 3D atlas of American history, built with Three.js. It draws four
centuries of changing territory onto a single hand-drawn map — boundaries cut per date, cities
lighting up, one chapter dissolving into the next — and it plays: open the page and the film runs,
from Jamestown to the sixth of January, twenty-three minutes and forty-nine seconds across eight
chapters.

The atlas is also **written**. Each chapter carries a sequence of dated moments — a road, a march, a
surrender, a speech — that the cursor stops on and the panel at the right reads. Where the country's
outline has stopped moving, that writing is what the plate is drawn from.

Art direction follows [Chartogne-Taillet](https://chartogne-taillet.com/en) — Immersive Garden with
Bruno Simon, Awwwards Site of the Day, 2 December 2020.

## The eight chapters

Eight chapters, contiguous and non-overlapping: every year belongs to exactly one of them, cut at
inflection dates rather than at episode boundaries. Each is rendered as a single believable physical
substance.

<table>
<tr>
<td width="50%"><img src="docs/media/ch1-founding.webp" alt="Chapter 1, Founding, at October 1781"><br><b>01 &nbsp;Founding</b> &nbsp;<sub>1607–1783 · 2:59</sub><br><sub>Parchment and iron-gall ink — Yorktown, and the routes this chapter is drawn from, because no state boundary begins inside its window.</sub></td>
<td width="50%"><img src="docs/media/ch2-expansion.webp" alt="Chapter 2, Expansion, at June 1846"><br><b>02 &nbsp;Expansion</b> &nbsp;<sub>1783–1848 · 2:56</sub><br><sub>A watercolour wash over wheel ruts — the Oregon Treaty, and a country at its continental width.</sub></td>
</tr>
<tr>
<td><img src="docs/media/ch3-division.webp" alt="Chapter 3, Division, at April 1865"><br><b>03 &nbsp;Division</b> &nbsp;<sub>1848–1865 · 3:20</sub><br><sub>A torn paper edge and a dark red ink stain — Appomattox, after sixty-three boundary changes in seventeen years.</sub></td>
<td><img src="docs/media/ch4-industry.webp" alt="Chapter 4, Industry, at May 1869"><br><b>04 &nbsp;Industry</b> &nbsp;<sub>1865–1900 · 2:56</sub><br><sub>Blueprint ruling and rust — the last spike at Promontory, and the first inset: Alaska arriving on a corner that was water.</sub></td>
</tr>
<tr>
<td><img src="docs/media/ch5-boom.webp" alt="Chapter 5, Boom and Bust, at October 1929"><br><b>05 &nbsp;Boom and Bust</b> &nbsp;<sub>1900–1941 · 3:08</sub><br><sub>Dry newsprint and gold foil going to dust yellow — Black Tuesday, and the boom is over.</sub></td>
<td><img src="docs/media/ch6-wwii.webp" alt="Chapter 6, WWII, at June 1944"><br><b>06 &nbsp;WWII</b> &nbsp;<sub>1941–1945 · 1:59</sub><br><sub>Radar green and gunmetal, the first hard hue break — D-Day, on a window in which not one boundary moves.</sub></td>
</tr>
<tr>
<td><img src="docs/media/ch7-superpower.webp" alt="Chapter 7, Superpower, at July 1969"><br><b>07 &nbsp;Superpower</b> &nbsp;<sub>1945–1989 · 3:32</sub><br><sub>Radar green decaying back toward paper — the Moon, and a country whose outline never moves again.</sub></td>
<td><img src="docs/media/ch8-millennium.webp" alt="Chapter 8, Millennium, at January 2021"><br><b>08 &nbsp;Millennium</b> &nbsp;<sub>1989–2026 · 2:59</sub><br><sub>Clean screen white and survey blue — the sixth of January, at the far end of the record.</sub></td>
</tr>
</table>

Every screenshot is of the film **running**, a couple of seconds into one of its holds; the number
beside each chapter is how long that chapter takes to play.

## Run it

```sh
npm install
npm run data:build    # regenerate the per-chapter bundles from the AHCB source
npm run dev           # http://127.0.0.1:5173
```

`npm run build` writes a static site to `dist/` that any web server can host. The generated chapter
bundles in `data/` are not committed, so `data:build` is what puts them there.

The payload is geometry, so host it somewhere without a 1 GB site cap and a 100 MB file cap —
Vercel, not GitHub Pages.

## Using it

**It plays itself.** Opening the page starts the film and runs all eight chapters in order. Between
dated moments the cursor walks; at a moment it stops for twelve seconds so the panel can be read,
and the dock says so — a countdown above the Play button and a hairline filling under the timeline.
When the chapter ends the next one is announced by its card and begins.

| Control | What it does |
|---|---|
| Chapter selector (top) | jumps straight to a chapter, and the film keeps running |
| Timeline (bottom) | scrubs the date within the chapter; the story panel follows the cursor exactly |
| **Play** / **Pause** | starts and stops the film |
| **Restart** | back to the first chapter |

### Links

Any moment can be opened straight from the URL.

| Parameter | Meaning | Example |
|---|---|---|
| `chapter` | which of the eight to open | `chapter=division` |
| `date` | hold the cursor on a day — `YYYY-MM-DD` or `YYYY-MM` | `date=1861-04-12` |
| `still` | open the view **without** starting the film | `still` |
| `intro` | play the opening title card on the way in | `intro` |

`?chapter=division&date=1861-04-12` opens on Fort Sumter. Add `still` to look at a moment without
starting a screening: `?chapter=wwii&date=1944-06-06&still`.

## What is on the plate

**Boundaries, cut per date.** Nothing is pre-rendered per year. Each feature keeps its start and end
date, so the outline is derived from the date cursor at runtime and the ink grows continuously.

**Anchors.** One to three boundary states from earlier chapters stay on the sheet as desaturated line
work — the 1783 treaty line, the Louisiana Purchase, the 1861 secession line — fading out over the
next two chapters until they are only paper. Earlier ink remains faintly legible: that is what the
name means.

**Inset panels.** Alaska and Hawaii are drawn as separate panels in the lower-left corner, in their
own Albers projections, on the corner of the sheet that is water in every chapter. Each appears on
the day its first geometry does — Alaska 1867, Hawaii 1898 — and then never changes shape. The
District of Columbia is a marker and a label.

**The story panel.** A hundred and eight dated moments across the eight chapters, each with a place,
a title and a paragraph, in English and in Chinese. Twelve of them also carry **figures** — fourteen
routes traced by hand, because the record cannot draw a road, a march or a survey line: among them
the James River, the Great Wagon Road, the road to Concord, Lewis and Clark's route up the Missouri,
the Erie Canal, the Oregon Trail, the Pony Express, Sherman's march and the first transcontinental
railroad.

**Fourteen beats are not on the drawing.** The sheet is fitted to the lower forty-eight, so the
Pacific theatre, the European theatre, the Berlin airlift, Korea, Sputnik, the Gulf, Moscow and
Abbottabad have no place on it; their cards still appear, with no camera target. Ninety beats land
on the sheet and four more land inside a panel.

## Chapters

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

How much each chapter has to draw is a property of the data:

| Chapter | Boundary geometry | Boundary changes in its window | Story beats |
| ------- | ----------------- | ------------------------------ | ----------- |
| 1 Founding | routes only | — | 14 |
| 2 Expansion | yes | 108 features begin | 13 |
| 3 Division | yes | 63 | 15 |
| 4 Industry | yes | 29 | 13 |
| 5 Boom and Bust | yes | 10 | 14 |
| 6 WWII | yes | 0 | 9 |
| 7 Superpower | yes | 0 | 16 |
| 8 Millennium | yes | 0 | 14 |

Chapter 1 has no boundary geometry at all: every feature that reaches its window starts on its
closing day, so the plate is drawn from the routes its own beats carry.

## Coverage

What the sources can and cannot tell us, stated plainly:

- **Nothing before 1629.** Chapter 1 opens in 1607 for the narrative, but boundary geometry only
  exists from 1629, and the bundled state-level record begins later still, at **1783-09-03**.
- **Nothing moves after 1912.** No state was admitted between Arizona in February 1912 and Alaska in
  January 1959, and both 1959 admissions are in the insets, which keep the outline they already had.
  Chapters 6, 7 and 8 draw a fixed coastline and are carried by their writing.
- **AHCB stops at 2000; the record does not.** Chapter 8 closes on **2026-12-31**, a constant bumped
  on purpose rather than `new Date()`, so the build stays reproducible and every deep link stable.
  Its geometry after 2000 comes from TIGER/Line and is interpolated between published states.
- **Alaska, Hawaii and DC are in.** The Alaska purchase (1867) and the annexation of Hawaii (1898)
  both fall inside Chapter 4; Pearl Harbor opens Chapter 6; both become states inside Chapter 7.

## Art direction

- **One material per chapter.** Engraved line, ink wash, watercolour bleed, blueprint grid,
  newsprint, radar phosphor. Materials do not mix inside a chapter.
- **A paper-and-ink spine, with three hard breaks.** Chapters are differentiated by technique — hatch
  density, line weight, wash softness — not by hue. Only Division (dark red), WWII (radar green) and
  Millennium (screen white) take a hard colour.
- **The dot is the only transition.** Disperse, swap, reform is one motion: the dots that dissolve
  the outgoing plate are the same dots that lie down as the incoming one's hatching. There is no
  second transition vocabulary, and no cuts.

<p align="center"><img src="docs/media/handoff.gif" width="100%" alt="Chapter 5 dispersing into a field of dots, settling into Chapter 6's chapter card, and the radar-green plate arriving underneath"></p>
<p align="center"><sub>The hand-off from Chapter 5 to Chapter 6, at real speed.</sub></p>

## Tech stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Renderer | Three.js | WebGL2 |
| Projection | Albers Equal-Area Conic (EPSG:5070) | Area-preserving, so a state's visual weight matches its size. Alaska and Hawaii are insets in their own Albers |
| Shaders | GLSL | Procedural paper, engraved-edge wobble, hatch, dot dispersal |
| Post-processing | Custom GLSL composite | Tone map, paper grain, grade and sharpen-upscale in one pass |
| Camera and motion | GSAP | `timeline` for authored sequences, `quickTo` for continuous state, `set` for snaps |
| Data format | Interval-coded TopoJSON | Simplified at one published tolerance and quantized |
| Labels | MSDF text (`troika-three-text`) | Resolution-independent, holds up at any zoom |
| Audio | Web Audio API | Per-chapter ambience, crossfaded; starts on first user gesture |
| Build | Vite, plain JavaScript | ES modules, no TypeScript |
| Quality | ESLint, Prettier, Vitest | Tests target the data pipeline |

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) specifies the render passes, the shared-uniform
contract, the quality governor and the loading order.

## Data sources

- **Newberry Library — Atlas of Historical County Boundaries (AHCB)**, John H. Long et al. Coverage
  **1629-03-04 → 2000-12-31**, dated to the day, all fifty states and DC. The upstream source for
  the entries below.
- **lmullen/historical-us-boundaries** — the same data, 1783–1912. Its `CHANGE` field carries a
  human-readable note on every boundary change, and `cw.csv` the secession and re-admission dates.
- **TIGER/Line (US Census Bureau)** — the modern boundary source, and the one shipped for Chapter 8.
- **NHGIS / IPUMS** — statistics and cross-checks, never shipped geometry: it is freely available but
  under a limited licence.
- **ropensci/USAboundaries**, **OpenHistoricalMap** — shaping, and cross-checks.
- **American Panorama**, **Chronicling America** — interaction patterns, event and newspaper metadata.

## Licence

**Code MIT**, **boundary data CC0 1.0** — the Newberry places the AHCB in the public domain, so the
two do not conflict. **TIGER/Line** is uncopyrighted and shipped with a Census Bureau
acknowledgement. **NHGIS** is not redistributable without permission, which is why it never supplies
geometry. Full terms and required citations: [`NOTICE.md`](NOTICE.md).

The documentary *America: The Story of Us* is a structural reference. No frame, audio or transcript
from it is in this repository.

## Roadmap

### M0 — Vertical slice: prove the look — done

Chapter 3 only: the pipeline, paper and engraved-edge shaders, a continuous boundary morph, one dot
transition in and one out, the 1861 anchor layer, a two-chapter selector.

### M1 — The spine — in progress

All eight chapters, selector, per-chapter time scales, anchors, transitions, camera states, one
continuous run. Built; what remains on this milestone is sound.

### M2 — Anchors and annotation

Content depth: boundary-change annotations from AHCB's `CHANGE` field, city lights, event markers.

### M3 — Sound

Per-chapter ambience, crossfaded on chapter change, started on the first user gesture.

### M4 — Depth

Camera dive from the map into a local historical scene. This is per-scene 3D art production rather
than data visualisation, and it is also the brief for the fourteen beats that fall off the sheet.

### M5 — Ship

Quality tiers with persistence, keyboard navigation, reduced motion across the dispersals and the
camera, mobile fallback, deployment.

### Non-goals for now

- Real 3D topography.
- County-level geometry.
- Anything before 1629 or after 2000, in *boundary* geometry.

## How it's made

The map is drawn from an offline pipeline; the browser only receives its output.

```
AHCB shapefile
  → filter to a chapter's date range (half-open at the chapter's end)
  → project, each region through its own projector
  → simplify with Douglas-Peucker (one tolerance, from the pixel budget)
  → append the panel frames and the chapter's authored story routes, un-simplified
  → quantize and encode as TopoJSON
  → one bundle per chapter, lazy-loaded
```

| Document | What it covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Render passes, the shared-uniform contract, the quality governor, the loading order, and the reasoning behind every row above. |
| [`NOTICE.md`](NOTICE.md) | The terms of each data source, and the citation each one asks for. |
| [`pipeline/`](pipeline) | The offline tools: the AHCB shapefile in, one TopoJSON bundle per chapter out. |

## Project layout

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
docs/media/       the screenshots and the two previews used by this file
```

## References

- [Chartogne-Taillet](https://chartogne-taillet.com/en) — Immersive Garden, with Bruno Simon and
  Mooders. Art direction and transition reference.
- [sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) — Bill Chan. Technical architecture
  reference.
- [Bruno Simon](https://bruno-simon.com/) — creative Three.js.
- [American Panorama](https://dsl.richmond.edu/panorama/) — interactive historical atlas.
- *America: The Story of Us* (History Channel, 2010) — chapter structure reference.
