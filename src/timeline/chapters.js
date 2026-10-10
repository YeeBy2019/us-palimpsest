/**
 * The eight chapters.
 *
 * One source of truth, imported by both the offline pipeline (which needs the
 * date ranges to cut per-chapter geometry) and the runtime (which needs the
 * materials, the anchors and the narration). If a chapter's years change here,
 * the next `npm run data:build` follows.
 *
 * Chapters are contiguous and non-overlapping: every instant belongs to exactly
 * one of them. That is what lets the timeline be continuous inside a chapter
 * and discrete between chapters without the two ever disagreeing.
 *
 * **The bounds are inflection dates, not calendar years.** An earlier draft of
 * the README gave integer ranges — 1783–1848, 1848–1865 — which quietly made
 * 1848 belong to two chapters at once, contradicting the rule that every year
 * has exactly one owner. It also made "Chapter 6 opens on Pearl Harbor"
 * unwriteable, since Pearl Harbor is in December. Each chapter therefore opens
 * on a dated event and closes where the next one opens, and the years printed
 * in the README are the reading of those dates rather than the definition of
 * them.
 *
 * Palette note. The atlas keeps a paper-and-ink spine throughout and
 * differentiates chapters by *technique* — hatch density, line weight, wash
 * softness, bleed radius — rather than by hue. Exactly three chapters are
 * allowed a hard hue shift: Division (dark red), WWII (radar green) and
 * Millennium (screen white). Because the shift is rare, it lands.
 *
 * ## What `built` means
 *
 * `built` says "a bundle for this chapter exists on disk", and the pipeline
 * skips every chapter without it. It is a function of the *content*, not of the
 * schedule: a chapter is buildable when it has something to draw inside its
 * window — boundary geometry from AHCB, or the authored `figures` that a beat
 * may carry (see `timeline/narration.js`). All eight carry one as of
 * 2026-10-10; before the story layer existed, Chapter 1 did not.
 *
 * Measured against the bundled state-level record, the boundary half of that
 * splits the atlas in two. The record's earliest feature is dated 1783-09-03
 * and its last boundary change is 1912-02-14, so:
 *
 * - **Chapter 1, Founding (1607–1783) has no boundary content, and never
 *   will.** Every one of the fifteen features reaching its window starts on
 *   1783-09-03 — the day the chapter *closes*. AHCB does hold colonial
 *   boundaries, but from 1629 onward and at county level; drawing them means
 *   adopting a second, much larger dataset, and county geometry is a stated
 *   non-goal for now. So this chapter is carried **entirely** by the story
 *   layer: its bundle holds no boundary polygon at all, only the routes its own
 *   beats carry. It is the chapter that proves the layer is not decoration. See
 *   `docs/ARCHITECTURE.md`.
 * - **Chapters 6, 7 and 8 are buildable but boundary-static.** No state was
 *   admitted between 1912 and 2000, so nothing inside those windows moves.
 *   They are not empty — each draws the full forty-eight-state plate plus the
 *   two inset panels, and the all-`aFrom`-zero path is a genuinely different
 *   code path from the one the first four chapters exercise. Their content is
 *   not boundaries, though. It is the story layer — 39 authored beats across
 *   the three of them. And the panels do not rescue them: each panel is static
 *   from the day it appears inside Chapter 4, because AHCB records every version
 *   of Alaska's outline as the same shape under a new name. See
 *   `timeline/narration.js` and the README.
 * - `audio` strings are authored and unread; sound is M3.
 *
 * ## The material numbers
 *
 * A note on `hatchScale`, because the numbers look extreme against a paper map's
 * fashions. Real engraving runs to hundreds of lines per inch, which is far below
 * one screen pixel, so the useful range here is the range in which hatching is
 * *legible as hatching* — roughly 60 to 400 lines across the sheet, which is a
 * spacing of three to twenty pixels on a laptop. Below that the land reads as
 * flat wash; above it the lines alias into moiré whenever the governor drops the
 * render scale. The values are therefore a rendering decision, not a historical
 * one, chosen so that four chapters' worth of tonal difference is visible side by
 * side.
 */

import { isoToN, isoToYear } from '../lib/dates.js';

/** Sepia spine the whole atlas is built on. */
export const SPINE = {
  paper: 0xefe4cd,
  ink: 0x33291f,
  sepia: 0x987654,
};

// Re-exported so callers can keep importing the date helpers from the module
// that defines the dates. The implementations live in `lib/dates.js` because
// the runtime needs them too.
export { isoToN, isoToYear };


/**
 * A chapter's material is a set of numbers, not a set of textures. Everything
 * the shader needs to draw the chapter's own substance is in here, which is why
 * a chapter change can reach the whole frame in a single uniform write.
 *
 * @typedef {object} ChapterMaterial
 * @property {string} family      human-readable name of the physical substance
 * @property {number} paper       paper tint for this chapter
 * @property {number} ink         engraved line colour
 * @property {number} accent      the hue the chapter is allowed to reach for
 * @property {number} accentMix   0 = never use the accent, 1 = use it undiluted
 * @property {number} hatchScale  hatch lines across the sheet's width
 * @property {number} hatchAngle  hatch direction, radians
 * @property {number} lineWeight  engraved line weight, in sheet units
 * @property {number} bleed       how far ink creeps past a boundary, sheet units
 * @property {number} grain       paper grain depth
 */

/**
 * Build a chapter, deriving the numeric bounds from the two inflection dates so
 * that the dates stay the single source and the numbers cannot drift from them.
 */
function chapter(spec) {
  return {
    ...spec,
    start: isoToYear(spec.from),
    end: isoToYear(spec.to),
    startN: isoToN(spec.from),
    endN: isoToN(spec.to),
  };
}

/**
 * Where the atlas's story stops, as a fixed date rather than `new Date()`.
 *
 * A chapter window that moved at midnight would make the build non-reproducible
 * and every deep link unstable, so the present is a constant that somebody
 * bumps on purpose. It is the end of Chapter 8 and nothing else, and it is
 * declared here rather than beside that chapter because the array literal below
 * reads it during module evaluation.
 */
const NARRATIVE_PRESENT = '2026-12-31';

/** @type {Array<object>} */
export const CHAPTERS = [
  chapter({
    id: 'founding',
    index: 0,
    name: 'Founding',
    nameZh: '建国',
    from: '1607-05-14',
    to: '1783-09-03',
    episodes: '1 Rebels, 2 Revolution',
    material: {
      family: 'Parchment, iron-gall ink, wax seal',
      paper: 0xe8dcc0,
      ink: 0x3a3026,
      accent: 0x8a5a2b,
      accentMix: 0.15,
      hatchScale: 90,
      hatchAngle: 0.62,
      lineWeight: 1.5,
      bleed: 0.5,
      grain: 0.55,
    },
    transition: 'Ink blooming across paper',
    audio: 'Church bell, sawing',
    // Built, but with no boundary geometry inside it: no feature in the record
    // begins before this window closes, so the bundle holds only the routes the
    // chapter's own beats carry (see `timeline/narration.js`). A chapter with
    // no plate and a written story is not an empty chapter — the panel, the
    // ticks and the play-through all work — and it is the honest drawing of a
    // period in which there was no United States to outline.
    built: true,
  }),
  chapter({
    id: 'expansion',
    index: 1,
    name: 'Expansion',
    nameZh: '扩张',
    from: '1783-09-03',
    to: '1848-02-02',
    episodes: '3 Westward',
    material: {
      family: 'Watercolour wash, wheel ruts',
      paper: 0xf1e6d0,
      ink: 0x4a3b2a,
      accent: 0x8a6f4a,
      accentMix: 0.22,
      hatchScale: 120,
      hatchAngle: 0.5,
      lineWeight: 1.6,
      bleed: 0.85,
      grain: 0.35,
    },
    transition: 'Dust lifting off the map',
    audio: 'Wind, wagon wheels',
    built: true,
    anchors: [
      {
        id: 'treaty-1783',
        date: '1783-09-03',
        label: 'Treaty of Paris',
        detail:
          'The United States is bounded by the Great Lakes, the Mississippi and the 31st parallel — the line every later claim is argued from.',
      },
      {
        id: 'purchase-1803',
        date: '1803-12-20',
        label: 'Louisiana Purchase',
        detail:
          'France cedes 828,000 square miles west of the Mississippi for fifteen million dollars, doubling the country in a stroke.',
      },
    ],
  }),
  chapter({
    id: 'division',
    index: 2,
    name: 'Division',
    nameZh: '分裂',
    from: '1848-02-02',
    to: '1865-04-09',
    episodes: '4 Division, 5 Civil War',
    material: {
      family: 'Torn paper edge, dark red ink stain',
      paper: 0xf0e2c8,
      ink: 0x2b221a,
      accent: 0x7a1e22,
      accentMix: 0.6,
      hatchScale: 220,
      hatchAngle: -0.35,
      lineWeight: 2.2,
      bleed: 1.15,
      grain: 0.5,
    },
    transition: 'The sheet tearing into ash',
    audio: 'Distant cannon fire',
    built: true,
    anchors: [
      {
        id: 'secession-1861',
        date: '1861-04-12',
        label: 'Secession',
        detail:
          'Eleven states have left the Union. The line drawn here is the boundary as it stood the day Fort Sumter was fired on, and it stays legible beneath every boundary that follows it.',
      },
    ],
  }),
  chapter({
    id: 'industry',
    index: 3,
    name: 'Industry',
    nameZh: '工业',
    from: '1865-04-09',
    to: '1900-01-01',
    episodes: '6 Heartland, 7 Cities',
    material: {
      family: 'Blueprint grid, rust',
      paper: 0xe6e2d4,
      ink: 0x2f3a44,
      accent: 0x8a4b28,
      accentMix: 0.3,
      hatchScale: 280,
      hatchAngle: 0,
      lineWeight: 1.3,
      bleed: 0.6,
      grain: 0.3,
    },
    transition: 'Soot and sparks drifting',
    audio: 'Steam rhythm, rail rumble',
    built: true,
    anchors: [
      {
        id: 'dakota-1889',
        date: '1889-11-02',
        label: 'Four states in nine days',
        detail:
          'One territory becomes two: Dakota is split and North and South Dakota are admitted the same day, with Montana following six days later and Washington three days after that.',
      },
      {
        id: 'utah-1896',
        date: '1896-01-04',
        label: 'Utah admitted',
        detail:
          'Utah enters the Union as the forty-fifth state, filling the interior. Only Oklahoma, New Mexico and Arizona are still outside it, and the unbroken federal territory the century opened with has all but gone.',
      },
    ],
  }),
  chapter({
    id: 'boom',
    index: 4,
    name: 'Boom and Bust',
    nameZh: '繁荣与萧条',
    from: '1900-01-01',
    to: '1941-12-07',
    episodes: '8 Boom, 9 Bust',
    material: {
      family: 'Dry newsprint, gold foil then dust yellow',
      paper: 0xded6be,
      ink: 0x33302a,
      accent: 0xa8842f,
      accentMix: 0.35,
      hatchScale: 180,
      hatchAngle: 0.18,
      lineWeight: 1.4,
      bleed: 0.7,
      grain: 0.62,
    },
    transition: 'Grit flaking off the page',
    audio: 'Jazz, city hum, tumbleweed',
    built: true,
    anchors: [
      {
        id: 'oklahoma-1907',
        date: '1907-11-16',
        label: 'Oklahoma admitted',
        detail:
          'Oklahoma Territory and Indian Territory are joined and admitted as a single state, the forty-sixth — the last large block of the map to be given a state boundary.',
      },
      {
        id: 'arizona-1912',
        date: '1912-02-14',
        label: 'The outline stops moving',
        detail:
          'Arizona is admitted six weeks after New Mexico, and the forty-eight contiguous states are complete. Every chapter after this one draws the same coast, which is why the atlas has to change its subject matter to keep time visible.',
      },
    ],
  }),
  chapter({
    id: 'wwii',
    index: 5,
    name: 'WWII',
    nameZh: '二战',
    from: '1941-12-07',
    to: '1945-08-15',
    episodes: '10 WWII',
    material: {
      family: 'Radar green, gunmetal',
      paper: 0xd9dcc9,
      ink: 0x1e3a2a,
      accent: 0x2f8f52,
      accentMix: 0.85,
      hatchScale: 320,
      hatchAngle: 0.9,
      lineWeight: 1.2,
      bleed: 0.9,
      grain: 0.28,
    },
    transition: 'Dots pulsing outward like radar',
    audio: 'Radio static, engines',
    // Buildable, and deliberately anchorless. Not one boundary in this window
    // moves: the wartime states are the ones Arizona completed in 1912, so
    // there is no earlier line to leave as sediment — a pinned anchor here
    // would draw the live map's own outline a second time, a fraction of a
    // pixel off itself, which reads as a printing fault rather than as memory.
    //
    // What carries this chapter is the story layer: nine authored beats in
    // `narration.js`, from Pearl Harbor to the surrender. It is the first
    // chapter written that way, and the clearest evidence that the layer is
    // needed rather than decorative — there is no boundary content to fall back
    // on at all.
    built: true,
  }),
  chapter({
    id: 'superpower',
    index: 6,
    name: 'Superpower',
    nameZh: '超级大国',
    from: '1945-08-15',
    to: '1989-11-09',
    episodes: '11 Superpower',
    material: {
      family: 'Radar green decaying toward paper',
      paper: 0xe4e0cc,
      ink: 0x2a3a30,
      accent: 0x3f8a63,
      accentMix: 0.4,
      hatchScale: 200,
      hatchAngle: -0.2,
      lineWeight: 1.3,
      bleed: 0.7,
      grain: 0.4,
    },
    transition: 'Dots returning inward',
    audio: 'Broadcast, city hum',
    // Buildable as a plate, and the one chapter whose two dated events are
    // entirely inset. Alaska (1959-01-03) and Hawaii (1959-08-21) become states
    // here, and both are `ak_*`/`hi_*` geometries, so both are drawn inside a
    // panel rather than on the sheet.
    //
    // That does not give this chapter boundary content, and it is worth being
    // exact about why, because the obvious reason is wrong. It is not that the
    // insets never reach the bundle — they do, now that they are routed rather
    // than filtered. It is that the outline does not change: hashing the
    // projected coordinates of every inset geometry shows all eight Alaska
    // versions collapsing to one shape and all seven Hawaii versions to
    // another, so a statehood alters the name and nothing that is drawn. Within
    // a panel, the annotation layer is the only thing that can say anything.
    //
    // The mainland events that do exist are a river-line exchange between
    // Kansas and Missouri, which is not a chapter. Deliberately anchorless,
    // for the reason given at Chapter 6: there is no earlier line beneath the
    // plate to leave as sediment.
    built: true,
  }),
  chapter({
    id: 'millennium',
    index: 7,
    name: 'Millennium',
    nameZh: '千禧',
    from: '1989-11-09',
    // The window runs to the narrative present, which is *past* the last day
    // the boundary record can speak to (2000-12-31). That is deliberate: this
    // chapter's story carries events AHCB has no opinion about, and clamping
    // the window to the record would put them out of the cursor's reach.
    //
    // It has one consequence the pipeline has to know about. `t`, the flag
    // meaning "still alive when the chapter ends, so do not fade it out", is
    // computed against the record's end rather than the window's — otherwise
    // every feature in this bundle would be non-terminal and the whole plate
    // would dissolve to blank paper on the chapter's last frame.
    // See `pipeline/build.js`.
    to: NARRATIVE_PRESENT,
    episodes: '12 Millennium',
    material: {
      family: 'Clean screen white, survey blue',
      paper: 0xf2f2ee,
      ink: 0x2b3340,
      accent: 0x2b6fb5,
      accentMix: 0.8,
      hatchScale: 360,
      hatchAngle: 0,
      lineWeight: 1.1,
      bleed: 0.35,
      grain: 0.18,
    },
    transition: 'A stream of light data',
    audio: 'Keyboard, city hum',
    // The record stops at 2000-12-31, so there is nothing here to move either —
    // and no anchors, for the same reason as Chapter 6. The README's
    // "1989–present" is now literally the window: see NARRATIVE_PRESENT, and
    // note that the geometry inside this window is one static plate for its
    // whole length.
    built: true,
  }),
];

/** Chapters that have a generated bundle on disk. */
export const BUILT_CHAPTERS = CHAPTERS.filter((c) => c.built);

/** Look a chapter up by id; throws rather than returning undefined. */
export function chapterById(id) {
  const found = CHAPTERS.find((c) => c.id === id);
  if (!found) throw new Error(`unknown chapter: ${id}`);
  return found;
}

/** The chapter immediately after this one, or null at the end of the atlas. */
export function nextChapter(chapter) {
  return CHAPTERS[chapter.index + 1] ?? null;
}

/** The chapter immediately before this one, or null at the start. */
export function previousChapter(chapter) {
  return CHAPTERS[chapter.index - 1] ?? null;
}

/**
 * The next chapter the atlas can actually show, or null at the end of the film.
 *
 * Not `nextChapter`. That one answers the record's order, in which a chapter
 * that has never been drawn still has a place; this one answers the order the
 * atlas can *play*, which is why it walks {@link BUILT_CHAPTERS}. The two are
 * the same answer for all eight chapters today, so the difference is invisible
 * — which is exactly why it needs saying out loud. A film handed a chapter with
 * no bundle would travel to a dispersal and come out over a blank plate, and
 * `main.js`'s prefetch deliberately treats a missing sibling as survivable, so
 * nothing downstream would complain.
 */
export function nextBuiltChapter(chapter) {
  const at = BUILT_CHAPTERS.indexOf(chapter);
  if (at < 0) return null;
  return BUILT_CHAPTERS[at + 1] ?? null;
}

/**
 * How many chapters ago an anchor was drawn. 0 means the chapter that owns it.
 * This is the palimpsest window: an anchor is at full strength at 0, fades over
 * 1 and 2, and is gone at 3. Counted in chapters rather than years because
 * chapters are the unit of navigation and carry their own time scales — the
 * 1783 anchor would otherwise persist for 82 years while one in Chapter 6
 * lasted four.
 */
export function chapterDistance(from, to) {
  return to.index - from.index;
}
