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
