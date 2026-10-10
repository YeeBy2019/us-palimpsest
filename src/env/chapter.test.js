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
