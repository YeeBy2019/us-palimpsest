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
 * not enough for Chapters 6, 7 and 8, where it does not — no state was admitted
 * between 1912 and 1959, so those chapters draw the same coast for their whole
 * window. The README says those chapters "cannot be carried by boundary change
 * and have to be carried by something else — cities and events". This file is
 * that something else.
 *
 * The distinction that matters is not subject matter, it is **provenance**. A
 * boundary is *derived*: cut it, project it, draw it, and the atlas has said
 * something with no one's judgement in it. A story is *authored*: someone has
 * to decide that Pearl Harbor is a beat and that the Willow Run bomber plant is
 * another, and has to write the sentence. Nothing in AHCB contains the word
 * "Hiroshima". So this is a content file, and its cost is editorial, not
 * computational — which is why the pipeline never reads it and why a chapter
 * with no entry here is a chapter that has not been written yet, not one that
 * failed to build.
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
 * leaves the map, and for this chapter it mostly does.** Measured against the
 * real projection rather than assumed, **five of the nine places below are off
 * the drawing entirely** — Midway, Normandy, Iwo Jima, Hiroshima and Tokyo —
 * because the sheet is fitted to the lower forty-eight and at its scale the
 * Pacific is off the west edge and Europe off the east. Of the four that are on
 * it, three are on the sheet (Washington, Willow Run, Alamogordo) and one —
 * Pearl Harbor — is inside the Hawaii panel. `pipeline.test.js` pins that
 * split, so adding a beat to a place that is not drawn forces the question
 * instead of quietly producing a camera target pointing at nothing.
 *
 * That is not a defect to fix in this file — it is what the history does, and
 * it is the thing to solve when the camera learns to fly (M4), most likely as a
 * treatment for a place that has no coordinate on the sheet. It is also why
 * `place` is stored as a real coordinate rather than a picked point on the
 * plate: a picked point would silently lie about where Normandy is, and the lie
 * would be invisible in exactly the case where it matters.
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
 * Chapter 6. An unwritten one keeps M0's pace and no holds at all.
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
 * Only Chapter 6 so far. The others are absent rather than stubbed, and the
 * panel stays out of the way on a chapter with no entry — an empty story is
 * better than a placeholder one, for the same reason Chapter 1 ships no bundle.
 */
export const BEATS = {
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
