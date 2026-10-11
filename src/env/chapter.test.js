/**
 * Which two chapters are on the sheet, and when.
 *
 * The renderer can only ask the state one question — "is this layer being read
 * right now?" — so the state has to be able to answer it correctly for *any*
 * number of loaded chapters. Getting this wrong is invisible in a two-chapter
 * atlas, because there "all of them" and "the two that matter" are the same
 * set; at seven the difference is six extra plates of ink.
 *
 * The transition timeline is driven by GSAP and cannot be ticked deterministically
 * here, so these tests cover the parts that are synchronous — which is where the
 * bug would actually live. A stale `partner` left behind by a killed transition
 * is not a timing subtlety: it is a second map that never goes away.
 */

import { describe, expect, it } from 'vitest';

import { ChapterState } from './chapter.js';
import { chapterById } from '../timeline/chapters.js';

const expansion = chapterById('expansion');
const division = chapterById('division');
const millennium = chapterById('millennium');
const wwii = chapterById('wwii');

describe('the two chapters in flight', () => {
  it('starts with nothing in flight', () => {
    const state = new ChapterState(expansion);
    expect(state.chapter).toBe(expansion);
    expect(state.partner).toBeNull();
    expect(state.isTransitioning).toBe(false);
  });

  it('names the arriving chapter as the partner while the old one is still being read', () => {
    const state = new ChapterState(expansion);
    state.goTo(division);
    // The identity has not moved yet — that happens under cover of the
    // dispersal — so `chapter` is still the origin and `partner` is the
    // destination. Both are on the sheet, and these are the only two.
    expect(state.chapter).toBe(expansion);
    expect(state.partner).toBe(division);
    expect(state.isTransitioning).toBe(true);
  });

  it('does not leave a stale partner behind when a transition is cut short', () => {
    const state = new ChapterState(expansion);
    state.goTo(division);
    expect(state.partner).toBe(division);

    // A deep link arriving mid-transition, or a jump to a third chapter.
    state.snap(millennium);

    expect(state.partner).toBeNull();
    expect(state.chapter).toBe(millennium);
    expect(state.isTransitioning).toBe(false);
  });

  it('clears the partner when a jump interrupts an interrupted transition', () => {
    const state = new ChapterState(expansion);
    state.goTo(division);
    state.goTo(millennium);
    // Re-aimed, not stacked: still exactly one partner, and it is the new one.
    expect(state.partner).toBe(millennium);
    state.snap(expansion);
    expect(state.partner).toBeNull();
  });

  it('leaves the partner alone when goTo is a no-op', () => {
    const state = new ChapterState(expansion);
    // Same chapter, no year: nothing to do, and nothing should be disturbed.
    state.goTo(expansion);
    expect(state.partner).toBeNull();
    expect(state.isTransitioning).toBe(false);
  });
});

/**
 * Standing on a beat while playing.
 *
 * A hold is the difference between a play-through and a scrub: the cursor lands
 * on a date and stays there for as long as it takes to read, however far the
 * next date is. The transition timeline is GSAP's and cannot be ticked here, but
 * `update` is plain arithmetic, so the mechanism is directly testable — and it
 * needs to be, because every failure mode it has is silent. A hold that never
 * releases freezes the atlas; a hold that never triggers is only visible if you
 * sit and watch two minutes of playback.
 */
describe('standing on a beat', () => {
  const playing = (holds, holdSeconds) => {
    const state = new ChapterState(wwii);
    state.holds = holds;
    state.holdSeconds = holdSeconds;
    state.play();
    return state;
  };

  it('stops on the chapter opening beat rather than travelling past it', () => {
    // The case a strict comparison gets wrong: Chapter 6's first beat is dated
    // the day the chapter opens, so on the very first tick `from` and the hold
    // are the same number.
    const state = playing([wwii.start], 10);
    state.update(1, 0);

    expect(state.date).toBe(wwii.start);
    expect(state.heldAt).toBe(wwii.start);
    // The full hold: this is the frame it starts, not a frame of it spent.
    expect(state.dwell).toBeCloseTo(10, 6);
  });

  it('stands still for the whole hold and then lands exactly on the next beat', () => {
    const first = wwii.start;
    const second = first + 0.1; // inside a single tick's travel
    const state = playing([first, second], 3);

    // The frame it lands on: the hold begins.
    state.update(1, 0);
    expect(state.date).toBe(first);
    expect(state.dwell).toBeCloseTo(3, 6);

    state.update(1, 1);
    state.update(1, 2);
    state.update(1, 3);
    // Three seconds in, the cursor has not moved a day.
    expect(state.date).toBe(first);

    // The fourth second is travel, because a frame that ends a hold is not
    // wasted — what is left of it goes into walking.
    state.update(1, 4);
    // Exactly on it, not near it: a beat is a day, and a card that appears a
    // week early is a card about the wrong thing.
    expect(state.date).toBe(second);
    expect(state.heldAt).toBe(second);
  });

  it('lands on a distant beat without overshooting, however large the step', () => {
    const far = wwii.start + 3;
    const state = playing([far], 5);
    // A twenty-second frame, so the step is larger than the remaining distance.
    // A cursor that moved by `step` would sail straight past the beat.
    state.update(20, 0);
    expect(state.date).toBe(far);
  });

  it('releases a hold instead of standing on it forever', () => {
    // The failure this guards is a frozen atlas, and it is the reason `heldAt`
    // exists at all: without it the cursor arrives, stands, and finds the same
    // hold again on the next tick.
    const only = wwii.start + 1;
    const state = playing([only], 2);
    for (let i = 0; i < 60; i++) state.update(1, i);
    expect(state.date).toBeGreaterThan(only);
  });

  it('gives its last beat a hold even though that beat closes the chapter', () => {
    // Chapter 6's last beat is dated 1945-08-15, which is also the day the
    // chapter ends. The play-through has to stand there and then stop, rather
    // than ending the moment the date reaches the last beat.
    const state = playing([wwii.end], 4);
    let ticks = 0;
    while (state.playing && ticks < 400) state.update(1, ticks++);

    expect(state.date).toBe(wwii.end);
    expect(state.playing).toBe(false);
    // Four seconds of hold, plus the travel to get there, and not one tick more
    // than the chapter needs.
    expect(ticks).toBeGreaterThan(4);
  });

  it('stops at the end of the chapter when there are no holds to stand on', () => {
    const state = playing([], 0);
    let ticks = 0;
    while (state.playing && ticks < 400) state.update(1, ticks++);

    expect(state.date).toBe(wwii.end);
    expect(state.playing).toBe(false);
  });

  it('abandons a hold when the viewer takes the timeline', () => {
    const state = playing([wwii.start], 10);
    state.update(1, 0);
    expect(state.dwell).toBeGreaterThan(0);

    state.snapDate(wwii.start + 1);
    expect(state.dwell).toBe(0);
    expect(state.date).toBeCloseTo(wwii.start + 1, 9);
  });

  it('forgets the holds of the chapter it is leaving', () => {
    // Carried over, a stale `heldAt` would stop the arriving chapter from ever
    // standing on a beat with the same date — and chapters share dates, since a
    // chapter opens where the last one closed.
    const state = playing([wwii.start], 10);
    state.update(1, 0);
    expect(state.heldAt).toBe(wwii.start);

    state.snap(division);
    expect(state.heldAt).toBeNull();
    expect(state.dwell).toBe(0);
  });
});

/**
 * When a beat is an arrival rather than a stop.
 *
 * The chapter's opening beat is the one beat the chapter card announces, so it
 * is held for the length of that card and the reading time is kept for the beats
 * that are news. Chapter 1 used to open on twelve seconds of a still,
 * near-empty plate because of it — the first thing anyone saw of this atlas, and
 * reported as the film having stopped.
 *
 * `openingHoldSeconds` is not consulted for any other beat, and its default is
 * the reading time rather than zero, which is what the tests above are written
 * against: unset means "play the way you always did".
 */
describe('holding a chapter’s arrival for less than its reading time', () => {
  const arriving = (holds, holdSeconds, openingHoldSeconds) => {
    const state = new ChapterState(wwii);
    state.holds = holds;
    state.holdSeconds = holdSeconds;
    state.openingHoldSeconds = openingHoldSeconds;
    state.play();
    return state;
  };

  it('stands on the opening beat for the length of the chapter card', () => {
    const state = arriving([wwii.start], 12, 3);
    state.update(1, 0);

    // Still landed on exactly, and still a hold — the opening beat is not
    // skipped, it is held for as long as the thing announcing it.
    expect(state.date).toBe(wwii.start);
    expect(state.heldAt).toBe(wwii.start);
    expect(state.dwell).toBeCloseTo(3, 6);
  });

  it('gives every later beat the full reading time', () => {
    const state = arriving([wwii.start + 0.1], 12, 3);
    state.update(1, 0);

    expect(state.date).toBe(wwii.start + 0.1);
    expect(state.dwell).toBeCloseTo(12, 6);
  });

  it('walks straight on when the opening hold is nothing', () => {
    // The knob at its limit, and the reason the fallback is nullish rather than
    // `||`: zero is a real answer here, not an absent one.
    const state = arriving([wwii.start], 12, 0);
    state.update(1, 0);
    expect(state.dwell).toBe(0);

    state.update(1, 1);
    expect(state.date).toBeGreaterThan(wwii.start);
  });

  it('reads the reading time when nobody has said otherwise', () => {
    const state = arriving([wwii.start], 12, null);
    state.update(1, 0);

    expect(state.dwell).toBeCloseTo(12, 6);
  });
});

/**
 * The hold as a fraction, which is what the dock draws.
 *
 * The picture cannot show a hold — the sheet, the stamp and the timeline are all
 * legitimately still for the length of one, and the film spends about nine
 * tenths of its running time in one — so the dock draws it, and this is the
 * number it draws with. It has to be measured against the length of *this* hold:
 * against `holdSeconds`, a three-second arrival hold would begin a quarter
 * spent, and a countdown that starts part-drained reads as a rendering fault.
 */
describe('how much of the hold is left', () => {
  const holding = (holds, holdSeconds) => {
    const state = new ChapterState(wwii);
    state.holds = holds;
    state.holdSeconds = holdSeconds;
    state.play();
    return state;
  };

  it('is one when the hold begins and falls as it is spent', () => {
    const state = holding([wwii.start + 0.1], 4);

    state.update(1, 0);
    expect(state.dwellLeft).toBeCloseTo(1, 6);

    state.update(2, 1);
    expect(state.dwellLeft).toBeCloseTo(0.5, 6);

    state.update(2, 2);
    expect(state.dwellLeft).toBe(0);
  });

  it('is nothing while the cursor is travelling', () => {
    const state = holding([wwii.start + 20], 4);
    state.update(1, 0);

    expect(state.dwell).toBe(0);
    expect(state.dwellLeft).toBe(0);
  });

  it('measures an arrival hold against its own length, not the reading time', () => {
    const state = new ChapterState(wwii);
    state.holds = [wwii.start];
    state.holdSeconds = 12;
    state.openingHoldSeconds = 3;
    state.play();

    state.update(0.001, 0);
    expect(state.dwellLeft).toBeCloseTo(1, 6);

    state.update(1.5, 1);
    expect(state.dwellLeft).toBeCloseTo(0.5, 6);
  });
});

/**
 * Handing the film on.
 *
 * A chapter's end used to be a terminus: a play-through ran the chapter out and
 * stopped, and the viewer started the next one by hand. With one written chapter
 * that was right — there was nowhere to go. With eight it is a film that halts
 * seven times, so the end of a chapter is a hand-off: the cursor rolls into the
 * next one and `playing` survives the dispersal.
 *
 * `nextChapter` is a function the state machine is given, not a list it knows,
 * and every test above this one leaves it unset. That is deliberate and it is
 * the reason they still pass: unset means "a chapter is the whole of it", which
 * is what the atlas did before there was a film.
 */
describe('handing the film on', () => {
  /** A state playing `chapter`, told the order it is part of. */
  const film = (chapter, order) => {
    const state = new ChapterState(chapter);
    state.holds = [];
    state.holdSeconds = 0;
    state.nextChapter = (current) => order[order.indexOf(current) + 1] ?? null;
    state.openingChapter = order[0];
    state.play();
    return state;
  };

  it('rolls into the next chapter instead of stopping at the end', () => {
    const state = film(wwii, [expansion, wwii, division]);
    let ticks = 0;
    while (!state.isTransitioning && ticks < 400) state.update(1, ticks++);

    expect(state.partner).toBe(division);
    // The whole point: a chapter change the viewer did not ask for is not a
    // reason to stop watching, and `goTo` no longer pauses on its own.
    expect(state.playing).toBe(true);
  });

  it('stops at the end of the last chapter', () => {
    const state = film(division, [expansion, wwii, division]);
    let ticks = 0;
    while (state.playing && ticks < 400) state.update(1, ticks++);

    expect(state.playing).toBe(false);
    expect(state.partner).toBeNull();
    expect(state.date).toBe(division.end);
  });

  it('asks where to go once per chapter, not once per frame', () => {
    // Without the guard on `isTransitioning` this would be one call per frame
    // for the length of the dispersal — each one re-aiming the transition that
    // is already running, which is a chapter that never arrives.
    let asked = 0;
    const state = film(wwii, [expansion, wwii, division]);
    state.nextChapter = () => {
      asked++;
      return division;
    };

    for (let i = 0; i < 200; i++) state.update(1, i);

    expect(asked).toBe(1);
    expect(state.partner).toBe(division);
  });

  it('does not end the chapter while a beat is still being held', () => {
    // The last card. A chapter whose last beat is dated the day it closes is
    // parked at its end the moment it lands on that beat, so a hand-off that
    // ignored the dwell would cut the final beat off every chapter written to
    // end on its subject — and Chapter 6 ends on 1945-08-15.
    const state = film(wwii, [wwii, division]);
    state.holds = [wwii.end];
    state.holdSeconds = 4;

    state.update(60, 0);

    expect(state.date).toBe(wwii.end);
    expect(state.dwell).toBeCloseTo(4, 6);
    expect(state.isTransitioning).toBe(false);
    expect(state.playing).toBe(true);
  });

  it('carries the film on when Play is pressed on a chapter that has run out', () => {
    // A viewer who paused on the last frame and presses Play means "go on", not
    // "sit there" — and not "start this chapter again", which is what Restart is
    // for.
    const state = film(wwii, [wwii, division]);
    state.pause();
    state.snapDate(wwii.end);
    expect(state.playing).toBe(false);
    expect(state.isTransitioning).toBe(false);

    state.toggle();

    expect(state.partner).toBe(division);
    expect(state.playing).toBe(true);
  });

  it('starts the film again when Play is pressed on a finished one', () => {
    const state = film(division, [expansion, division]);
    state.pause();
    state.snapDate(division.end);

    state.toggle();

    // The unit that stopped was the run, not the chapter, so the answer is the
    // opening rather than a dead button.
    expect(state.partner).toBe(expansion);
    expect(state.playing).toBe(true);
  });

  it('does not re-aim a dispersal that is already running', () => {
    let asked = 0;
    const state = film(wwii, [wwii, division]);
    state.nextChapter = () => {
      asked++;
      return division;
    };

    state.pause();
    // Parked on the last frame *and* a chapter change already in flight, which
    // is the only state in which this guard is the thing being tested: the
    // cursor is at the end of a chapter, and the chapter it is going to is
    // already on its way.
    state.snapDate(wwii.end);
    state.goTo(division);
    expect(state.isTransitioning).toBe(true);

    state.toggle();

    // Asking again would kill the transition and build the same one over the top
    // of it, so the dispersal would restart from zero every time — a chapter
    // that never arrives.
    expect(asked).toBe(0);
    expect(state.playing).toBe(true);
    expect(state.partner).toBe(division);
  });

  it('stops rather than rolling when nothing has said what follows', () => {
    const state = new ChapterState(division);
    state.snapDate(division.end);

    state.toggle();

    // Nowhere to go and no opening to return to. A `ChapterState` on its own
    // ends its chapters, which is the behaviour every other test in this file
    // is written against.
    expect(state.playing).toBe(true);
    state.update(1, 0);
    expect(state.playing).toBe(false);
    expect(state.partner).toBeNull();
  });
});
