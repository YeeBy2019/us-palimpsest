/**
 * The story layer: what a chapter has to say that is not a boundary.
 *
 * ## Why this file has to exist
 *
 * Every other content type in this atlas is geometry. A chapter's date range
 * cuts boundaries, the timeline is a scrub over those boundaries, an anchor is
 * a retained boundary state, the inset panels are boundary geometry too, and
 * even the chapter card describes the *material* the plate is printed with.
 * The whole atlas therefore knows exactly one kind of fact: **a place whose
 * outline changed on a date.**
 *
 * That is enough for Chapters 2 to 5, where the outline genuinely moves. It is
 * not enough for Chapter 1, which has no state boundary in its window at all, or
 * for Chapters 6, 7 and 8, where the outline has stopped — no state was admitted
 * between 1912 and 1959, so those chapters draw the same coast throughout. The
 * README says such chapters "cannot be carried by boundary change and have to be
 * carried by something else — cities and events". This file is that something
 * else, and as of 2026-10-10 all eight chapters are written.
 *
 * The distinction that matters is not subject matter, it is **provenance**. A
 * boundary is *derived*: cut it, project it, draw it, and the atlas has said
 * something with no one's judgement in it. A story is *authored*: someone has
 * to decide that Pearl Harbor is a beat and that the Willow Run bomber plant is
 * another, and has to write the sentence. Nothing in AHCB contains the word
 * "Hiroshima". So this is a content file, and its cost is editorial, not
 * computational — which is why the pipeline reads one field of it and none of
 * the prose, and why a chapter with no entry here is a chapter that has not
 * been written yet, not one that failed to build.
 *
 * ## What a beat is, and what it is not
 *
 * A beat is a moment: a date, a place on the earth, and one thing that
 * happened. It is deliberately not a paragraph of history and deliberately not
 * an annotation on a boundary. It is the smallest unit that can be *played* —
 * small enough that a chapter is a sequence of them rather than a wall of text.
 *
 * `place` is geographic (longitude and latitude), not sheet coordinates, and
 * that is a decision with a consequence worth stating plainly: **the story
 * leaves the map, and it does so often.** Measured against the real projection
 * rather than assumed, of the hundred and eight beats here **fourteen are off
 * the drawing entirely** — the Canal, the Pacific and European theatres,
 * Berlin, Korea, Baikonur, Moscow, the Gulf and Abbottabad — while four more
 * land inside an inset (Pearl Harbor and two Hawaii beats in the Hawaii panel,
 * the Alaska statehood in Alaska's). The sheet is fitted to the lower
 * forty-eight, so at its scale the Pacific is off the west edge and Europe off
 * the east. Chapter 6 is the plainest case — five of its nine places are off
 * the plate — but it is not the only one. `pipeline.test.js` pins the split, so
 * adding a beat to a place that is not drawn forces the question instead of
 * quietly producing a camera target pointing at nothing.
 *
 * That is not a defect to fix in this file — it is what the history does, and
 * it is the thing to solve when the camera learns to fly (M4), whose brief is
 * now those fourteen places. It is also why `place` is stored as a real
 * coordinate rather than a picked point on the plate: a picked point would
 * silently lie about where Normandy is, and the lie would be invisible in
 * exactly the case where it matters.
 *
 * ## Figures: the one place a line is drawn by hand
 *
 * A beat may carry `figures` — one or more polylines in real geographic
 * coordinates, drawn on the plate as engraved lines and revealed as the cursor
 * passes the beat's date, exactly like a boundary. They exist because the story
 * needs things the record cannot draw: a road, a march, a survey line, a
 * parallel named by an act of Congress.
 *
 * Three rules, and they are what stops this from becoming a place to put
 * anything:
 *
 * - **A figure is a corridor, not a survey.** The boundary geometry here is
 *   derived and exact; a figure is traced from published descriptions and is
 *   honest about being approximate. That is why each carries a `note`, and why
 *   the note says "schematic" when it is one.
 * - **It belongs to a beat.** A figure has no date of its own; it appears when
 *   its beat does. A line that no sentence needs is decoration.
 * - **The pipeline reads this field and nothing else.** It projects `figures`
 *   into the chapter bundle and never looks at `title` or `body`. So a chapter
 *   nobody has written still builds, which is what keeps the story layer from
 *   becoming a build dependency of the map.
 *
 * Chapter 1 depends on them outright: no state boundary begins anywhere inside
 * its window, so routes are the only thing its plate can draw. It is the chapter
 * where the atlas stops being a map with a commentary on it and becomes a
 * commentary with a map.
 *
 * Which gives the fourth rule, and it is not decorative either: **a chapter that
 * is carried by figures has to have one in its first frame.** The first version
 * of Chapter 1 put its earliest route at 1763 — the Proclamation Line — and the
 * plate was therefore bare paper from 1607 to 1763, a hundred and fifty-six of
 * the chapter's hundred and seventy-six years. Every guard passed; the layer was
 * simply too late to be seen. Hence the James River at Jamestown, Nemacolin's
 * Path in 1754 and the road to Concord in 1775.
 *
 * ## The panel is a pure function of the cursor
 *
 * The runtime does not have a player for this. It does not need one. The atlas
 * already advances a date cursor — by Play, by a scrub, by a deep link — and a
 * beat is *shown when the cursor has passed its date and not the next one's*.
 * So the narration panel is `beatAt(beats, state.date)`, evaluated every frame,
 * exactly like the geometry is. Scrubbing backwards works for free, deep links
 * work for free (`?chapter=wwii&date=1944-06-06` opens on the Normandy card),
 * and the play-through is the documentary mode because Play was always just a
 * date that moves.
 *
 * ## What the state machine has to learn, and why a pace alone is not enough
 *
 * The first version of this gave a written chapter a slower `pace` — a fraction
 * of the chapter's span per second, uniform across the chapter — so that the
 * whole chapter took `beats × HOLD_SECONDS`. Sampled on a real play-through,
 * that is not a documentary. A uniform pace makes the *gap between two dates*
 * the reading time, so Executive Order 9066 — two months after Pearl Harbor —
 * was on screen for six seconds, while Midway, a year after that, sat there for
 * twenty-seven. Neither number was chosen by anyone; both are artefacts of when
 * the history happened to happen.
 *
 * So the cursor **stops** at each beat. {@link holdsFor} is the list of dates to
 * stop at, {@link HOLD_SECONDS} is how long to stand there, and `paceFor`
 * degrades into the walk *between* the beats. Reading time is then the same
 * whether two moments are a month apart or a decade, which is the property that
 * was actually wanted and the one a pace cannot express at all. The hold is also
 * faithful in a way a pace is not: while the atlas is standing on a beat the
 * geometry is standing still too, so the frame is a held shot rather than a
 * moving one.
 *
 * The panel stays a pure function of the date through all of it — a hold moves
 * the clock, never the cursor's meaning — so scrubbing, deep links and the
 * panel's own logic are all untouched.
 *
 * That is the whole of the coupling to `env/chapter.js`: a pace, a list of
 * dates, and a duration. The state machine never learns what is at any of them.
 *
 * ## Bilingual by convention, not by translation
 *
 * Every string is carried twice, English and Chinese, which is the same shape
 * `chapters.js` already uses for `name` / `nameZh`. The two are written as the
 * same account rather than as a gloss: a reader of either should get the whole
 * beat, and the Chinese is not a subtitle for the English.
 */

import { isoToN, isoToYear } from '../lib/dates.js';

/**
 * How long the cursor stands still at a beat, in seconds, during a play-through.
 *
 * Long enough to read both languages at a normal speed. The user owns this
 * number; it is the only knob that sets how a chapter feels to watch.
 */
export const HOLD_SECONDS = 12;

/**
 * How long the cursor spends walking the chapter's whole span, in seconds, when
 * the chapter has beats.
 *
 * This is the pace *between* holds, not the pace of the chapter. The holds carry
 * the reading time; this only has to be long enough that the geometry is seen to
 * move rather than jump, and short enough that nobody waits through it.
 */
export const TRAVEL_SECONDS = 20;

/**
 * How long the cursor stands on a chapter's **opening beat** — the one dated
 * the day the chapter opens — in seconds.
 *
 * Shorter than {@link HOLD_SECONDS}, and the reason is that the opening beat is
 * the only beat that is *announced*. Every other beat is discovered: the cursor
 * arrives and the card is news. The opening one arrives with the chapter, and
 * the chapter card is already inking over the sheet to say so. Holding it for
 * the full reading time therefore spends twelve seconds repeating an
 * introduction, on a plate that has nothing on it yet — because a line dated
 * the day the chapter opens has only just begun, which is what `aFrom` means in
 * `world/boundaries.js`: it does not fade in, it is already there. On the
 * atlas's own first chapter "already there" is the James, a route **1% of the
 * sheet's width**: six pixels of ink on a blank page.
 *
 * So Chapter 1 used to open on twelve seconds of a still, near-empty sheet with
 * a frozen stamp and a motionless timeline — the first thing anyone saw, and
 * indistinguishable from a page that failed to start. It was reported as
 * exactly that. The hold now lasts as long as the card that announces it,
 * `TRANSITION.disperse + TRANSITION.reform + 0.4` in `env/chapter.js` — about
 * 2.4 s, which `narration.test.js` pins this against — and the cursor then
 * walks, so the plate is drawing within the first second.
 *
 * Every other beat keeps the full reading time. The film is 100 s shorter for
 * it; nothing else about it changes.
 */
export const OPENING_HOLD_SECONDS = 3;

/**
 * The pace a chapter plays at when it has no beats — M0's value, unchanged.
 * Expressed as a fraction of the chapter's own span per second, so a four-year
 * chapter and a hundred-and-sixty-year one play at the same felt speed.
 */
export const DEFAULT_PACE = 0.055;

/**
 * Derive a chapter's travelling pace from its beats.
 *
 * A written chapter walks its span in {@link TRAVEL_SECONDS} and stands at each
 * beat for {@link HOLD_SECONDS}, so the chapter takes
 * `TRAVEL_SECONDS + beats × HOLD_SECONDS` to play — about two minutes for
 * Chapter 6. One beat is cheaper than that: the opening one, which is held for
 * {@link OPENING_HOLD_SECONDS} because the chapter card announces it. An
 * unwritten chapter keeps M0's pace and no holds at all.
 *
 * Note what this deliberately is *not*: a function of how many beats there are,
 * or how far apart they fall. Both of those made the reading time a side effect
 * of the history rather than a decision.
 */
export function paceFor(beats) {
  return beats.length ? 1 / TRAVEL_SECONDS : DEFAULT_PACE;
}

/**
 * The dates the cursor should stop at while playing, in ascending order.
 *
 * Handed straight to `ChapterState.holds`, which knows only that these are
 * moments worth standing on. Paired with `beats` by index, which is sound only
 * while `beatAt`'s ordering assumption holds — `narration.test.js` pins it.
 */
export function holdsFor(beats) {
  return beats.map((beat) => beat.year);
}

/** Attach the derived date forms, the way `chapters.js` does for its bounds. */
function beat(spec) {
  return { ...spec, year: isoToYear(spec.date), n: isoToN(spec.date) };
}

/**
 * The chapters that have been written, keyed by chapter id.
 *
 * All eight, as of 2026-10-10. A chapter is *absent* rather than stubbed when
 * nobody has written it, and the panel stays out of the way on a chapter with
 * no entry — an empty story is better than a placeholder one.
 */
export const BEATS = {
  /**
   * Chapter 1, Founding — 1607-05-14 to 1783-09-03.
   *
   * The chapter with no map. No state boundary in the record begins before
   * 1783-09-03, so this is the one chapter whose plate draws nothing derived —
   * which is the reason it is the first chapter to be carried by *authored*
   * geometry as well as by beats — several of its beats carry `figures`, and
   * the note on figures at the head of this file says why that is allowed and
   * where they are not.
   *
   * The arc runs from a fort on a river island to a surrender in Virginia, and
   * its subject is not the winning of a war. It is the slow assembling of the
   * things that will be argued about for the next two hundred years: who is
   * counted as a person, who gets to vote, and where the line is drawn.
   */
  founding: [
    beat({
      id: 'jamestown',
      date: '1607-05-14',
      kind: 'settlement',
      place: { lon: -76.7778, lat: 37.2089, name: 'Jamestown, Virginia', nameZh: '弗吉尼亚詹姆斯敦' },
      title: 'Jamestown',
      titleZh: '詹姆斯敦',
      body:
        'A hundred and four men of the Virginia Company land on a river island sixty miles from the sea and raise a fort. Two thirds of them are dead within a year. The colony survives on tobacco, and on the labour of indentured servants who are paid in land if they live long enough to collect it.',
      bodyZh:
        '弗吉尼亚公司的一百零四人在离海六十英里的河岛上登陆，筑起一座堡。一年之内三分之二的人死去。殖民地靠烟草活下来，也靠契约奴的劳作活下来——他们若能活到契约期满，就换来一块土地。',
      // The first mark on the first plate. Without it Chapter 1's sheet is bare
      // paper from 1607 until the Proclamation Line of 1763 — a hundred and
      // fifty-six of the chapter's hundred and seventy-six years — which is the
      // exact defect the story layer exists to fix. See the note on figures at
      // the head of this file.
      figures: [
        {
          id: 'james-river',
          note: 'the James, from the bay to the island — the fleet’s last sixty miles',
          points: [
            [-76.31, 36.94],
            [-76.44, 37.02],
            [-76.55, 37.1],
            [-76.66, 37.16],
            [-76.78, 37.21],
          ],
        },
      ],
    }),
    beat({
      id: 'first-assembly',
      date: '1619-07-30',
      kind: 'politics',
      place: { lon: -76.7778, lat: 37.2089, name: 'Jamestown, Virginia', nameZh: '弗吉尼亚詹姆斯敦' },
      title: 'The first assembly',
      titleZh: '第一次议会',
      body:
        'Twenty-two burgesses elected by the free men of Virginia meet in the church at Jamestown: the first elected legislature in what will become the United States. In the same season a Dutch ship puts ashore the first Africans in the English colonies. The two facts are never afterwards separated.',
      bodyZh:
        '弗吉尼亚自由民选出的二十二名议员在詹姆斯敦的教堂里开会，这是后来的美国土地上第一个民选立法机构。同一季，一艘荷兰船卸下英属殖民地的第一批非洲人。此后这两件事再没有被分开过。',
    }),
    beat({
      id: 'mayflower-compact',
      date: '1620-11-11',
      kind: 'politics',
      place: { lon: -70.662, lat: 41.9584, name: 'Plymouth, Massachusetts', nameZh: '马萨诸塞普利茅斯' },
      title: 'The Mayflower Compact',
      titleZh: '五月花号公约',
      body:
        'Storms have carried the Mayflower north of the land its patent covers, so its passengers have no legal authority over themselves. Forty-one of them sign an agreement to make just laws and submit to them — a government built out of nothing but consent, written before anyone goes ashore.',
      bodyZh:
        '风暴把五月花号吹到特许状所辖之地以北，船上人于法再无管束自己的权威。其中四十一人签署一纸约定：将制定公正的法律并服从之——一个仅凭同意而立的政府，写在任何人上岸之前。',
    }),
    beat({
      id: 'city-upon-a-hill',
      date: '1630-06-12',
      kind: 'settlement',
      place: { lon: -70.8967, lat: 42.5195, name: 'Salem, Massachusetts', nameZh: '马萨诸塞塞勒姆' },
      title: 'A city upon a hill',
      titleZh: '山巅之城',
      body:
        'Eleven ships and about a thousand Puritans come into Massachusetts Bay, the largest migration of the century so far. Their governor writes that the community will be watched by the whole world. The phrase outlives the theocracy that produced it.',
      bodyZh:
        '十一艘船、约一千名清教徒驶入马萨诸塞湾，是到那时为止本世纪最大的一次移民。总督写道：这个共同体将被全世界注视。这句话比产生它的那套神权政治活得更久。',
    }),
    beat({
      id: 'stono',
      date: '1739-09-09',
      kind: 'protest',
      place: { lon: -80.1, lat: 32.75, name: 'Stono River, South Carolina', nameZh: '南卡罗来纳斯托诺河' },
      title: 'The Stono Rebellion',
      titleZh: '斯托诺起义',
      body:
        'Twenty or more enslaved men seize weapons at the Stono River and march south for Spanish Florida, where freedom has been promised, burning plantations as they go. They are caught and killed inside a day. The colonial answer is a law forbidding the enslaved to assemble, to learn to read, or to be freed without permission.',
      bodyZh:
        '二十余名被奴役者在斯托诺河夺取武器，一路烧毁种植园，向南朝许诺自由的西属佛罗里达进发。一天之内即被截杀。殖民地的回应是一部法律：禁止被奴役者集会、识字，也禁止未经许可地释放他们。',
    }),
    beat({
      id: 'great-awakening',
      date: '1741-07-08',
      kind: 'society',
      place: { lon: -72.5901, lat: 41.9762, name: 'Enfield, Connecticut', nameZh: '康涅狄格恩菲尔德' },
      title: 'Sinners in the hands of an angry God',
      titleZh: '落在愤怒之神手中的罪人',
      body:
        'Jonathan Edwards preaches a sermon so plainly terrifying that the congregation cries out and he has to stop. The revival it belongs to crosses every colonial boundary: for the first time people from Georgia to Maine are moved by the same words in the same years, and begin to think of themselves as one audience.',
      bodyZh:
        '乔纳森·爱德华兹讲了一篇直白到骇人的布道，会众当场哭喊，他不得不停下来。这场大觉醒跨越了各殖民地的界线：从佐治亚到缅因，人们第一次在同样的年份被同样的话语撼动，并开始把自己想成同一群听众。',
    }),
    beat({
      id: 'fort-necessity',
      date: '1754-07-03',
      kind: 'war',
      place: { lon: -79.6, lat: 39.81, name: 'Great Meadows, Pennsylvania', nameZh: '宾夕法尼亚大草甸' },
      title: 'Fort Necessity',
      titleZh: '必需堡',
      body:
        'A twenty-two-year-old colonel named George Washington surrenders a stockade in a meadow to the French, signing a surrender note in a language he cannot read. A colonial skirmish over a river fork has become the Seven Years\' War — and Britain concludes that the colonies are too expensive to be left to themselves.',
      bodyZh:
        '二十二岁的上校乔治·华盛顿在草场上把一座木栅堡交给法军，并用他看不懂的语言签署了投降书。一场为河口而起的殖民地冲突就此变成七年战争；英国由此认定：这些殖民地若放任自流，代价太大。',
      figures: [
        {
          id: 'braddocks-road',
          note: 'schematic — Nemacolin’s Path and Braddock’s Road, Cumberland to the Great Meadows',
          points: [
            [-78.76, 39.65],
            [-78.93, 39.69],
            [-79.12, 39.74],
            [-79.31, 39.8],
            [-79.47, 39.86],
            [-79.59, 39.9],
          ],
        },
      ],
    }),
    beat({
      id: 'proclamation-line',
      date: '1763-10-07',
      kind: 'law',
      place: { lon: -81.5, lat: 36.5, name: 'The Appalachian divide', nameZh: '阿巴拉契亚分水岭' },
      title: 'The line',
      titleZh: '那条线',
      body:
        'With France gone from the continent, the Crown draws a line along the crest of the Appalachians and forbids settlement west of it. The land it reserves is meant for the peoples it has just fought. The settlers it stops are the ones who won the war, and they cross anyway — down the wagon road that runs straight through the line.',
      bodyZh:
        '法国人退出大陆之后，王室沿阿巴拉契亚山脊划下一条线，禁止越线定居。圈出的土地说是留给刚刚交过手的原住民。而被拦住的人，正是打赢这场战争的人——他们照旧越了过去，沿着那条正好穿过此线的马车道。',
      // The one place in the atlas where a line is drawn from an author's hand
      // rather than from the record, and it is drawn as a corridor because that
      // is what the source describes: the proclamation named no survey. See the
      // note on figures at the head of this file.
      figures: [
        {
          id: 'proclamation-crest',
          note: 'schematic — the crest of the Appalachians, not a surveyed line',
          points: [
            [-81.4, 30.9],
            [-81.6, 32.4],
            [-82.4, 33.9],
            [-83.1, 34.9],
            [-82.6, 36.0],
            [-81.7, 36.7],
            [-80.6, 37.6],
            [-79.9, 38.6],
            [-79.5, 39.5],
            [-80.0, 40.44],
            [-79.4, 41.8],
            [-79.06, 43.26],
          ],
        },
        {
          id: 'wagon-road',
          note: 'the Great Wagon Road, Philadelphia to Augusta',
          points: [
            [-75.16, 39.95],
            [-76.31, 40.04],
            [-77.72, 39.64],
            [-78.17, 39.18],
            [-79.07, 38.15],
            [-80.06, 37.29],
            [-80.47, 35.67],
            [-81.49, 35.15],
            [-81.97, 33.47],
          ],
        },
      ],
    }),
    beat({
      id: 'stamp-act',
      date: '1765-08-14',
      kind: 'protest',
      place: { lon: -71.0589, lat: 42.3601, name: 'Boston, Massachusetts', nameZh: '马萨诸塞波士顿' },
      title: 'The stamps',
      titleZh: '印花税',
      body:
        'A tax on paper is the first tax Parliament has laid on the colonies directly, and Boston answers by hanging the stamp officer in effigy and pulling down his house. Nine colonies send delegates to New York to say the thing that cannot be taken back: that a body they do not elect cannot tax them.',
      bodyZh:
        '对纸张征税，是议会第一次直接向殖民地征税。波士顿的回应是把印花税官的草像吊起来，并拆了他的房子。九个殖民地派代表到纽约，说出那句收不回来的话：未经他们选举的机构，不得向他们征税。',
    }),
    beat({
      id: 'boston-massacre',
      date: '1770-03-05',
      kind: 'protest',
      place: { lon: -71.0589, lat: 42.3601, name: 'Boston, Massachusetts', nameZh: '马萨诸塞波士顿' },
      title: 'Boston, March 1770',
      titleZh: '1770 年 3 月的波士顿',
      body:
        'A squad of soldiers fires into a crowd and kills five people, among them Crispus Attucks, a sailor of African and Native descent. The soldiers are tried and mostly acquitted, defended by John Adams. Both the shooting and the trial are remembered, which is the difficulty of the whole decade.',
      bodyZh:
        '一小队士兵向人群开枪，五人死亡，其中有非裔与印第安人后裔的水手克里斯珀斯·阿塔克斯。士兵受审，多数被判无罪——为他们辩护的是约翰·亚当斯。枪击与审判都被记住，这正是这十年难讲的地方。',
    }),
    beat({
      id: 'boston-tea-party',
      date: '1773-12-16',
      kind: 'protest',
      place: { lon: -71.0589, lat: 42.3601, name: 'Boston, Massachusetts', nameZh: '马萨诸塞波士顿' },
      title: 'The tea',
      titleZh: '茶叶',
      body:
        'Men disguised as Mohawks board three ships and throw three hundred and forty-two chests of tea into the harbour rather than let the duty on it be paid. The harbour is closed in reprisal, and the colonies begin sending each other food and money — the first thing they ever do together.',
      bodyZh:
        '装扮成莫霍克人的人登上三条船，把三百四十二箱茶叶倒进港口，只为不让那笔税被缴成。作为报复，港口被封闭；各殖民地开始互相运送粮食与钱款——这是他们第一次共同做一件事。',
    }),
    beat({
      id: 'lexington-concord',
      date: '1775-04-19',
      kind: 'battle',
      place: { lon: -71.2245, lat: 42.4473, name: 'Lexington, Massachusetts', nameZh: '马萨诸塞列克星敦' },
      title: 'Lexington and Concord',
      titleZh: '列克星敦与康科德',
      body:
        'Seven hundred soldiers march out of Boston before dawn to seize the colony\'s powder, and at first light they meet a line of militia on a village green. The first shots are fired, nobody knows by whom, and on the road back farmers fire from behind every wall. Eight years of war begin here.',
      bodyZh:
        '七百名士兵在破晓前开出波士顿，去夺取殖民地的火药；天刚亮，他们在村中草地上遇到一列民兵。第一枪打响，无人知道是谁开的；回程路上，农民从每一道墙后射击。八年的战争从这里开始。',
      figures: [
        {
          id: 'battle-road',
          note: 'the road out of Boston to Concord, the morning of the 19th',
          points: [
            [-71.06, 42.36],
            [-71.11, 42.37],
            [-71.16, 42.42],
            [-71.22, 42.45],
            [-71.35, 42.46],
          ],
        },
      ],
    }),
    beat({
      id: 'declaration',
      date: '1776-07-04',
      kind: 'politics',
      place: { lon: -75.1652, lat: 39.9526, name: 'Philadelphia, Pennsylvania', nameZh: '宾夕法尼亚费城' },
      title: 'The Declaration',
      titleZh: '独立宣言',
      body:
        'The Continental Congress adopts a statement that governments hold their power by the consent of the governed and may be thrown off when they abuse it. It is written by men who hold slaves, and it becomes the yardstick that everyone afterwards uses against them.',
      bodyZh:
        '大陆会议通过一份文告：政府的权力来自被治理者的同意，一旦滥用即可推翻。写它的人自己蓄奴；而在此后两百年里，所有人都是用这把尺子回头量他们。',
    }),
    beat({
      id: 'yorktown',
      date: '1781-10-19',
      kind: 'battle',
      place: { lon: -76.5091, lat: 37.2388, name: 'Yorktown, Virginia', nameZh: '弗吉尼亚约克镇' },
      title: 'Yorktown',
      titleZh: '约克镇',
      body:
        'A French fleet closes the sea and a French and American army closes the land, and Cornwallis surrenders seven thousand men. A war that had gone four years without a decision is decided in three weeks by an army that marched four hundred and fifty miles in a month to be there.',
      bodyZh:
        '法国舰队封住海面，法美联军封住陆路，康沃利斯率七千人投降。四年未见分晓的战争，在三周之内定局——只因一支军队在一个月里行军四百五十英里赶到。',
      figures: [
        {
          id: 'yorktown-march',
          note: 'the allied march, Head of Elk to Yorktown, 1781',
          points: [
            [-75.83, 39.61],
            [-76.61, 39.29],
            [-76.49, 38.98],
            [-77.05, 38.8],
            [-77.46, 38.3],
            [-77.28, 37.55],
            [-76.71, 37.27],
            [-76.51, 37.24],
          ],
        },
      ],
    }),
  ],
  /**
   * Chapter 2, Expansion — 1783-09-03 to 1848-02-02.
   *
   * The chapter where the outline moves most, and where the story is therefore
   * the thing the *map cannot say*: a boundary record shows a line crossing a
   * continent and never shows who was standing in front of it. This chapter
   * carries both. The five routes below are drawn from documented corridors —
   * see the note on figures at the head of this file for why they are the only
   * lines in the atlas that are drawn by hand rather than derived.
   */
  expansion: [
    beat({
      id: 'northwest-ordinance',
      date: '1787-07-13',
      kind: 'law',
      place: { lon: -74.01, lat: 40.71, name: 'New York, New York', nameZh: '纽约州纽约' },
      title: 'The Northwest Ordinance',
      titleZh: '西北条例',
      body:
        'Congress provides for the country it expects to have: territories will be governed, then admitted as states, equal to the original thirteen and not subordinate to them. The same act forbids slavery in the territory north of the Ohio, which is the first federal law to say where slavery may not go.',
      bodyZh:
        '国会为一个尚未存在的国家立下规矩：领地先受治理，而后作为州加入，与原初十三州平等而非从属。同一部条例禁止俄亥俄河以北的领地蓄奴——这是联邦法律第一次规定奴隶制不能去哪里。',
    }),
    beat({
      id: 'constitution',
      date: '1787-09-17',
      kind: 'law',
      place: { lon: -75.1652, lat: 39.9526, name: 'Philadelphia, Pennsylvania', nameZh: '宾夕法尼亚费城' },
      title: 'The Constitution',
      titleZh: '宪法',
      body:
        'Thirty-nine delegates sign a frame of government that divides power against itself, and settle on a compromise that counts an enslaved person as three fifths of a person for the purposes of representation. Of the many arguments in Philadelphia, that is the one that will not hold.',
      bodyZh:
        '三十九名代表签署了一部把权力相互分割的政府架构，并在一件事上达成妥协：为分配议席，一名被奴役者算作五分之三的人。费城会议上争论虽多，只有这一条长久不了。',
    }),
    beat({
      id: 'washington-inaugurated',
      date: '1789-04-30',
      kind: 'politics',
      place: { lon: -74.01, lat: 40.71, name: 'New York, New York', nameZh: '纽约州纽约' },
      title: 'Washington takes the oath',
      titleZh: '华盛顿就职',
      body:
        'On a balcony in New York the first president swears to preserve the Constitution, an office written down a year before anyone knew who would hold it. He serves eight years and goes home, which matters more than anything else he does.',
      bodyZh:
        '在纽约的一处阳台上，第一任总统宣誓维护宪法——这个职位是写下来的，而写它的时候没有人知道会由谁来当。他任职八年后回家，这件事比他做的任何别的事都重要。',
    }),
    beat({
      id: 'louisiana-purchase',
      date: '1803-04-30',
      kind: 'politics',
      place: { lon: -90.1994, lat: 38.627, name: 'St. Louis, Louisiana', nameZh: '路易斯安那圣路易斯' },
      title: 'The Purchase',
      titleZh: '路易斯安那购地',
      body:
        'France sells 828,000 square miles west of the Mississippi for fifteen million dollars, and the country doubles in a single signature. Nothing in the Constitution clearly permits it, and Jefferson, who wrote the clause he is about to stretch, does it anyway.',
      bodyZh:
        '法国以一千五百万美元售出密西西比河以西八十二万八千平方英里土地，这个国家在一纸签名之间翻了一倍。宪法里并没有哪一条明确允许这样做；杰斐逊——写下那条他要拉伸的条款的人——还是做了。',
    }),
    beat({
      id: 'lewis-clark',
      date: '1804-05-14',
      kind: 'migration',
      place: { lon: -90.15, lat: 38.8, name: 'Camp Dubois, Illinois', nameZh: '伊利诺伊迪布瓦营' },
      title: 'Up the Missouri',
      titleZh: '溯密苏里河而上',
      body:
        'Meriwether Lewis, William Clark and about forty men leave camp and row and drag a keelboat upstream for four months to reach a river the maps stop describing. They cross the divide, reach the Pacific in the autumn of 1805 and return with the first account of the interior by people who walked it.',
      bodyZh:
        '梅里韦瑟·刘易斯、威廉·克拉克和大约四十人离开营地，逆流而上拖行龙骨船四个月，才到地图不再描绘的地方。他们翻过分水岭，1805 年秋抵达太平洋，带回第一份亲历者写下的内陆记录。',
      figures: [
        {
          id: 'lewis-and-clark',
          note: 'Camp Dubois to the Pacific, outbound, 1804-1805',
          points: [
            [-90.15, 38.8],
            [-95.93, 41.25],
            [-100.35, 44.37],
            [-100.9, 47.0],
            [-104.0, 47.98],
            [-110.67, 47.82],
            [-111.55, 45.88],
            [-113.45, 44.98],
            [-116.0, 46.4],
            [-119.0, 46.2],
            [-121.5, 45.6],
            [-123.9, 46.2],
          ],
        },
      ],
    }),
    beat({
      id: 'fort-mchenry',
      date: '1814-09-14',
      kind: 'war',
      place: { lon: -76.5796, lat: 39.2732, name: 'Fort McHenry, Baltimore', nameZh: '巴尔的摩麦克亨利堡' },
      title: 'The rockets and the glare',
      titleZh: '火箭与红光',
      body:
        'A lawyer held aboard a ship through a night of bombardment watches the fort\'s flag still flying at first light and writes four verses on the back of a letter. Set to a drinking song, the third verse asks what happens to the enslaved who fled to the enemy, and that verse is the one nobody sings.',
      bodyZh:
        '一位被扣在船上的律师熬过一夜炮击，天亮时看见堡垒上的旗还在，就在一封信背面写下四节诗。配上一支饮酒歌，到第三节问的是：逃到敌人那边的被奴役者后来的下场如何——而这一节，没有人唱。',
    }),
    beat({
      id: 'missouri-compromise',
      date: '1820-03-06',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Thirty-six thirty',
      titleZh: '三十六度三十分',
      body:
        'Congress admits Missouri as a slave state and Maine as a free one, and draws a line at 36°30\' across the rest of the purchase: north of it slavery is forbidden. Every state admitted for the next thirty years is admitted with the question of where it sits against this line the first question asked.',
      bodyZh:
        '国会接纳密苏里为蓄奴州、缅因为自由州，并在购地其余部分的北纬 36°30′ 划下一线：线以北禁止奴隶制。此后三十年每一个新州加入时，第一个被问的都是它落在这条线的哪一边。',
      figures: [
        {
          id: 'missouri-compromise-line',
          note: 'the parallel named by the act of 1820',
          points: [
            [-89.55, 36.5],
            [-93.0, 36.5],
            [-97.0, 36.5],
            [-101.0, 36.5],
            [-105.0, 36.5],
            [-109.05, 36.5],
          ],
        },
      ],
    }),
    beat({
      id: 'monroe-doctrine',
      date: '1823-12-02',
      kind: 'politics',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The hemisphere',
      titleZh: '这个半球',
      body:
        'In a message to Congress the president states that the Americas are closed to further European colonisation. The United States cannot yet enforce it and does not try; what makes it hold is the British fleet, which has its own reasons for keeping other empires out.',
      bodyZh:
        '总统在致国会的咨文中宣告：美洲不再对欧洲的殖民开放。美国此时无力执行，也没有试着执行；让它站得住的是英国舰队——而英国有自己的理由把别的帝国挡在外面。',
    }),
    beat({
      id: 'erie-canal',
      date: '1825-10-26',
      kind: 'technology',
      place: { lon: -73.7562, lat: 42.6526, name: 'Albany, New York', nameZh: '纽约州奥尔巴尼' },
      title: 'The ditch',
      titleZh: '那条沟',
      body:
        'A canal dug by hand across 363 miles of wilderness joins the Hudson to Lake Erie, and the cost of moving a ton of freight from Buffalo to New York falls by more than ninety per cent. A journey that took three weeks takes eight days, and the interior fills.',
      bodyZh:
        '一条用手挖穿三百六十三英里荒野的运河把哈德逊河与伊利湖连起来，从布法罗到纽约每吨运费跌去九成以上。要走三周的路变成八天，内地就此填满。',
      figures: [
        {
          id: 'erie-canal',
          note: 'the canal route, Albany to Buffalo',
          points: [
            [-73.75, 42.65],
            [-73.94, 42.81],
            [-75.23, 43.1],
            [-76.15, 43.05],
            [-77.61, 43.16],
            [-78.69, 43.17],
            [-78.88, 42.89],
          ],
        },
      ],
    }),
    beat({
      id: 'indian-removal-act',
      date: '1830-05-28',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Removal',
      titleZh: '迁移',
      body:
        'Congress authorises the president to exchange land west of the Mississippi for the homelands of the southeastern nations, by treaty if they agree and by force if they do not. Over the following decade about sixty thousand people are marched west; some four thousand die on the way, most of them Cherokee, in the winter of 1838.',
      bodyZh:
        '国会授权总统以密西西比河以西的土地交换东南各族的故土，同意就立约，不同意就动兵。此后十年约六万人被迁往西部；1838 年冬天，其中约四千人死在路上，多数是切罗基人。',
    }),
    beat({
      id: 'alamo',
      date: '1836-03-06',
      kind: 'battle',
      place: { lon: -98.4861, lat: 29.426, name: 'San Antonio, Texas', nameZh: '得克萨斯圣安东尼奥' },
      title: 'The Alamo',
      titleZh: '阿拉莫',
      body:
        'After thirteen days, a Mexican army takes a mission held by about two hundred men, and almost everyone inside is killed. The men who died there were fighting for a republic that permitted slavery, which the country they were leaving had just restricted — and Texas is annexed nine years later as a slave state.',
      bodyZh:
        '围城十三天后，墨西哥军队攻下由约两百人据守的一座传道院，院内几乎无人生还。守城者要建立的共和国允许奴隶制——而他们正要脱离的那个国家刚刚限制了它。九年后，得克萨斯作为蓄奴州并入美国。',
    }),
    beat({
      id: 'oregon-treaty',
      date: '1846-06-15',
      kind: 'politics',
      place: { lon: -122.68, lat: 45.63, name: 'Fort Vancouver, Oregon Country', nameZh: '俄勒冈地区温哥华堡' },
      title: 'Forty-nine',
      titleZh: '北纬四十九度',
      body:
        'Britain and the United States settle the northwest on a straight line at the forty-ninth parallel, from the Lake of the Woods to the Strait of Georgia. It is the last long stretch of the country\'s edge to be drawn without a war, and the wagon road to it is already two decades of ruts deep.',
      bodyZh:
        '英美以一条直线——北纬四十九度——划定西北边界，从伍兹湖直到乔治亚海峡。这是这个国家最后一段未经战争而划定的长边界，而通往那里的马车道，车辙已经压了二十年。',
      figures: [
        {
          id: 'forty-ninth-parallel',
          note: 'the boundary named by the treaty of 1846',
          points: [
            [-95.15, 49.0],
            [-101.0, 49.0],
            [-107.0, 49.0],
            [-113.0, 49.0],
            [-119.0, 49.0],
            [-123.32, 49.0],
          ],
        },
        {
          id: 'oregon-trail',
          note: 'Independence to Oregon City, the emigrant road',
          points: [
            [-94.42, 39.09],
            [-99.0, 40.65],
            [-104.52, 42.21],
            [-107.55, 42.49],
            [-108.9, 42.35],
            [-112.44, 43.03],
            [-117.0, 43.83],
            [-121.18, 45.6],
            [-122.61, 45.36],
          ],
        },
      ],
    }),
    beat({
      id: 'gold-at-sutters-mill',
      date: '1848-01-24',
      kind: 'economy',
      place: { lon: -120.8875, lat: 38.8013, name: "Sutter's Mill, California", nameZh: '加利福尼亚萨特磨坊' },
      title: 'The colour in the tailrace',
      titleZh: '水渠里的颜色',
      body:
        'A carpenter building a sawmill on the American River finds gold in the water. Within a year eighty thousand people arrive from every direction, including by sea around the Horn. California applies to be a free state two years later, and the argument the Missouri Compromise was supposed to have settled starts again.',
      bodyZh:
        '一名在亚美利加河上修锯木厂的木匠在水里发现黄金。一年之内八万人从四面八方涌来，包括绕合恩角走海路的。两年后加利福尼亚申请作为自由州加入，而那场本应由密苏里妥协了结的争论，重新开始。',
    }),
  ],
  /**
   * Chapter 3, Division — 1848-02-02 to 1865-04-09.
   *
   * The M0 chapter, and the one with an anchor: the boundary as it stood on the
   * day Fort Sumter was fired on stays legible beneath everything that follows
   * it. The beats below are what the anchor cannot say — that the line on the
   * map was the last thing to divide, not the first.
   */
  division: [
    beat({
      id: 'compromise-1850',
      date: '1850-09-09',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Compromise of 1850',
      titleZh: '1850 年妥协',
      body:
        'California enters as a free state and the rest is bought off: Utah and New Mexico organise without a decision about slavery, the slave trade ends in the capital, and a new law requires the free states to return people who have escaped. That last clause is the one that turns a boundary argument into a moral one.',
      bodyZh:
        '加利福尼亚作为自由州加入，其余各造互相让步：犹他与新墨西哥建制却不定奴隶制去留，首都禁止奴隶买卖，另立新法要求自由州遣返逃亡者。正是最后这一条，把一场边界之争变成了道德之争。',
    }),
    beat({
      id: 'uncle-toms-cabin',
      date: '1852-03-20',
      kind: 'society',
      place: { lon: -71.0589, lat: 42.3601, name: 'Boston, Massachusetts', nameZh: '马萨诸塞波士顿' },
      title: 'Uncle Tom\'s Cabin',
      titleZh: '《汤姆叔叔的小屋》',
      body:
        'A novel by a minister\'s daughter sells three hundred thousand copies in a year in a country of twenty-three million and is staged in every city. It makes the fugitive slave law personal to readers who had never seen a plantation, and the South answers with its own novels.',
      bodyZh:
        '一位牧师之女写的小说，在一个两千三百万人的国家里一年卖出三十万册，并在每座城市被搬上舞台。它让从未见过种植园的读者亲身感受到逃奴法；南方则以自己的小说回应。',
    }),
    beat({
      id: 'kansas-nebraska',
      date: '1854-05-30',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Kansas-Nebraska',
      titleZh: '堪萨斯-内布拉斯加法案',
      body:
        'Congress organises two territories and repeals the line it drew in 1820, leaving slavery in them to a vote of the settlers. The Missouri Compromise had held for thirty-four years; the assumption underneath it — that a limit could be drawn and kept — turns out to have been the whole of the peace.',
      bodyZh:
        '国会为两个领地建制，并废除 1820 年划下的那条线，把奴隶制的去留交给定居者投票。密苏里妥协维持了三十四年；而它底下的那个假设——界线可以划定并守住——原来就是和平的全部内容。',
    }),
    beat({
      id: 'bleeding-kansas',
      date: '1856-05-21',
      kind: 'protest',
      place: { lon: -95.2353, lat: 38.9717, name: 'Lawrence, Kansas Territory', nameZh: '堪萨斯领地劳伦斯' },
      title: 'Bleeding Kansas',
      titleZh: '流血的堪萨斯',
      body:
        'Several hundred men ride into Lawrence, destroy two printing presses and burn the hotel. Three days later a small party kills five settlers along a creek in reprisal. Over the next four years about fifty people are killed in the territory, and a senator is beaten unconscious on the floor of the Senate.',
      bodyZh:
        '数百人骑马冲进劳伦斯，捣毁两台印刷机、烧掉旅馆。三天后，一小队人为报复在小溪边杀死五名定居者。此后四年，这片领地上约五十人被杀，一名参议员在参议院的地板上被打得不省人事。',
    }),
    beat({
      id: 'dred-scott',
      date: '1857-03-06',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Dred Scott',
      titleZh: '德雷德·斯科特案',
      body:
        'The Supreme Court rules that a man who had lived for years in free territory is not a citizen and cannot sue, and that Congress had never had the power to forbid slavery anywhere. A compromise that had been a law for thirty-seven years is declared to have been void the whole time.',
      bodyZh:
        '最高法院裁定：一个在自由地区生活多年的人不是公民、不能起诉，而国会从来无权在任何地方禁止奴隶制。一条实行了三十七年的妥协之法，被宣告自始无效。',
    }),
    beat({
      id: 'harpers-ferry',
      date: '1859-10-16',
      kind: 'protest',
      place: { lon: -77.7386, lat: 39.3254, name: 'Harpers Ferry, Virginia', nameZh: '弗吉尼亚哈珀斯费里' },
      title: 'Harpers Ferry',
      titleZh: '哈珀斯费里',
      body:
        'John Brown and twenty-one men seize the federal arsenal to arm an uprising of the enslaved, and nobody comes. He is captured in two days, tried in a week and hanged in six. Asked for his last words he hands over a note predicting that the country will not be rid of the question but in blood.',
      bodyZh:
        '约翰·布朗率二十一人夺取联邦军械库，打算武装被奴役者起义，却没有人来。他两天内被俘、一周内受审、六周内处绞。有人请他留下最后的话，他递过一张纸条，预言这个国家要摆脱这个问题，只能靠流血。',
    }),
    beat({
      id: 'pony-express',
      date: '1860-04-03',
      kind: 'technology',
      place: { lon: -94.8467, lat: 39.7675, name: 'St. Joseph, Missouri', nameZh: '密苏里圣约瑟夫' },
      title: 'The Pony Express',
      titleZh: '驿马快信',
      body:
        'Riders relay mail the 1,900 miles to California in ten days, at up to twenty-five miles an hour. It is the fastest the country can talk to itself, it loses money from the first day, and it is out of business in eighteen months — the telegraph line reaches Salt Lake City and then the coast.',
      bodyZh:
        '骑手接力把邮件在十天内递到一千九百英里外的加利福尼亚，时速最快可达二十五英里。这是这个国家自我对话的最快方式；它从第一天起就亏本，十八个月后歇业——电报线通到了盐湖城，随后通到海岸。',
      figures: [
        {
          id: 'pony-express-route',
          note: 'St. Joseph to Sacramento, the 1860 relay',
          points: [
            [-94.85, 39.77],
            [-98.0, 39.4],
            [-101.0, 40.2],
            [-104.5, 41.2],
            [-108.0, 41.5],
            [-111.9, 40.76],
            [-115.0, 39.5],
            [-117.0, 38.9],
            [-119.8, 39.53],
            [-121.49, 38.58],
          ],
        },
      ],
    }),
    beat({
      id: 'lincoln-elected',
      date: '1860-11-06',
      kind: 'politics',
      place: { lon: -89.6501, lat: 39.7817, name: 'Springfield, Illinois', nameZh: '伊利诺伊斯普林菲尔德' },
      title: 'Lincoln elected',
      titleZh: '林肯当选',
      body:
        'A one-term congressman from Illinois wins the presidency with thirty-nine per cent of the vote, appearing on no ballot in ten states. His party is a coalition against the extension of slavery whose members do not agree on much else, and South Carolina has said what it will do.',
      bodyZh:
        '伊利诺伊一位只当过一届的众议员以三成九的得票当选总统，而十个州的选票上根本没有他的名字。他所属的党是一群反对奴隶制扩张的人的联合，除此之外彼此分歧甚多——而南卡罗来纳早就说过它会做什么。',
    }),
    beat({
      id: 'south-carolina-secedes',
      date: '1860-12-20',
      kind: 'politics',
      place: { lon: -79.9311, lat: 32.7765, name: 'Charleston, South Carolina', nameZh: '南卡罗来纳查尔斯顿' },
      title: 'Secession',
      titleZh: '退出联邦',
      body:
        'A convention in Charleston votes to dissolve the state\'s connection with the Union, and five weeks later six more states have followed before the new president has even taken the oath. Their declarations say plainly what the argument is about, in their own words, at the time.',
      bodyZh:
        '查尔斯顿的一次会议表决解散本州与联邦的联系；五周之内又有六个州跟进——而此时新总统尚未宣誓就职。它们的退出宣言，用当时自己的话，把争论的是什么说得很清楚。',
    }),
    beat({
      id: 'fort-sumter',
      date: '1861-04-12',
      kind: 'battle',
      place: { lon: -79.9311, lat: 32.7765, name: 'Charleston, South Carolina', nameZh: '南卡罗来纳查尔斯顿' },
      title: 'Fort Sumter',
      titleZh: '萨姆特堡',
      body:
        'Thirty-four hours of shelling takes a fort in Charleston harbour that was never surrendered, and no one is killed by it. Both sides get what they wanted from the day: the North a reason to raise an army, the South a war before its neighbours could reconsider.',
      bodyZh:
        '三十四小时炮击拿下查尔斯顿港内一座从未投降的堡垒，无人在炮击中阵亡。双方都在这一天得到了各自想要的：北方有了招兵的理由，南方在邻州尚可反悔之前得到了战争。',
    }),
    beat({
      id: 'homestead-act',
      date: '1862-05-20',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Homestead Act',
      titleZh: '宅地法',
      body:
        'Any adult who has never fought against the United States may claim a hundred and sixty acres of public land and own it after five years of living on it. The southern states had blocked it for decades; with them gone it passes in a war session, and over the next forty years about 270 million acres are given away.',
      bodyZh:
        '任何未与合众国作战过的成年人，都可申请一百六十英亩公地，居住五年后归其所有。南方各州阻挠它几十年；它们一退出，就在战时会期通过。此后四十年，约两亿七千万英亩土地被分出去。',
    }),
    beat({
      id: 'emancipation',
      date: '1863-01-01',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Emancipation Proclamation',
      titleZh: '解放宣言',
      body:
        'The president declares free the enslaved in the states in rebellion, and in no others — deliberately, because the border states that stayed in the Union held slaves too. It frees almost no one on the day it is signed and it changes the war into one that cannot end with the old country restored.',
      bodyZh:
        '总统宣布叛乱各州内的被奴役者获得自由，其他州不在其中——这是有意的，因为留在联邦内的边界州同样蓄奴。签署当天它几乎没让任何人获得自由，却把这场战争变成了一场无法以旧国家复原而告终的战争。',
    }),
    beat({
      id: 'gettysburg',
      date: '1863-07-03',
      kind: 'battle',
      place: { lon: -77.2311, lat: 39.8309, name: 'Gettysburg, Pennsylvania', nameZh: '宾夕法尼亚葛底斯堡' },
      title: 'Gettysburg',
      titleZh: '葛底斯堡',
      body:
        'Three days of fighting in a Pennsylvania town leave about fifty thousand casualties, and the same day a Confederate army at Vicksburg surrenders to Grant. Four months later the president speaks for two minutes on the field and says the country was founded on a proposition, not a border.',
      bodyZh:
        '在宾夕法尼亚一座小镇打了三天，伤亡约五万人；同一天，维克斯堡的邦联军向格兰特投降。四个月后，总统在这片战场上讲了两分钟，说这个国家是建在一个命题之上的，而不是一条边界之上。',
    }),
    beat({
      id: 'shermans-march',
      date: '1864-11-15',
      kind: 'war',
      place: { lon: -84.388, lat: 33.749, name: 'Atlanta, Georgia', nameZh: '佐治亚亚特兰大' },
      title: 'March to the sea',
      titleZh: '向大海进军',
      body:
        'Sherman burns Atlanta and cuts his supply line, and sixty thousand men live off the country for five weeks across Georgia. What is destroyed is not armies but the means of living: railways, mills, and the food of the coming winter. He reaches Savannah on December the twenty-first and telegraphs it to the president as a gift.',
      bodyZh:
        '谢尔曼烧掉亚特兰大、切断补给线，六万人横穿佐治亚，靠当地供养自己走了五周。被毁的不是军队，而是活着的手段：铁路、工厂、以及来年冬天的口粮。他在 12 月 21 日抵达萨凡纳，打电报把这座城市当作礼物送给总统。',
      figures: [
        {
          id: 'march-to-the-sea',
          note: 'Atlanta to Savannah, November to December 1864',
          points: [
            [-84.39, 33.75],
            [-83.99, 33.45],
            [-83.23, 33.08],
            [-82.01, 32.9],
            [-81.95, 32.8],
            [-81.1, 32.08],
          ],
        },
      ],
    }),
    beat({
      id: 'appomattox',
      date: '1865-04-09',
      kind: 'battle',
      place: { lon: -78.7978, lat: 37.3772, name: 'Appomattox Court House, Virginia', nameZh: '弗吉尼亚阿波马托克斯' },
      title: 'Appomattox',
      titleZh: '阿波马托克斯',
      body:
        'Lee surrenders the Army of Northern Virginia in a parlour, and the terms let the men go home with their horses for the spring planting. About 620,000 soldiers are dead. The question the war answered — whether the Union could be dissolved by a vote of its members — is answered in the negative, and the other question is left standing.',
      bodyZh:
        '李在一间客厅里交出北弗吉尼亚军团，条件允许士兵带着马匹回家春耕。约六十二万军人死亡。战争回答了那个问题——联邦能否由若干成员投票解散——答案是不能；而另一个问题仍然立在那里。',
    }),
  ],
  /**
   * Chapter 4, Industry — 1865-04-09 to 1900-01-01.
   *
   * The chapter the boundary record likes best: twenty-two states are admitted
   * inside it. It is also the run-up to the end of that record, because Arizona
   * completes the outline in 1912 and nothing moves again. So this chapter is
   * read as much for what it is the last of as for what it built.
   */
  industry: [
    beat({
      id: 'lincoln-assassinated',
      date: '1865-04-14',
      kind: 'politics',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Five days after',
      titleZh: '五天之后',
      body:
        'The president is shot at a theatre five days after the surrender and dies the next morning, hours after the last Confederate army in the field was told to go home. The man who takes over is a Tennessee Democrat who will be at war with his own Congress within a year.',
      bodyZh:
        '投降后第五天，总统在一间剧院中弹，次日清晨去世——就在最后一支在野的邦联军被遣散几个小时后。接任他的是一个田纳西州的民主党人，不出一年就与自己的国会开战。',
    }),
    beat({
      id: 'thirteenth-amendment',
      date: '1865-12-06',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Thirteenth Amendment',
      titleZh: '第十三修正案',
      body:
        'Slavery is abolished everywhere in the United States by constitutional amendment, except as a punishment for crime — a clause that will be read very broadly within a generation. The amendment is ratified by twenty-seven states, and four of the ones that seceded vote for it, under duress.',
      bodyZh:
        '第十三修正案以宪法修正的方式在合众国全境废除奴隶制，但作为犯罪惩罚者除外——这条例外在一代人之内被解释得极宽。修正案由二十七个州批准，其中四个是退出过联邦的州，在压力下投了赞成票。',
    }),
    beat({
      id: 'transcontinental-railroad',
      date: '1869-05-10',
      kind: 'technology',
      place: { lon: -112.5272, lat: 41.6197, name: 'Promontory Summit, Utah', nameZh: '犹他普罗蒙特里' },
      title: 'One line across',
      titleZh: '一条线通了',
      body:
        'Two companies building toward each other from Omaha and Sacramento meet in Utah and drive a golden spike. The journey west that took six months now takes six days, the country\'s clocks have to agree with each other, and the land along the rails is sold off in strips to the companies that built them.',
      bodyZh:
        '两家分别从奥马哈和萨克拉门托对向修筑的公司，在犹他会合，钉下一枚金道钉。西行六个月的路程变成六天；全国的钟不得不互相对齐；铁路沿线的土地则以条带形式卖给修建它的公司。',
      figures: [
        {
          id: 'transcontinental-railroad',
          note: 'Council Bluffs to Sacramento, the line completed 1869',
          points: [
            [-95.94, 41.26],
            [-98.34, 40.92],
            [-100.77, 41.12],
            [-104.82, 41.14],
            [-107.24, 41.79],
            [-111.97, 41.22],
            [-115.76, 40.83],
            [-119.81, 39.53],
            [-121.49, 38.58],
          ],
        },
      ],
    }),
    beat({
      id: 'little-bighorn',
      date: '1876-06-25',
      kind: 'battle',
      place: { lon: -107.42, lat: 45.57, name: 'Little Bighorn, Montana Territory', nameZh: '蒙大拿领地小巨角' },
      title: 'The Little Bighorn',
      titleZh: '小巨角',
      body:
        'Custer\'s command of about two hundred men attacks the largest gathering of Lakota and Cheyenne fighters ever assembled, and is destroyed in an hour. The victory is the last one: within five years the bison herds are gone, the reservations are fixed, and the army is no longer fighting nations but holding them.',
      bodyZh:
        '卡斯特麾下约两百人向拉科塔人与夏延人有史以来最大的集结发起进攻，一小时内被全歼。这是最后一场胜利：五年之内野牛群消失、保留地划定，军队不再与部族作战，而是看管他们。',
    }),
    beat({
      id: 'great-railroad-strike',
      date: '1877-07-14',
      kind: 'protest',
      place: { lon: -77.9636, lat: 39.4565, name: 'Martinsburg, West Virginia', nameZh: '西弗吉尼亚马丁斯堡' },
      title: 'The great strike',
      titleZh: '大罢工',
      body:
        'Wages have been cut for the fourth time in a year, and railway workers at Martinsburg stop the trains. The strike spreads along the lines to a dozen cities, crowds burn the Pennsylvania Railroad\'s roundhouse in Pittsburgh, and federal troops are sent into states that never seceded to put it down.',
      bodyZh:
        '工资在一年内第四次被削减，马丁斯堡的铁路工人拦下了列车。罢工沿着铁路线蔓延到十几个城市，人群在匹兹堡烧掉宾夕法尼亚铁路的机车库；联邦军队被派进从未退出过联邦的州去平息它。',
    }),
    beat({
      id: 'chinese-exclusion',
      date: '1882-05-06',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Chinese exclusion',
      titleZh: '排华法案',
      body:
        'Congress suspends immigration of Chinese labourers for ten years and forbids the naturalisation of those already here. It is renewed, tightened and extended until 1943, and it is the first law in the country\'s history to bar an entire people by national origin.',
      bodyZh:
        '国会暂停华工入境十年，并禁止已在境内者归化。此后一再续期、加严，直到 1943 年才废止；这是这个国家历史上第一部按国籍排除一整个民族的法律。',
    }),
    beat({
      id: 'standard-time',
      date: '1883-11-18',
      kind: 'technology',
      place: { lon: -87.6298, lat: 41.8781, name: 'Chicago, Illinois', nameZh: '伊利诺伊芝加哥' },
      title: 'The day of two noons',
      titleZh: '两个正午的一天',
      body:
        'On one day, at noon, the railways put the country on four time zones and accept the confusion of local sun time ending. The government has not legislated it and will not for thirty-five years, but nobody who moves by rail can keep the old arrangement, and the country starts keeping time together.',
      bodyZh:
        '这一天正午，铁路把全国划入四个时区，也接受了各地按太阳定时的混乱就此结束。政府尚未立法，三十五年内也不会立法；但任何靠铁路移动的人都没法维持旧办法，这个国家开始用同一个时间过日子。',
    }),
    beat({
      id: 'haymarket',
      date: '1886-05-04',
      kind: 'protest',
      place: { lon: -87.6298, lat: 41.8781, name: 'Chicago, Illinois', nameZh: '伊利诺伊芝加哥' },
      title: 'Haymarket',
      titleZh: '秣市广场',
      body:
        'A rally for the eight-hour day is ending when a bomb is thrown and police fire into the crowd; seven officers and at least four workers die. Eight men are convicted, four of them hanged, though none was shown to have thrown it — and the police violence that made the rally necessary is the part that gets forgotten.',
      bodyZh:
        '一场争取八小时工作日的集会正要散场，一枚炸弹被投出，警察向人群开枪；七名警员和至少四名工人死亡。八人被判罪，四人被处绞；却无人被证明投过那枚炸弹——而促成这场集会的警察暴力，恰是被遗忘的那一部分。',
    }),
    beat({
      id: 'sherman-antitrust',
      date: '1890-07-02',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Sherman Act',
      titleZh: '谢尔曼反托拉斯法',
      body:
        'Congress makes every contract or combination in restraint of trade illegal, in twenty-five hundred words that never define what one is. For its first decade it is used mostly against unions rather than against the trusts it was written for, which is a lesson remembered by everyone who writes a similar law afterwards.',
      bodyZh:
        '国会用两千五百个字宣布一切限制贸易的契约或联合为非法，却始终没有定义什么算限制。头十年里，它多被用来对付工会，而不是它本要对付的托拉斯——此后每一个写同类法律的人都记得这一课。',
    }),
    beat({
      id: 'wounded-knee',
      date: '1890-12-29',
      kind: 'battle',
      place: { lon: -102.3724, lat: 43.1405, name: 'Wounded Knee, South Dakota', nameZh: '南达科他伤膝溪' },
      title: 'Wounded Knee',
      titleZh: '伤膝溪',
      body:
        'Soldiers trying to disarm a band of Lakota open fire, and by the end of the day about three hundred men, women and children are dead, along with some twenty-five soldiers hit mostly by their own side\'s fire. It is the last armed encounter of the long wars, and it is fought over a dance.',
      bodyZh:
        '试图解除一支拉科塔人武装的士兵开了火；当天结束时，约三百名男女老幼死亡，另有约二十五名士兵中弹，多数死于己方火力。这是漫长战争中的最后一次武装冲突，而起因是一场舞蹈。',
    }),
    beat({
      id: 'ellis-island',
      date: '1892-01-01',
      kind: 'migration',
      place: { lon: -74.0396, lat: 40.6995, name: 'Ellis Island, New York', nameZh: '纽约埃利斯岛' },
      title: 'The doors open',
      titleZh: '门开了',
      body:
        'A former arsenal in the harbour becomes the country\'s main immigration station, and about twelve million people pass through it in the next thirty-two years, most of them from southern and eastern Europe. The same era is closing the door on the Chinese, and the difference is written into the law rather than into the crowd.',
      bodyZh:
        '港湾里一座旧军械库成为全国主要的移民站，此后三十二年间约一千两百万人从这里通过，多数来自南欧与东欧。同一时期，对华人的门正在关上——而这个差别是写在法律里的，不是写在人群里的。',
    }),
    beat({
      id: 'columbian-exposition',
      date: '1893-05-01',
      kind: 'society',
      place: { lon: -87.6298, lat: 41.8781, name: 'Chicago, Illinois', nameZh: '伊利诺伊芝加哥' },
      title: 'The White City',
      titleZh: '白城',
      body:
        'Chicago opens an exhibition of forty-six nations in white plaster pavilions lit by electricity, and twenty-seven million people come. In July a young historian lectures there that the frontier has closed and with it the first period of American history — the argument that the country has run out of a place to start over.',
      bodyZh:
        '芝加哥以通上电的白色灰泥馆舍办起一场有四十六国参加的博览会，两千七百万人前来。七月，一位年轻的历史学家在这里演讲：边疆已经关闭，美国历史的第一个时期随之结束——这个国家再没有可以重新开始的地方了。',
    }),
    beat({
      id: 'hawaii-annexed',
      date: '1898-07-07',
      kind: 'politics',
      place: { lon: -157.8583, lat: 21.3069, name: 'Honolulu, Hawaii', nameZh: '夏威夷檀香山' },
      title: 'Hawaii',
      titleZh: '夏威夷',
      body:
        'Five years after American planters and the Marines deposed the queen, Congress annexes the islands by joint resolution rather than by treaty, because a treaty would not have passed. In the same year the country takes the Philippines, Puerto Rico and Guam from Spain, and the republic that began as a refusal of empire acquires one.',
      bodyZh:
        '在美国种植园主与海军陆战队推翻女王五年之后，国会以两院联合决议而非条约的方式吞并了这组岛屿——因为条约通不过。同年，美国从西班牙手中取得菲律宾、波多黎各和关岛；一个以拒绝帝国而起的共和国，有了自己的帝国。',
    }),
  ],
  /**
   * Chapter 5, Boom and Bust — 1900-01-01 to 1941-12-07.
   *
   * The last chapter with boundary content, and it has exactly two: Oklahoma in
   * 1907 and Arizona in 1912. The second one is the reason Chapters 6, 7 and 8
   * needed a story layer at all — after it, nothing on the plate moves again for
   * eighty-eight years. So the subject here is what the country did to itself
   * once it had finished drawing its own edges.
   */
  boom: [
    beat({
      id: 'mckinley-shot',
      date: '1901-09-06',
      kind: 'politics',
      place: { lon: -78.8784, lat: 42.8864, name: 'Buffalo, New York', nameZh: '纽约州布法罗' },
      title: 'Buffalo',
      titleZh: '布法罗',
      body:
        'The president is shot at a public reception and dies eight days later. His successor is forty-two, has been vice-president for six months, and within three years has broken up a railroad monopoly, taken the coal mines into arbitration and set aside 230 million acres of public land.',
      bodyZh:
        '总统在一场公开接见中中弹，八天后去世。接任者四十二岁，只当过六个月的副总统；三年之内他拆散了一家铁路垄断公司，把煤矿纠纷交付仲裁，并划出两亿三千万英亩公有土地加以保护。',
    }),
    beat({
      id: 'wright-flight',
      date: '1903-12-17',
      kind: 'technology',
      place: { lon: -75.671, lat: 36.0646, name: 'Kitty Hawk, North Carolina', nameZh: '北卡罗来纳基蒂霍克' },
      title: 'Twelve seconds',
      titleZh: '十二秒',
      body:
        'Two brothers who build bicycles in Ohio fly a machine of wood and cloth for twelve seconds over a sand flat, into a wind of twenty miles an hour. Four flights are made that day, the longest fifty-nine seconds. The newspapers do not believe it, and the first account to appear anywhere is in a beekeeping journal.',
      bodyZh:
        '两个在俄亥俄造自行车的兄弟，把一架木布结构的机器在沙地上飞了十二秒，迎面风速二十英里。当天共飞了四次，最长五十九秒。报纸不信；世界上第一篇相关报道出现在一本养蜂杂志上。',
    }),
    beat({
      id: 'san-francisco-quake',
      date: '1906-04-18',
      kind: 'disaster',
      place: { lon: -122.4194, lat: 37.7749, name: 'San Francisco, California', nameZh: '加利福尼亚旧金山' },
      title: 'San Francisco',
      titleZh: '旧金山',
      body:
        'The San Andreas fault moves along three hundred miles in under a minute, and the fires that follow burn for three days and destroy most of the city. About three thousand people die. What is rebuilt is rebuilt for the photograph, and one effect of the earthquake is a permanent argument about whether California should be believed about its faults.',
      bodyZh:
        '圣安德烈亚斯断层在一分钟内错动三百英里，随后的大火烧了三天，毁掉大半座城。约三千人死亡。重建是为了照相而重建的；这场地震留下的一个长久后果，是人们究竟要不要相信加州对自己断层的说法。',
    }),
    beat({
      id: 'triangle-fire',
      date: '1911-03-25',
      kind: 'disaster',
      place: { lon: -73.995, lat: 40.73, name: 'New York, New York', nameZh: '纽约州纽约' },
      title: 'The Triangle fire',
      titleZh: '三角工厂大火',
      body:
        'A garment workshop on the top floors of a building catches fire, and the exit doors are locked to stop the workers leaving early. One hundred and forty-six people die, most of them young immigrant women. The owners are acquitted, and the state of New York starts writing the factory codes that the rest of the country eventually copies.',
      bodyZh:
        '一栋楼顶层制衣车间起火，而出口门为防止工人早退被反锁。一百四十六人死亡，多数是年轻的移民女工。厂主被判无罪；纽约州开始编写工厂安全规程，最终被全国效仿。',
    }),
    beat({
      id: 'assembly-line',
      date: '1913-10-07',
      kind: 'technology',
      place: { lon: -83.09, lat: 42.4, name: 'Highland Park, Michigan', nameZh: '密歇根高地公园' },
      title: 'The line',
      titleZh: '流水线',
      body:
        'Ford begins dragging the Model T past stationary workers on a moving rope, and the time to assemble one falls from twelve hours to about ninety minutes. Four years later the company doubles wages to five dollars a day, which is enough to buy the thing you are making, and the workers who can afford it are the market.',
      bodyZh:
        '福特开始用一条移动的绳索把 T 型车拖过不动的工人，装配一辆车的时间从十二小时降到约九十分钟。四年后公司把日薪翻倍到五美元——足够买下自己造的东西；买得起它的工人，就是市场。',
    }),
    beat({
      id: 'panama-canal',
      date: '1914-08-15',
      kind: 'technology',
      place: { lon: -79.53, lat: 8.98, name: 'Culebra Cut, Panama', nameZh: '巴拿马库莱布拉切' },
      title: 'The canal',
      titleZh: '运河',
      body:
        'After ten years, a hundred million cubic yards of excavation and about 5,600 deaths, the first ship passes between the oceans. It saves the voyage from New York to San Francisco eight thousand miles, and it exists because the United States helped a province of Colombia secede and then leased the ditch from the new country.',
      bodyZh:
        '十年、一亿立方码开挖量、约五千六百人死亡之后，第一艘船穿行于两洋之间。它让纽约到旧金山少走八千英里；而它得以存在，是因为美国帮助哥伦比亚的一个省独立，再从那个新国家手里租下这条沟。',
    }),
    beat({
      id: 'great-war',
      date: '1917-04-06',
      kind: 'war',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The war in Europe',
      titleZh: '欧洲的战争',
      body:
        'After two and a half years of neutrality the United States declares war on Germany, and about four million men are mobilised in twenty months. The country is changed at home more than abroad: the income tax becomes permanent, the railways are nationalised for a year, and the draft is ruled constitutional.',
      bodyZh:
        '中立了两年半之后，美国对德宣战，二十个月内动员约四百万人。与其说它因此改变了他国，不如说它改变了自己：所得税成为永久税种，铁路被国有化一年，征兵制被判合宪。',
    }),
    beat({
      id: 'influenza',
      date: '1918-09-28',
      kind: 'disaster',
      place: { lon: -75.1652, lat: 39.9526, name: 'Philadelphia, Pennsylvania', nameZh: '宾夕法尼亚费城' },
      title: 'The parade',
      titleZh: '那场游行',
      body:
        'Philadelphia holds a Liberty Loan parade of two hundred thousand people while the second wave of influenza is already in the city hospitals. Within three days every bed is full; within six weeks more than twelve thousand people are dead in Philadelphia alone. The city\'s health director had been denied the money to fight it.',
      bodyZh:
        '第二轮流感已进医院之时，费城仍举行了一场二十万人的自由公债游行。三天之内所有病床住满；六周之内仅费城就有一万两千余人死亡。此前卫生局长请求的防疫经费被驳回。',
    }),
    beat({
      id: 'nineteenth-amendment',
      date: '1920-08-18',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Nineteenth Amendment',
      titleZh: '第十九修正案',
      body:
        'The right to vote may not be denied on account of sex, and it is ratified by one vote in Tennessee, after a young legislator changes his mind on a note from his mother. It does not enfranchise most Black women in the South, whose exclusion is by other means and lasts another forty-five years.',
      bodyZh:
        '选举权不得因性别被否认；修正案在田纳西以一票之差通过——一位年轻议员读了母亲的便条后改了主意。它并没有让南方大多数黑人女性获得选举权，她们的被排除另有手段，又持续了四十五年。',
    }),
    beat({
      id: 'scopes-trial',
      date: '1925-07-10',
      kind: 'society',
      place: { lon: -85.0119, lat: 35.4937, name: 'Dayton, Tennessee', nameZh: '田纳西代顿' },
      title: 'The Scopes trial',
      titleZh: '斯科普斯审判',
      body:
        'A substitute teacher is tried for teaching evolution, which the state has made a misdemeanour. The defence calls the prosecuting attorney as an expert on the Bible and gets him to concede that the first day of creation need not have been twenty-four hours; the teacher is convicted anyway and the fine is thrown out on appeal.',
      bodyZh:
        '一名代课教师因教授进化论受审，该州将此举定为轻罪。辩方把主控律师传为《圣经》专家，逼他承认创世的第一日未必是二十四小时；教师仍被判有罪，罚款在上诉时被撤销。',
    }),
    beat({
      id: 'lindbergh',
      date: '1927-05-20',
      kind: 'technology',
      place: { lon: -73.61, lat: 40.73, name: 'Roosevelt Field, New York', nameZh: '纽约罗斯福机场' },
      title: 'Alone across',
      titleZh: '独自越洋',
      body:
        'A twenty-five-year-old airmail pilot takes off from a field on Long Island with thirty-four hours of fuel and no radio, and lands at Le Bourget thirty-three and a half hours later. Four people die in the crowd that meets him. It is the first solo flight across the Atlantic and the first news event the new radio networks make into a single shared evening.',
      bodyZh:
        '一名二十五岁的航空邮件飞行员从长岛的机场起飞，带三十四小时燃油、没有无线电；三十三小时半后降落在勒布尔热。前去迎接的人群中四人被挤死。这是第一次单人不着陆飞越大西洋，也是新的无线电联播网络第一次把一桩新闻变成全国共度的一晚。',
    }),
    beat({
      id: 'crash',
      date: '1929-10-29',
      kind: 'economy',
      place: { lon: -74.0113, lat: 40.7069, name: 'Wall Street, New York', nameZh: '纽约华尔街' },
      title: 'Black Tuesday',
      titleZh: '黑色星期二',
      body:
        'Sixteen million shares change hands in a day and the market loses about a ninth of its value on top of the losses of the week before. The crash does not cause the Depression by itself; it removes the thing that was hiding it — credit — and industrial production falls by half within three years.',
      bodyZh:
        '一天之内一千六百万股换手，市场在前一周的跌幅之上又跌去约九分之一。崩盘本身并不造成大萧条；它移走了那个一直在遮掩萧条的东西——信贷——三年之内工业生产腰斩。',
    }),
    beat({
      id: 'black-sunday',
      date: '1935-04-14',
      kind: 'disaster',
      place: { lon: -102.513, lat: 36.7295, name: 'Boise City, Oklahoma', nameZh: '俄克拉何马博伊西城' },
      title: 'Black Sunday',
      titleZh: '黑色星期日',
      body:
        'A front two hundred miles wide lifts the topsoil of the southern plains and carries it east, turning day into night as far as Chicago and dropping dust on New York. Some of the dust came from land that had been broken by the plough fewer than thirty years earlier; about two and a half million people leave the region in the decade.',
      bodyZh:
        '一道两百英里宽的锋面把南部大平原的表土卷起向东，一路把白昼变成黑夜，直到芝加哥，还往纽约落下尘土。其中一些土，来自不到三十年前才被犁开的土地；这十年里约二百五十万人离开该地区。',
    }),
    beat({
      id: 'social-security',
      date: '1935-08-14',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Social Security',
      titleZh: '社会保障法',
      body:
        'The act writes a pension for the aged, insurance against unemployment, and help for dependent children into federal law, paid for by a payroll tax rather than out of general revenue. It is deliberately contributory so that no future Congress can call it charity, and it excludes the farmworkers and domestic servants who are most of the Black working population.',
      bodyZh:
        '这部法律把养老金、失业保险与对抚养儿童的补助写进联邦法，由工薪税而非一般财政收入支付。它刻意采用缴费制，以免日后任何一届国会把它称作施舍；同时把农业工人与家仆排除在外——而黑人劳动者大多从事这两种职业。',
    }),
  ],
  /**
   * Chapter 6, WWII — 1941-12-07 to 1945-08-15.
   *
   * The chapter opens on the day it is named for: the first beat's date is the
   * chapter's own opening date, so the panel is populated on the first frame
   * rather than arriving a moment later. The arc runs from the attack to the
   * surrender, and it is deliberately not a list of victories — a history that
   * only counts the winning is a different history.
   *
   * Every fact below is a public record, written out here rather than quoted
   * from anywhere; nothing from the documentary's script or any other
   * publication is reproduced. See the *Reference material* note in the README.
   */
  wwii: [
    beat({
      id: 'pearl-harbor',
      date: '1941-12-07',
      kind: 'battle',
      place: { lon: -157.95, lat: 21.35, name: 'Pearl Harbor, Oʻahu', nameZh: '瓦胡岛珍珠港' },
      title: 'Pearl Harbor',
      titleZh: '珍珠港',
      body:
        'Two waves of Japanese aircraft strike the Pacific Fleet in its own harbour in ninety minutes. Eight battleships are sunk or crippled and 2,403 Americans are killed; the fleet\'s aircraft carriers happen to be at sea and survive, which is the accident the next six months turn on.',
      bodyZh:
        '日军两波机群在九十分钟内袭击了停泊在自家港内的太平洋舰队。八艘战列舰被击沉或重创，2403 名美国人丧生；舰队航空母舰恰在海上，得以幸存——此后半年的战局，正系于这个偶然。',
    }),
    beat({
      id: 'executive-order-9066',
      date: '1942-02-19',
      kind: 'politics',
      place: { lon: -77.04, lat: 38.9, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Executive Order 9066',
      titleZh: '第 9066 号行政令',
      body:
        'The President authorises the army to exclude anyone it chooses from the West Coast. About 120,000 people of Japanese descent — two thirds of them American citizens — are taken from their homes to camps inland, without charge and without trial.',
      bodyZh:
        '总统授权军方在西海岸任意划出禁区。约 12 万日裔——其中三分之二是美国公民——被迁离家园、关进内陆营地，未经起诉，也未受审判。',
    }),
    beat({
      id: 'midway',
      date: '1942-06-04',
      kind: 'battle',
      place: { lon: -177.37, lat: 28.21, name: 'Midway Atoll', nameZh: '中途岛环礁' },
      title: 'Midway',
      titleZh: '中途岛',
      body:
        'Four Japanese fleet carriers are sunk in a single day against one American. What Japan loses with them is the trained aircrew it cannot replace, and with that the initiative in the Pacific passes.',
      bodyZh:
        '一天之内，日军四艘舰队航母被击沉，美军损失一艘。随之而去的，是日本无法补充的老练飞行员；太平洋战场的主动权就此易手。',
    }),
    beat({
      id: 'willow-run',
      date: '1943-06-01',
      kind: 'homefront',
      place: { lon: -83.55, lat: 42.25, name: 'Willow Run, Michigan', nameZh: '密歇根州柳溪' },
      title: 'The arsenal',
      titleZh: '兵工厂',
      body:
        'A Ford plant raised on farmland west of Detroit finishes a B-24 Liberator every sixty-three minutes at its peak. Millions of women take industrial war work; the country that could barely arm itself in 1940 out-produces all of its enemies combined by 1944.',
      bodyZh:
        '底特律以西的农田上，福特工厂在产量顶峰时每 63 分钟下线一架 B-24 轰炸机。数百万女性进入军工生产；1940 年几乎武装不起自己的国家，到 1944 年产量已超过所有敌国之和。',
    }),
    beat({
      id: 'd-day',
      date: '1944-06-06',
      kind: 'battle',
      place: { lon: -0.87, lat: 49.36, name: 'Normandy, France', nameZh: '法国诺曼底' },
      title: 'D-Day',
      titleZh: '诺曼底登陆',
      body:
        '156,000 Allied troops land on five beaches in Normandy in a single day, the largest seaborne invasion ever attempted. By nightfall the beachhead holds, and the road to Germany is open from the west.',
      bodyZh:
        '首日 15.6 万盟军士兵在诺曼底五处海滩登陆，是史上规模最大的海上入侵。入夜时滩头阵地已然站住，通往德国的西路就此打开。',
    }),
    beat({
      id: 'iwo-jima',
      date: '1945-02-19',
      kind: 'battle',
      place: { lon: 141.32, lat: 24.75, name: 'Iwo Jima', nameZh: '硫磺岛' },
      title: 'Iwo Jima',
      titleZh: '硫磺岛',
      body:
        'Thirty-six days of fighting over eight square miles leave 6,800 Americans and almost all of the 21,000 Japanese defenders dead. The island is wanted as an emergency landing field for bombers that cannot make it home.',
      bodyZh:
        '在八平方英里的火山岛上打了三十六天，美军阵亡 6800 人，日军 2.1 万守军几乎全部战死。争夺它的理由只有一个：给飞不回去的轰炸机当紧急备降场。',
    }),
    beat({
      id: 'trinity',
      date: '1945-07-16',
      kind: 'science',
      place: { lon: -106.47, lat: 33.68, name: 'Alamogordo, New Mexico', nameZh: '新墨西哥州阿拉莫戈多' },
      title: 'Trinity',
      titleZh: '三位一体',
      body:
        'At 5.29 in the morning, in the desert near Alamogordo, the first atomic device is detonated. The people who assembled it by hand now see the thing they had only been able to calculate.',
      bodyZh:
        '清晨 5 点 29 分，阿拉莫戈多附近的沙漠里，人类第一枚原子装置被引爆。亲手把它造出来的人，此刻才第一次看见此前只能靠计算推想的东西。',
    }),
    beat({
      id: 'hiroshima',
      date: '1945-08-06',
      kind: 'science',
      place: { lon: 132.46, lat: 34.39, name: 'Hiroshima, Japan', nameZh: '日本广岛' },
      title: 'Hiroshima',
      titleZh: '广岛',
      body:
        'One weapon destroys a city. Between 70,000 and 100,000 people are dead by the end of the year. The atomic age begins here, and that is its first cost.',
      bodyZh:
        '一件武器摧毁了一座城市。到当年年底，死亡人数在 7 万至 10 万之间。原子时代由此开始，而这就是它最初付出的代价。',
    }),
    beat({
      id: 'vj-day',
      date: '1945-08-15',
      kind: 'politics',
      place: { lon: 139.69, lat: 35.69, name: 'Tokyo, Japan', nameZh: '日本东京' },
      title: 'The end',
      titleZh: '终战',
      body:
        'Japan announces its surrender. About 400,000 Americans are dead, and a country with almost no army in 1939 ends the war as the strongest power on earth.',
      bodyZh:
        '日本宣布投降。约 40 万美国人阵亡；一个 1939 年几乎没有军队的国家，在战争结束时已成世界第一强国。',
    }),
  ],
  /**
   * Chapter 7, Superpower — 1945-08-15 to 1989-11-09.
   *
   * Boundary-static and anchorless, for the reason given at Chapter 6: nothing
   * in this window moves, and there is no earlier line beneath the plate to
   * leave as sediment. Two of its beats are in Alaska and Hawaii, and those two
   * are the chapter's only dated boundary events — the statehoods of 1959 —
   * which the panels cannot show either, because every version of the insets is
   * the same shape under a different name.
   */
  superpower: [
    beat({
      id: 'truman-doctrine',
      date: '1947-03-12',
      kind: 'politics',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Truman Doctrine',
      titleZh: '杜鲁门主义',
      body:
        'The president asks Congress for money to support governments threatened by armed minorities or outside pressure, naming Greece and Turkey. It is a blank commitment written for two countries, and it becomes the frame for forty years of foreign policy in which every local question is asked as a question about Moscow.',
      bodyZh:
        '总统请求国会拨款，去支持受到武装少数派或外来压力威胁的政府，并点名希腊与土耳其。这是一项为两国而写的空白承诺，却在此后四十年成为外交政策的框架：任何地方问题，都要先问它和莫斯科的关系。',
    }),
    beat({
      id: 'berlin-airlift',
      date: '1948-06-24',
      kind: 'war',
      place: { lon: 13.405, lat: 52.52, name: 'Berlin, Germany', nameZh: '德国柏林' },
      title: 'The airlift',
      titleZh: '空运',
      body:
        'The Soviets cut the road and rail links to West Berlin, and the Western powers supply two and a half million people by air for eleven months. At the peak an aircraft lands every forty-five seconds; the pilots begin dropping candy on handkerchief parachutes for the children watching from the ends of the runways.',
      bodyZh:
        '苏联切断通往西柏林的公路与铁路，西方各国用飞机供养两百五十万人，持续十一个月。最高峰时每四十五秒就有一架飞机降落；飞行员开始往跑道尽头围观的孩子那里，用小手绢降落伞投下糖果。',
    }),
    beat({
      id: 'korea',
      date: '1950-06-25',
      kind: 'war',
      place: { lon: 126.978, lat: 37.5665, name: 'Seoul, Korea', nameZh: '朝鲜半岛汉城' },
      title: 'Korea',
      titleZh: '朝鲜战争',
      body:
        'North Korean forces cross the 38th parallel and the United States goes to war under a United Nations resolution, without a declaration of war from Congress. Three years and about thirty-six thousand American deaths later the line is very near where it started, and the armistice is never replaced by a peace treaty.',
      bodyZh:
        '朝鲜军队越过三八线，美国依联合国决议参战，国会未宣战。三年、约三万六千名美军阵亡之后，战线几乎回到起点；停战协定之后，再也没有一份和约把它换下来。',
    }),
    beat({
      id: 'brown-v-board',
      date: '1954-05-17',
      kind: 'law',
      place: { lon: -95.689, lat: 39.0473, name: 'Topeka, Kansas', nameZh: '堪萨斯托皮卡' },
      title: 'Brown v. Board',
      titleZh: '布朗诉教育委员会案',
      body:
        'The Supreme Court unanimously holds that separate schools are inherently unequal and that segregation in education violates the Fourteenth Amendment. The following year it says the change must proceed with all deliberate speed, which turns out to be the phrase the resistance will spend a generation inside.',
      bodyZh:
        '最高法院一致裁定：种族隔离的学校本质上不平等，教育中的隔离违反第十四修正案。次年它又要求各州以「审慎的速度」推行——而抵制的一方，正是在这个词里耗掉了整整一代人。',
    }),
    beat({
      id: 'rosa-parks',
      date: '1955-12-01',
      kind: 'protest',
      place: { lon: -86.3, lat: 32.3668, name: 'Montgomery, Alabama', nameZh: '亚拉巴马蒙哥马利' },
      title: 'Montgomery',
      titleZh: '蒙哥马利',
      body:
        'A seamstress refuses to give up her seat on a city bus, and the Black community walks and shares cars for three hundred and eighty-one days rather than ride. The buses desegregate, the boycott\'s young spokesman becomes a minister the country will hear from for thirteen more years, and the method spreads.',
      bodyZh:
        '一位女裁缝在公交车上拒绝让座；黑人社区步行、合伙搭车三百八十一天，也不去坐车。公交车最终废止隔离；这场抵制中年轻的发言人此后十三年一直是全国都听得见的声音，而这种做法就此传开。',
    }),
    beat({
      id: 'interstate-highway',
      date: '1956-06-29',
      kind: 'technology',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Forty-one thousand miles',
      titleZh: '四万一千英里',
      body:
        'The act funds a national system of limited-access highways at ninety per cent federal cost, on the argument that the country has to be able to move an army across itself. The roads are routed through the middle of cities, and the neighbourhoods they are routed through are, more often than not, Black ones.',
      bodyZh:
        '该法案以九成联邦出资建设全国封闭式高速公路网，理由是：国家必须能在自己境内调动军队。路线多从城市中心穿过；而被它们穿过的街区，往往正是黑人街区。',
    }),
    beat({
      id: 'sputnik',
      date: '1957-10-04',
      kind: 'science',
      place: { lon: 63.34, lat: 45.96, name: 'Baikonur, Kazakh SSR', nameZh: '哈萨克拜科努尔' },
      title: 'Sputnik',
      titleZh: '斯普特尼克',
      body:
        'A polished sphere eighty-three centimetres across is put into orbit and beeps for three weeks, and the country that had assumed it led in science discovers that it does not. Within a year Congress creates a space agency, the National Defense Education Act sends money into schools, and the science curriculum is rewritten.',
      bodyZh:
        '一颗直径八十三厘米的抛光球体被送入轨道，嘟了三个星期；一个自认在科学上领先的国家，发现自己并不领先。一年之内，国会设立了航天机构，《国防教育法》把钱送进学校，科学课程被重写。',
    }),
    beat({
      id: 'alaska-statehood',
      date: '1959-01-03',
      kind: 'politics',
      place: { lon: -134.4197, lat: 58.3019, name: 'Juneau, Alaska', nameZh: '阿拉斯加朱诺' },
      title: 'The forty-ninth',
      titleZh: '第四十九个州',
      body:
        'Alaska, bought from Russia in 1867 for two cents an acre and governed as a territory for ninety years, becomes a state. It is the only boundary event in this chapter, and it is drawn inside an inset panel rather than on the sheet — and the panel\'s outline does not change, because the shape of Alaska is not what statehood altered.',
      bodyZh:
        '1867 年以每英亩两分钱从俄国买下、作为领地治理了九十年的阿拉斯加成为一州。这是本章唯一的边界事件，而它画在插图框里、不在图纸上——并且插图框的轮廓没有变化，因为州地位改变的并不是阿拉斯加的形状。',
    }),
    beat({
      id: 'hawaii-statehood',
      date: '1959-08-21',
      kind: 'politics',
      place: { lon: -157.8583, lat: 21.3069, name: 'Honolulu, Hawaii', nameZh: '夏威夷檀香山' },
      title: 'The fiftieth',
      titleZh: '第五十个州',
      body:
        'Hawaii becomes a state seven months after Alaska, and the fifty-star flag is raised the following July. The two admissions are the last boundary changes the record contains, and the atlas\'s fourth chapter draws the same plate from here to the end of the century.',
      bodyZh:
        '夏威夷在阿拉斯加之后七个月成为一州，次年七月升起五十星旗。这两次加入是记录中最后的边界变更；从那时起直到世纪末，本图集的每一章画的是同一张图。',
    }),
    beat({
      id: 'cuban-missile-crisis',
      date: '1962-10-22',
      kind: 'war',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Thirteen days',
      titleZh: '十三天',
      body:
        'Photographs show Soviet missiles in Cuba, the president announces a naval quarantine, and for six days the two governments decide whether to use weapons whose use neither of them can survive. The missiles are withdrawn in exchange for a public promise not to invade Cuba and a private one to remove missiles from Turkey.',
      bodyZh:
        '照片显示古巴有苏联导弹；总统宣布海上封锁；此后六天里，两国政府反复决定要不要动用一种谁也活不下来的武器。最终导弹被撤走，换来公开承诺不入侵古巴，以及一项私下的承诺：撤走驻土耳其的导弹。',
    }),
    beat({
      id: 'civil-rights-act',
      date: '1964-07-02',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The Civil Rights Act',
      titleZh: '民权法案',
      body:
        'Segregation in public places and discrimination in employment are made illegal, and the filibuster against it is broken after fifty-seven days — the longest in the Senate\'s history. The act rests on the commerce clause, not on the Fourteenth Amendment, because the narrower ground is the one the Court will uphold.',
      bodyZh:
        '公共场所的隔离与就业中的歧视为非法；反对它的冗长辩论在五十七天后被终止——参议院历史上最长的一次。该法依据的是商业条款而不是第十四修正案，因为较窄的依据才是法院会支持的依据。',
    }),
    beat({
      id: 'selma',
      date: '1965-03-07',
      kind: 'protest',
      place: { lon: -87.0211, lat: 32.4074, name: 'Selma, Alabama', nameZh: '亚拉巴马塞尔玛' },
      title: 'Bloody Sunday',
      titleZh: '血腥星期日',
      body:
        'Six hundred people walking to Montgomery for the vote are driven back off a bridge by state troopers with clubs and tear gas, with the cameras rolling. Two more marches follow, under federal protection, and five months later the Voting Rights Act puts the registration of Black voters under federal supervision.',
      bodyZh:
        '六百人为争取选举权走向蒙哥马利，在桥上被州警用警棍和催泪瓦斯赶回，而摄影机在现场。随后又有两次游行，在联邦保护下完成；五个月后，《选举权法》把黑人选民登记置于联邦监督之下。',
    }),
    beat({
      id: 'king-killed',
      date: '1968-04-04',
      kind: 'politics',
      place: { lon: -90.049, lat: 35.1495, name: 'Memphis, Tennessee', nameZh: '田纳西孟菲斯' },
      title: 'Memphis',
      titleZh: '孟菲斯',
      body:
        'Martin Luther King is shot on a motel balcony the day after a speech in which he said he had been to the mountaintop and might not get there with them. The killing sets off riots in more than a hundred cities, and the fair housing act passes a week later, which had been going nowhere for two years.',
      bodyZh:
        '马丁·路德·金在汽车旅馆的阳台上中弹；前一天他刚说过自己已经到了山顶，也许不能和众人一起走到。枪击在一百多个城市引发骚乱；一周后，《公平住房法》通过——而在此之前它已经搁置了两年。',
    }),
    beat({
      id: 'moon',
      date: '1969-07-20',
      kind: 'science',
      place: { lon: -80.6043, lat: 28.5729, name: 'Cape Canaveral, Florida', nameZh: '佛罗里达卡纳维拉尔角' },
      title: 'The Moon',
      titleZh: '月球',
      body:
        'Two men land a spacecraft on the Moon and walk on it for two and a half hours while six hundred million people watch, and the flag they leave cannot have moved in the wind because there is none. The programme that did it cost about twenty-five billion dollars, employed four hundred thousand people, and is cancelled within three years.',
      bodyZh:
        '两人把飞船降在月球上，行走两个半小时，六亿人观看；他们留下的旗子不可能在风中飘动，因为那里没有风。实现它的计划花了约两百五十亿美元、雇了四十万人，并在三年内被取消。',
    }),
    beat({
      id: 'nixon-resigns',
      date: '1974-08-09',
      kind: 'politics',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The resignation',
      titleZh: '辞职',
      body:
        'Facing certain impeachment over a burglary and its cover-up, the president becomes the only one to leave office by resigning. The tapes that convicted him were made by his own order, for his own history; the system that removed him was not the one the founders feared — it was a court, a committee and a subpoena.',
      bodyZh:
        '因一桩入室窃案及其掩盖而面临必然的弹劾，总统成为唯一以辞职离任的总统。定他罪的那些录音，是他为了自己的历史而下令录制的；把他赶下台的不是建国者担心的那种力量，而是一家法院、一个委员会和一张传票。',
    }),
    beat({
      id: 'tear-down-this-wall',
      date: '1987-06-12',
      kind: 'politics',
      place: { lon: 13.405, lat: 52.52, name: 'Berlin, Germany', nameZh: '德国柏林' },
      title: 'Tear down this wall',
      titleZh: '推倒这堵墙',
      body:
        'Standing at the Brandenburg Gate, the president of the United States tells the general secretary of the Soviet Union to open the barrier that has divided the city since 1961. Nobody in either government treats it as an ultimatum. It is quoted for two years, and then it happens.',
      bodyZh:
        '在勃兰登堡门前，美国总统要求苏共总书记打开这道自 1961 年以来分割这座城市的屏障。两国政府里没有人把它当作最后通牒。它被引用了两年，然后事情真的发生了。',
    }),
  ],
  /**
   * Chapter 8, Millennium — 1989-11-09 to the present.
   *
   * The window runs past the record here, deliberately: `to` is the narrative
   * present, not the last day the boundary data can speak to (2000-12-31). A
   * chapter whose window extends beyond the record needs the `t` flag computed
   * against the record and not against the window, or the plate dissolves to
   * blank paper on its own last frame — see the note in `pipeline/build.js`.
   */
  millennium: [
    beat({
      id: 'wall-falls',
      date: '1989-11-09',
      kind: 'politics',
      place: { lon: 13.405, lat: 52.52, name: 'Berlin, Germany', nameZh: '德国柏林' },
      title: 'The Wall opens',
      titleZh: '墙开了',
      body:
        'A spokesman for the East German government reads out a new travel rule at an evening press conference, is asked when it takes effect, and says "immediately". Crowds go to the crossings, the guards let them through, and people who have been separated for twenty-eight years are standing on each other\'s side of the city before midnight.',
      bodyZh:
        '东德政府发言人当晚在记者会上念出一条新的旅行规定，被问何时生效，答道「立即」。人群涌向过境点，守卫放行；午夜之前，分离了二十八年的亲人们站到了城市的另一侧。',
    }),
    beat({
      id: 'desert-storm',
      date: '1991-01-17',
      kind: 'war',
      place: { lon: 47.9783, lat: 29.3759, name: 'Kuwait City, Kuwait', nameZh: '科威特科威特城' },
      title: 'The Gulf War',
      titleZh: '海湾战争',
      body:
        'An American-led coalition of thirty-four countries begins a bombing campaign to reverse the invasion of Kuwait, and the ground war lasts a hundred hours. The cable news channel that covers it live, with ticking clocks and the trajectories of missiles, invents the way wars are watched from here on.',
      bodyZh:
        '以美国为首、三十四国组成的联军开始空袭，以逆转对科威特的入侵；地面战只打了一百小时。全程直播这场战争的有线新闻频道——连同跳动的时钟与导弹轨迹——发明了此后战争被观看的方式。',
    }),
    beat({
      id: 'soviet-union-ends',
      date: '1991-12-26',
      kind: 'politics',
      place: { lon: 37.6173, lat: 55.7558, name: 'Moscow, Russia', nameZh: '俄罗斯莫斯科' },
      title: 'The Union ends',
      titleZh: '联盟解体',
      body:
        'The Soviet Union is dissolved by its own parliament, four days after eleven of its republics agreed to replace it, and the flag comes down over the Kremlin. The adversary of forty-four years stops existing, and the country that had organised its entire budget around that adversary has to decide what it is for.',
      bodyZh:
        '苏联被它自己的议会解散——四天前，其十一个加盟共和国已同意以新的联合体取代它；克里姆林宫上空的旗降下。周旋了四十四年的对手不复存在，而那个把全部预算围绕这个对手组织起来的国家，必须回答自己是为了什么。',
    }),
    beat({
      id: 'oklahoma-city',
      date: '1995-04-19',
      kind: 'disaster',
      place: { lon: -97.5164, lat: 35.4676, name: 'Oklahoma City, Oklahoma', nameZh: '俄克拉何马城' },
      title: 'Oklahoma City',
      titleZh: '俄克拉何马城',
      body:
        'A truck bomb outside a federal building kills a hundred and sixty-eight people, including nineteen children in a day-care centre. It is the worst act of domestic terrorism in the country\'s history, it is carried out by two Americans, and the search for a foreign connection goes on for days after the arrests.',
      bodyZh:
        '一辆载着炸弹的卡车在一座联邦大楼外引爆，一百六十八人死亡，其中包括日托中心的十九名儿童。这是这个国家历史上最严重的本土恐怖主义事件，实施者是两名美国人；而寻找外国关联的努力，在逮捕之后仍持续了数日。',
    }),
    beat({
      id: 'the-search-engine',
      date: '1998-09-04',
      kind: 'technology',
      place: { lon: -122.1817, lat: 37.4529, name: 'Menlo Park, California', nameZh: '加利福尼亚门洛帕克' },
      title: 'The search engine',
      titleZh: '搜索引擎',
      body:
        'Two graduate students incorporate a company around a way of ranking pages by how many other pages link to them, which turns out to be a better map of the web than any index of its contents. Within a decade the ordering of that list is the most commercially valuable decision made anywhere, and nobody voted on it.',
      bodyZh:
        '两名研究生注册了一家公司，其核心是一种按「有多少页面链接到它」来排序的算法——这比任何内容索引都更像一张网络的地图。十年之内，这个列表的排序成为世界上商业价值最高的一个决定，而它不由任何人投票产生。',
    }),
    beat({
      id: 'bush-v-gore',
      date: '2000-12-12',
      kind: 'law',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'Thirty-six days',
      titleZh: '三十六天',
      body:
        'Five weeks after an election decided by a few hundred votes in one state, the Supreme Court stops the recount by a vote of five to four, and the candidate who lost the popular vote takes the presidency. It is the fourth time a president has been elected without winning the most votes, and the first time a court has decided which one.',
      bodyZh:
        '在一场由一个州数百张选票决定的选举过去五周之后，最高法院以五比四停止重新计票，得票较少的一方入主白宫。这是第四次由未赢得最多选票的人当选总统，也是第一次由法院决定是谁。',
    }),
    beat({
      id: 'september-eleven',
      date: '2001-09-11',
      kind: 'disaster',
      place: { lon: -74.0134, lat: 40.7115, name: 'New York, New York', nameZh: '纽约州纽约' },
      title: 'September 11',
      titleZh: '九一一',
      body:
        'Nineteen men hijack four airliners and fly two of them into the towers of the World Trade Center, one into the Pentagon and one into a field in Pennsylvania after the passengers fight for the cockpit. About three thousand people are killed. Twenty years of war follow, and the last American aircraft leaves Kabul in August 2021.',
      bodyZh:
        '十九人劫持四架客机，其中两架撞入世界贸易中心双塔，一架撞入五角大楼，一架因乘客与劫机者争夺驾驶舱而坠入宾夕法尼亚的田野。约三千人死亡。此后是二十年的战争；最后一架美军飞机于 2021 年 8 月离开喀布尔。',
    }),
    beat({
      id: 'katrina',
      date: '2005-08-29',
      kind: 'disaster',
      place: { lon: -90.0715, lat: 29.9511, name: 'New Orleans, Louisiana', nameZh: '路易斯安那新奥尔良' },
      title: 'Katrina',
      titleZh: '卡特里娜',
      body:
        'A hurricane that had weakened before landfall nevertheless breaks the levees in fifty-three places and floods eighty per cent of New Orleans, and about a thousand four hundred people die. Most of those who could not leave were poor, and the televised week that followed makes the country argue about who it had left behind.',
      bodyZh:
        '这场飓风在登陆前已减弱，却仍在五十三处冲垮堤坝，淹掉新奥尔良八成城区，约一千四百人死亡。走不了的人大多是穷人；此后被全程直播的一周，让这个国家开始争论它究竟把谁留下了。',
    }),
    beat({
      id: 'lehman',
      date: '2008-09-15',
      kind: 'economy',
      place: { lon: -74.0113, lat: 40.7069, name: 'Wall Street, New York', nameZh: '纽约华尔街' },
      title: 'The collapse',
      titleZh: '崩塌',
      body:
        'A bank with six hundred billion dollars of assets files for bankruptcy, the largest in the country\'s history, and the credit market stops. The government commits more than a trillion dollars to keep the system from following it, unemployment reaches ten per cent, and about ten million households lose their homes.',
      bodyZh:
        '一家拥有六千亿美元资产的银行申请破产，是这个国家历史上最大的一宗；信贷市场随即停摆。政府投入超过一万亿美元阻止整个体系跟着倒下；失业率达到一成，约一千万个家庭失去住房。',
    }),
    beat({
      id: 'obama-elected',
      date: '2008-11-04',
      kind: 'politics',
      place: { lon: -87.6298, lat: 41.8781, name: 'Chicago, Illinois', nameZh: '伊利诺伊芝加哥' },
      title: 'Grant Park',
      titleZh: '格兰特公园',
      body:
        'A first-term senator from Illinois is elected the first Black president, less than fifty years after the marches that made it possible to vote and forty-three years after the Voting Rights Act. In a park in Chicago a quarter of a million people stand in the cold and cheer, and the country\'s oldest failure and its newest fact are in the same sentence.',
      bodyZh:
        '伊利诺伊一名只当过一任的参议员当选为第一位黑人总统——距离使投票成为可能的那些游行不到五十年，距离《选举权法》四十三年。芝加哥一座公园里，二十五万人站在寒风中欢呼；这个国家最古老的失败与最新的事实，落在同一句话里。',
    }),
    beat({
      id: 'bin-laden',
      date: '2011-05-02',
      kind: 'war',
      place: { lon: 73.2215, lat: 34.1688, name: 'Abbottabad, Pakistan', nameZh: '巴基斯坦阿伯塔巴德' },
      title: 'Abbottabad',
      titleZh: '阿伯塔巴德',
      body:
        'Twenty-three men fly into Pakistan in secret and kill the man who planned the attacks of September 11, in a house a few hundred yards from the country\'s military academy. It ends nothing. The war that was launched with him has eleven more years to run.',
      bodyZh:
        '二十三人秘密飞入巴基斯坦，在一个离该国军事学院只有几百码的院落里，杀死了九一一袭击的策划者。这没有结束任何事——那场因他而起的战争，还有十一年要打。',
    }),
    beat({
      id: 'the-outsider',
      date: '2016-11-08',
      kind: 'politics',
      place: { lon: -73.9739, lat: 40.7624, name: 'New York, New York', nameZh: '纽约州纽约' },
      title: 'The outsider',
      titleZh: '局外人',
      body:
        'A candidate who has never held elective office wins the presidency while losing the popular vote by nearly three million, and carries states that had voted the other way for a quarter of a century. The two parties\' coalitions have been rearranging themselves around education and geography for two decades, and this is the election where it shows.',
      bodyZh:
        '一位从未担任过民选公职的候选人当选总统，同时少得近三百万张普选票，并拿下了一些过去二十五年都投向另一方的州。两党的联盟围绕受教育程度与地域重新组合已有二十年；这场选举是它显形之时。',
    }),
    beat({
      id: 'the-pandemic',
      date: '2020-03-13',
      kind: 'disaster',
      place: { lon: -77.0369, lat: 38.9072, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'The pandemic',
      titleZh: '大流行',
      body:
        'A national emergency is declared over a coronavirus that has been spreading for three months, and within two weeks about a hundred million people are under orders to stay at home. Over three years about 1.1 million people in the country die with covid, and the argument about who was responsible outlasts the emergency.',
      bodyZh:
        '一种已传播三个月的冠状病毒引发国家紧急状态；两周之内，约一亿人接到居家令。三年多里，全国约一百一十万人死于新冠；而关于责任在谁的争论，比紧急状态本身持续得更久。',
    }),
    beat({
      id: 'capitol',
      date: '2021-01-06',
      kind: 'protest',
      place: { lon: -77.0091, lat: 38.8899, name: 'Washington, D.C.', nameZh: '华盛顿特区' },
      title: 'January 6',
      titleZh: '一月六日',
      body:
        'A crowd breaks into the Capitol while Congress is counting the electoral votes, and it takes four hours to clear the building; five people die in or around it. The count is completed that night. For the first time the country does not agree on what happened in front of it, on camera, on one afternoon.',
      bodyZh:
        '国会正在清点选举人票时，一群人冲进国会大厦；清空大楼用了四小时，五人死亡。计票当夜完成。这个国家第一次无法就「那一个下午」在镜头前究竟发生了什么达成一致。',
    }),
  ],
};

/** This chapter's beats, in date order, or an empty list if it has none. */
export function beatsFor(chapter) {
  return BEATS[chapter.id] ?? [];
}

/**
 * The beat in force at a fractional year: the latest one whose date has been
 * reached, or null before the first.
 *
 * A linear scan rather than a binary search, on purpose. Nine beats is the
 * whole of it, a scan is obviously correct, and `<=` versus `<` is exactly the
 * kind of boundary this file cannot afford to get wrong: an off-by-one here
 * means a beat that never appears or one that never leaves. The direction is
 * "reached", so the beat is in force *on* its own date, not the day after.
 *
 * **Assumes `beats` is sorted by date**, which `narration.test.js` pins.
 */
export function beatAt(beats, year) {
  let found = null;
  for (const candidate of beats) {
    if (candidate.year > year) break;
    found = candidate;
  }
  return found;
}
