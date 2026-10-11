# us-palimpsest

**English** | [简体中文](./README.zh-CN.md)

> An American history map you can walk into. Engraved by hand, dissolved in dots, time as the first citizen.

**us-palimpsest** is an interactive 3D atlas of American history built with Three.js. It draws
the changing territory, the rise of cities, and decisive events onto a single hand-drawn map you
can explore. Time is the primary axis: the timeline advances chapter by chapter, boundaries bleed
outward like ink, cities light up one by one, and one era gives way to the next through a
dispersal of dots that settles back into the paper.

It is also, from the first chapter to the last, **written**: eight chapters carrying a hundred and
eight dated moments — a road, a march, a surrender, a speech — that the cursor stops on and reads.
Where the country's outline has stopped moving, that story is not decoration on the map. It *is* what
the plate is drawn from.

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

## The story layer

Every other layer in this atlas is geometry. A chapter's date range cuts boundaries, the timeline is a
scrub over those boundaries, an anchor is a retained boundary state, the inset panels are boundary
geometry, and the chapter card describes the *material* the plate is printed with. Between them the
atlas knows exactly one kind of fact — **a place whose outline changed on a date** — and that is not
enough to tell the history it is named after.

It is enough for Chapters 2 to 5, where the outline genuinely moves. It is not enough for Chapter 1,
whose window contains no state boundary at all, nor for Chapters 6, 7 and 8, where the outline has
stopped: no state was admitted between 1912 and 1959, so those chapters draw the same coast for their
whole window. A map that can only speak when a border moves has nothing to say about the Second World
War.

So there is a second content type, and it is a different kind of thing rather than more of the same.
A boundary is **derived**: cut it, project it, draw it, and the atlas has said something with nobody's
judgement in it. A story is **authored**: someone has to decide that Pearl Harbor is a moment and that
the Willow Run bomber plant is another, and has to write the sentence. Nothing in AHCB contains the
word *Hiroshima*.

A **beat** is a moment: a date, a place on the earth, and one thing that happened.

```js
{ id: 'd-day', date: '1944-06-06', kind: 'battle',
  place: { lon: -0.87, lat: 49.36, name: 'Normandy, France', nameZh: '法国诺曼底' },
  title: 'D-Day', titleZh: '诺曼底登陆', body: '…', bodyZh: '…' }
```

That lives in `src/timeline/narration.js`. **All eight chapters are written as of 2026-10-10 — a
hundred and eight beats**, from the founding of Jamestown to the attack on the Capitol. A chapter
with no entry there is one that has not been authored yet rather than one that failed to build, which
is a distinction the file keeps even now that nothing is missing from it. Every string is carried in
English and Chinese, the shape `chapters.js` already uses for `name` / `nameZh`; neither version is a
translation of the other.

The beats are written out here from the public record and cite nothing. The documentary is the
chapter spine — `episodes` in `chapters.js` — and no frame, audio or transcript of it enters the
repository; see *Licensing*.

### The one place a line is drawn by hand

Some of what a story has to show is not something the record can draw: a road, a march, a survey line,
a parallel named by an act of Congress rather than by a surveyor. A beat may therefore carry
**`figures`** — one or more polylines in real longitude and latitude, revealed on the plate when the
cursor passes the beat's date, exactly like a boundary.

Fourteen of them, across twelve beats in four chapters. The James River up to Jamestown; the Great
Wagon Road and the crest of the Proclamation Line of 1763; Nemacolin's Path to the Great Meadows; the
road out of Boston to Concord; the allied march to Yorktown; Lewis and Clark; the parallel named by
the Missouri Compromise; the Erie Canal; the 49th parallel and the Oregon Trail; the Pony Express;
Sherman's march to the sea; the first transcontinental railroad.

Three rules, and they are what stops this from becoming a place to put anything:

- **A figure is a corridor, not a survey.** Everything else drawn on this plate is derived and exact.
  A figure is traced from published descriptions and is honest about being approximate — which is why
  each carries a `note`, and why the note says *schematic* when it is one.
- **It belongs to a beat.** A figure has no date of its own; it appears when its beat does. A line no
  sentence needs is decoration.
- **The pipeline reads this field and nothing else.** `pipeline/build.js` projects `figures` into the
  chapter bundle and never looks at `title` or `body`, so a chapter nobody has written still builds
  the same way a written one does. The story layer cannot become a build dependency of the map.

**Chapter 1 would not be on the plate without them.** No state boundary begins anywhere inside its
window — every feature that reaches it starts on its closing day — so the only thing a bundle for that
chapter can draw is its own routes. It is where the atlas stops being a map with a commentary on it
and becomes a commentary with a map.

And a chapter that depends on figures depends on them **from its first frame**, not from its best
beat. Which is a rule this project learned by measuring: Chapter 1's first written routes were dated
1763 and 1781, and the plate was therefore bare paper from 1607 until 1763 — a hundred and fifty-six
of the chapter's hundred and seventy-six years, which is precisely the defect the layer exists to fix.
Three earlier routes, at 1607, 1754 and 1775, are the answer, and the measured check is the darkest
pixel on the sheet: 181 before, 96 after.

They cost the runtime nothing, because a figure enters the bundle as a `LineString` — which is exactly
what the inset panel frames already are. So it inherits the date mask, the fade-in and the dot
dispersal from machinery that was already there: no new uniform, no second material, and no runtime
projection that could disagree with the one the build used.

### It needed no player

The panel is `beatAt(beats, state.date)` — the beat in force at the moment being shown — evaluated in
the frame loop beside the date stamp. There is no story timeline, no queue and no play state. Play
already moved a date; the panel only reads it. Three things then fall out for free rather than having
to be built:

- **Scrubbing tells the story backwards**, because the panel is a function of the cursor rather than
  of a sequence.
- **Deep links carry the story.** `?chapter=wwii&date=1944-06-06` opens on the Normandy card, so a
  moment is something that can be pasted into a message.
- **Play becomes documentary playback**, which is the point of the whole layer.

### It plays itself

Eight written chapters in order are a documentary, so the atlas does not wait to be driven: opening
the page runs it, from Jamestown to the sixth of January, twenty-three minutes and forty-nine seconds
of it. A chapter's length is `TRAVEL_SECONDS + beats × HOLD_SECONDS`, minus nine seconds when its first
beat is the chapter's own opening (that hold is the arrival card's, not reading time; see below), so
each one runs between 1:59 and 3:32 depending on how much there is to say.

That makes the end of a chapter a **hand-off** rather than a terminus, which is the one thing the
feature actually cost. The frame loop used to stop a play-through when the cursor reached the chapter's
end; it now rolls into the next chapter through the dispersal, `playing` surviving the change, and only
the end of the last chapter stops it. Pressing Play on a finished film starts it again from the top,
because the thing that stopped was the whole run rather than one chapter.

Navigating no longer pauses, either. A chapter click during a film means *go to this chapter*, the way
a seek does in a player — pausing there let a viewer browse the selector, switch the film off without
noticing, and come back to a still page wondering what broke. Scrubbing still pauses, because taking
hold of the timeline is leaving the story, and Restart still pauses, because it is a rewind.

One thing holds still, and it is a promise the atlas has already made rather than a preference:

- **`?still`.** A link can name a chapter without starting a screening — sharing "look at Chapter 6"
  should not mean "and then watch it leave". It is now the only way to ask, and that is the point:
  stillness is **legible**. A page that is not moving says so in its own URL, so a viewer can tell a
  deliberate still from a picture that looks broken.

A link naming a date used to be a second, and dropping it is one of two reversals this feature has
made. The rule read well — `?chapter=wwii&date=1944-06-06` is a shot to be looked at, so it stays where
it lands — and it failed in the direction that matters, because **the page writes its own URL**. Within
a second of arriving, the address bar held a date. Every reload, every restored tab, every bookmark of
the page a visitor had just watched was, under that rule, a still frame: autoplay had quietly become a
once-ever event, with nothing on screen to say why. A rule that turns the common case into the
exception is not a rule about links.

What the URL records changed with it. While the cursor is **held** — paused, scrubbed, or arrived by
clicking a chapter — it carries the day, so a pause is a link someone can be sent. While the film runs
it carries the chapter alone: a reload of a moving picture has always meant *start the reel again*,
and writing a day the cursor leaves within a millisecond meant four `history.replaceState` calls a
second for twenty-four minutes. Safari throws after a hundred in thirty seconds, and this runs inside
the frame loop — the first throw would take the page with it, on the one browser the atlas has never
been opened in. It is eight writes for a whole run now.

The second reversal is the motion setting, and it is the same mistake one step further out.
`prefers-reduced-motion` did not hold the film still, it **cancelled** it — on any machine whose
operating system has animations switched off, which is an old laptop tuned for speed, a corporate
image, a remote session, far more often than it is anyone with a vestibular disorder. And the atlas was
already reading that setting two different ways on the same machine: `ui.css` reads it as *milder* —
the chapter card still inks itself in, in 0.6 s instead of two, and the story panel simply appears —
while `shouldAutoplay` read it as *do not run*. Cancelling the content is not a reduction of the
motion, so the setting now reduces, and what it takes away is the pointer parallax: the one motion here
that is both decorative and triggered by an interaction, which is the case WCAG 2.3.3 was written
about. The film's own motion — the cursor advancing, the boundaries redrawing, the dispersal between
chapters — is the thing being conveyed, and a version of this atlas that does not move is a version
with nothing in it.

When the film does not start, the dock says so — *Held still by the link* — beside the Play button, for
exactly as long as the cursor is not moving. That reason is invisible in the picture, and the cost of
leaving such a thing unsaid is the whole shape of both reversals above: a page that declines to move
and says nothing about it is a page that reads as broken.

The same argument applies to the film standing still while it *runs*, which took a second report to
see. A hold is invisible in the picture — for the length of one, the sheet, the stamp and the timeline
are all legitimately still, which is the same frame a page that died is in — and about nine tenths of
the film's running time is spent in one. So the dock draws it as well: a hairline under the timeline
fills while the hold runs out, and a line above the Play button counts it down — *Standing on a beat —
8s*. Both are empty while the cursor is travelling, and both stand still while the film is paused,
which is honest rather than tidy: the clock is stopped too.

### What it did cost, and why a pace was not enough

Playing *is* the date cursor moving, so a chapter with something to read has to stop moving. The
first attempt gave such a chapter a slower *pace* — a fraction of the chapter per second, uniform
across it — sized so the chapter took one hold per beat. Sampled on the real thing, that is not a
documentary: a uniform pace makes **the gap between two dates** the reading time, so Executive Order
9066, two months after Pearl Harbor, was on screen for six seconds while Midway, a year later, sat
there for twenty-seven. Neither number was chosen by anyone; both are artefacts of when the history
happened to happen.

So the cursor **stops** at each beat instead. `holdsFor` is the list of dates to stand at,
`HOLD_SECONDS` is how long to stand there, and the pace degrades into the *walk between* beats. Every
beat now gets the same reading time whether two moments are a month apart or a decade, and the walk
varies instead — which is honest, because the walk is the part nobody has to read. While a beat is
held, the geometry is held too: the frame is a held shot rather than a moving one.

One beat is cheaper than the reading time, and it is the one that matters most. A chapter's **opening**
beat is not discovered, it arrives with the chapter — the chapter card is inking over the sheet to
announce it — so it is held for the length of that card (`OPENING_HOLD_SECONDS`, about three seconds)
and the reading time is kept for the beats that are news. Chapter 1 is the case that forced it. Its
first beat is dated the day the chapter opens, so the film used to *begin* on twelve seconds of a
still, near-empty plate: chapter 1 has no boundary geometry by design, its opening route is a corridor
one per cent of the sheet wide, and the card and the stamp could not change because the date was not
moving. Twelve seconds of that is the first thing anyone sees of this atlas, and it is what "it stops
around 1619" turned out to mean the second time it was reported. Holding an arrival for the length of
its own announcement is also what stops a chapter hand-off reading as eight films with a pause between
them.

The state machine is told a pace, a list of dates, and *two* durations — the reading time and the
arrival — and never learns what is at any of the dates. `src/env/chapter.js` still knows nothing about
history; the whole of the coupling is `applyStoryTiming` in `src/main.js`.

### What the story cannot do yet

**Fourteen of the hundred and eight beats are not on the drawing.** Measured against the real
projection rather than assumed: ninety land on the sheet, four land inside a panel — Pearl Harbor and
two Hawaii beats in the Hawaii inset, the Alaska statehood in the Alaska inset — and fourteen fall off
the paper entirely. They are the Panama Canal, and then the whole of the Pacific and European wars,
the Berlin airlift and the Wall, Korea, Sputnik, the Gulf, the end of the Soviet Union, and the
compound in Abbottabad.

That is what the history does, not a defect in the data. The sheet is fitted to the lower forty-eight,
so at its scale the Pacific is past the west edge and Europe past the east. The alternative would be
to pick an approximate point on the plate and call it Normandy, which lies about where Normandy is —
silently, and in exactly the case where it matters.

So `pipeline.test.js` pins the split rather than the intent. Adding a beat in a place that is not drawn
now forces the question, instead of quietly producing a camera target pointing at nothing. Turning a
place into a camera move is M4's work, and those fourteen are its brief.

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

All eight chapters are built, and what a chapter can show is a property of the data rather than of the
schedule. The state-level record is bounded at both ends: its earliest feature is dated **1783-09-03**
and its last boundary change is **1912-02-14**. So boundary geometry carries Chapters 2 to 5 and then
stops — and from Chapter 6 on, the plate is static by history and the chapter has to be carried by
something else.

| Chapter | Boundary geometry | Boundary change inside the window | Story beats | Notes |
| ------- | ----------------- | --------------------------------- | ----------- | ----- |
| 1 Founding | routes only | — | 14 | AHCB's state-level synthesis begins at 1783, on this chapter's closing day. Carried entirely by its story. See below. |
| 2 Expansion | yes | 108 features begin | 13 | |
| 3 Division | yes | 63 | 15 | |
| 4 Industry | yes | 29 | 13 | |
| 5 Boom and Bust | yes | 10 | 14 | Arizona completes the lower forty-eight on 1912-02-14. |
| 6 WWII | yes | 0 | 9 | Static by history — and the first chapter written the other way: nine beats across 1941–1945, on a window in which not one boundary moves. |
| 7 Superpower | yes | 0 | 16 | The 1959 statehoods are the last dated events in the record, and they change nothing that is drawn: both are in the insets, and each inset keeps the outline it has had since 1867 and 1898. See below. |
| 8 Millennium | yes | 0 | 14 | AHCB ends at 2000-12-31 and the window runs to 2026-12-31; see *Coverage limits*. |

Two things about that table are worth stating at full strength, because both are load-bearing:

- **Chapter 1 has no boundary geometry, and is built anyway.** Every feature that reaches its window
  starts on its closing day, so a bundle cut to boundaries alone would be a hundred and seventy-six
  years of blank paper followed by a map on the last frame. The chapter is instead drawn from the
  routes its own beats carry — the James River, the Great Wagon Road, the Proclamation Line, the road
  to Concord, the march to Yorktown — which is the point at which the story layer stops being a
  companion to the map and becomes the thing the plate is drawn from. AHCB does hold colonial
  boundaries, but from 1629 and at county level; drawing them means adopting a second, much larger
  dataset, and county geometry is a stated non-goal. An empty chapter is indistinguishable from a
  broken one from the outside, and that was the reason for leaving Chapter 1 off in the first place —
  so the pipeline now refuses to write a bundle for a chapter marked `built` that has nothing in it.
- **Chapters 6, 7 and 8 are plates, not histories.** This is not a gap in the data; it is what the
  record says. After 1912 the outline of the country stops moving, so those chapters cannot be
  carried by boundary change and have to be carried by something else — 39 authored beats across the
  three of them, on windows in which not one boundary moves. The inset panels are no help: both
  appear inside Chapter 4, at 1867 and 1898, and are static from the day they appear, so they buy
  Chapter 4 two visual events and buy Chapters 5–8 none at all.

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
| Data format | Interval-coded TopoJSON | Simplified at one published tolerance and quantized — one tier is honest at state level |
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
  → filter to a chapter's date range (half-open at the chapter's end)
  → project, each region through its own projector
  → simplify with Douglas-Peucker (one tolerance, from the pixel budget)
  → append the panel frames and the chapter's authored story routes, un-simplified
  → quantize and encode as TopoJSON
  → one bundle per chapter, lazy-loaded
```

Each feature keeps its `START_DATE` / `END_DATE`, so boundaries are derived per date at runtime
rather than pre-baked per date. There are no snapshot piles to ship — which is also how the
reference project works. The frames and the routes join the bundle *after* simplification, because
both are already the shape someone meant them to be and Douglas-Peucker would only sometimes agree.

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
  bundled state-level record the floor is later still — **1783-09-03** — which is why Chapter 1's
  bundle holds no boundary polygon at all, only the routes its own beats carry: see *Build status*
  above.
- **Nothing moves after 1912.** No state was admitted between Arizona in February 1912 and Alaska in
  January 1959, and the two admissions after that gap move no line either — both are in the insets,
  and the insets keep the outline they already had. Chapters 6, 7 and 8 therefore draw a lower
  forty-eight whose outline is fixed alongside two panels that were fixed long before them, so their
  content comes from another layer — the story layer, which is written. This is a fact about American
  history rather than a shortcoming of the source.
- **AHCB stops at 2000; the record does not.** Chapter 8 runs to the present — literally so: its
  window closes on **2026-12-31**, a constant somebody bumps on purpose rather than `new Date()`,
  because a window that moved at midnight would make the build non-reproducible and every deep link
  unstable. Its geometry from 2000 on comes from **TIGER/Line** and its statistics from **NHGIS**.
  Those sources publish per-census snapshots rather than event-dated intervals, so Chapter 8
  interpolates between fixed states instead of growing continuously. Honest rather than a compromise:
  post-2000 change is real but thin, and the geometry barely moves.
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

All eight chapters are built and navigate — including Chapter 1, which carries no boundary geometry at
all and is drawn entirely from its own story routes. The inset panels are in: both appear inside
Chapter 4, at 1867 and 1898, and each is static from the day it appears. They are the last new shapes
the record draws. Chapters now hand off to one another, so the eight play as one run rather than as
eight things a person has to start; see *It plays itself*. What is left on this milestone is the
sound, which is M3. See *Projection and the insets* for what the panels do and do not buy, and *Build
status* for the chapters.

### M2 — Anchors and annotation

Content depth — exactly where the reference scored lowest with juries (content 7.89 against creativity
8.53). The writing is **done**: all eight chapters carry authored beats, a hundred and eight of them,
and Chapter 1 is drawn from its own. What remains is the other content types — boundary-change
annotations from AHCB's `CHANGE` field, city lights, event markers.

Worth recording what M2 as originally written would have produced. `CHANGE`-field annotations are
sentences like *"Nevada Territory gained from Utah Territory"*: accurate, auto-extracted, and more
talk about the map rather than story. A narrative layer had to be a **new content type** rather than
an extension of that one, because the difference is not subject matter but provenance — geometry is
derived and a story has to be authored by someone. It also had to be allowed to *draw*: eleven of the
fourteen authored figures are not boundaries at all — a river, roads, marches, a canal, a railroad —
and one whole chapter is made of nothing else.

### M3 — Sound

Per-chapter ambience, crossfaded on chapter change, started on the first user gesture. The reference
treats sound as a first-class layer; so do we.

### M4 — Depth

Camera dive from the map into a local historical scene. Note the scale change: this is not data
visualisation, it is per-scene 3D art production — a colonial town, a Civil War field, each an
independent content project. Track it separately and do not let it block M1–M3.

### M5 — Ship

Quality tiers with persistence, keyboard chapter navigation, `prefers-reduced-motion` across the
dispersals and the camera, mobile fallback, deployment. Autoplay already reads the motion setting as
*reduction* — it takes away the pointer parallax and nothing else — and the rest of the motion is still
owed to it; see *It plays itself*.

### Non-goals for now

- **Real 3D topography.** The map is a drawn plane, not a terrain model, until the look is proven
  without it.
- **County-level geometry at launch.** Seventeen thousand plus polygons. State and territory level
  first.
- **Anything before 1629 or after 2000.** Bound to *boundary geometry*, not to the atlas: the story
  runs to the present, and a boundary after 2000 would have to be invented rather than sourced.

## Development

The module layout, the render passes, the quality governor and the loading order are specified in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); in summary:

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
