/**
 * Whether the atlas starts playing on its own.
 *
 * It does, and that makes this the smallest function in the project with the
 * largest blast radius: it is the difference between a page that shows you a
 * film and a page that shows you a still picture of 1607. It is also the one
 * decision in the atlas that is made *before* anything is on screen, which means
 * there is no way to notice it is wrong by looking at the result — a film that
 * did not start looks exactly like a film that has been paused.
 *
 * `shouldAutoplay` takes its two inputs as arguments precisely so it can be
 * tested here. `parseDeepLink` beside it in the same module cannot be, because
 * its input is `location`.
 */

import { describe, expect, it } from 'vitest';

import { shouldAutoplay } from './ui.js';

/** What `parseDeepLink` returns for a given URL, as far as playback cares. */
const link = (over = {}) => ({ year: null, still: false, ...over });

describe('whether the atlas plays itself', () => {
  it('plays on a plain visit', () => {
    expect(shouldAutoplay(link(), false)).toBe(true);
  });

  it('plays a link that names a chapter, because a chapter is a scene', () => {
    // `?chapter=division` says where to open, not what to hold still — and the
    // seven chapters after it are exactly what someone sharing that link wants
    // shown.
    expect(shouldAutoplay(link({ chapterId: 'division' }), false)).toBe(true);
  });

  it('does not play a link that names a date', () => {
    // The deep link exists so a shot can be pasted into a message and land on
    // that shot. Playing it would carry the reader off the frame they were sent
    // to look at within twelve seconds — and the URL is rewritten as the cursor
    // moves, so every reload mid-film lands here and holds still. That is the
    // contract: the URL records where the cursor is, not whether it was moving.
    expect(shouldAutoplay(link({ year: 1861.28 }), false)).toBe(false);
  });

  it('does not play a dated link that also names a chapter', () => {
    // The case the M0 acceptance link is: the atlas opens on the exact shot it
    // was judged by, and stays there.
    expect(shouldAutoplay(link({ chapterId: 'division', year: 1861.28 }), false)).toBe(false);
  });

  it('does not play when the link asks for a still', () => {
    expect(shouldAutoplay(link({ still: true }), false)).toBe(false);
    expect(shouldAutoplay(link({ still: true, chapterId: 'wwii' }), false)).toBe(false);
  });

  it('does not play when the viewer has asked for less motion, whatever the link says', () => {
    // The setting is the viewer's and the link is the sender's, so the viewer
    // wins. `?still` is included because the two reasons are independent: this
    // asserts the setting on its own, not its effect on a link that was already
    // going to hold still.
    expect(shouldAutoplay(link(), true)).toBe(false);
    expect(shouldAutoplay(link({ chapterId: 'founding' }), true)).toBe(false);
  });

  it('reads a date of zero as a date', () => {
    // Not reachable from a real chapter, and that is not the point: the check is
    // `year === null` rather than a truthiness test, and the difference between
    // the two is a class of bug that only shows up on a value nobody expected.
    // Written against `parseDeepLink`'s contract, which returns null or a
    // number and never a falsy number by accident.
    expect(shouldAutoplay(link({ year: 0 }), false)).toBe(false);
  });
});
