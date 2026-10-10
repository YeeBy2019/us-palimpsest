/**
 * The order the atlas plays in.
 *
 * The atlas starts itself and runs from 1607 to the present without being
 * driven, so "what comes after this chapter" is no longer a question only a
 * person clicking the selector asks — it is asked by the frame loop, every time
 * a chapter runs out, seven times a play-through. That makes it worth pinning
 * for a reason the selector never had: nobody is watching when it is wrong. A
 * film that stops early looks like a film that ended, and a film that travels to
 * a chapter with no bundle comes out of the dispersal over a blank plate that
 * `main.js` will not complain about, because a missing sibling is deliberately
 * survivable there.
 *
 * `nextChapter` and `nextBuiltChapter` answer different questions and today give
 * the same answer for all eight chapters. The test below is written to hold when
 * that stops being true, which is the point of having both.
 */

import { describe, expect, it } from 'vitest';

import { BUILT_CHAPTERS, CHAPTERS, nextBuiltChapter } from './chapters.js';

describe('the order the film plays in', () => {
  it('reaches every chapter and then stops', () => {
    // The whole film, walked the way the frame loop walks it.
    const visited = [];
    for (let chapter = BUILT_CHAPTERS[0]; chapter; chapter = nextBuiltChapter(chapter)) {
      visited.push(chapter);
      if (visited.length > CHAPTERS.length + 1) break;
    }

    expect(visited).toEqual(BUILT_CHAPTERS);
  });

  it('never hands the film a chapter it cannot draw', () => {
    // Vacuous while all eight are built, and deliberately so: it is written
    // against the invariant rather than against a case, because the failure it
    // describes is one the atlas would not report. The day a chapter is
    // scaffolded with `built: false`, this is what says the film went round it.
    for (const chapter of BUILT_CHAPTERS) {
      const next = nextBuiltChapter(chapter);
      if (!next) continue;
      expect(next.built, `${chapter.id} would hand the film to an unbuilt ${next.id}`).toBe(true);
    }
  });

  it('stops at the last chapter rather than wrapping round', () => {
    expect(nextBuiltChapter(BUILT_CHAPTERS[BUILT_CHAPTERS.length - 1])).toBeNull();
  });

  it('answers null for something that is not a built chapter', () => {
    // `indexOf` on an object that is not in the list is -1, and `-1 + 1` is a
    // perfectly valid index — so the guard is not decoration. Getting it wrong
    // would hand the film the *first* chapter, and an atlas that quietly loops
    // back to 1607 at the end of the present is a bug nobody would look for.
    expect(nextBuiltChapter({ id: 'not-a-chapter', index: 99 })).toBeNull();
    expect(nextBuiltChapter(null)).toBeNull();
  });
});
