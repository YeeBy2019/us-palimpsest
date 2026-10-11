/**
 * Whether the atlas starts playing on its own, what its URL says, and what it
 * says while it is standing still on purpose.
 *
 * These are the smallest functions in the project with the largest blast
 * radius. The first is the difference between a page that shows you a film and a
 * page that shows you a still picture of 1607, and it is decided *before*
 * anything is on screen — so there is no way to notice it is wrong by looking at
 * the result: a film that did not start looks exactly like a film that has been
 * paused. The second decides what a reload and a pasted link do, which is the
 * only state the atlas has that can be handed to anyone else.
 *
 * All of them take their inputs as arguments precisely so they can be tested
 * here. `parseDeepLink` beside them in the same module cannot be, because its
 * input is `location`.
 */

import { describe, expect, it } from 'vitest';

import { isoToYear } from '../lib/dates.js';
import { dwellNote, permalinkFor, shouldAutoplay, stillReason } from './ui.js';

/** What `parseDeepLink` returns, as far as playback cares. */
const link = (over = {}) => ({ year: null, still: false, ...over });

describe('whether the atlas plays itself', () => {
  it('plays on a plain visit', () => {
    expect(shouldAutoplay(link())).toBe(true);
  });

  it('plays a link that names a chapter, because a chapter is a scene', () => {
    // `?chapter=division` says where to open, not what to hold still — and the
    // seven chapters after it are exactly what someone sharing that link wants
    // shown.
    expect(shouldAutoplay(link({ chapterId: 'division' }))).toBe(true);
  });

  it('plays a link that names a date, because a date is where to open', () => {
    // This is the first reversal, and the assertion is worth its length. The
    // rule used to be the opposite — a dated link held still, so a shot pasted
    // into a message would not walk away from the frame it was sent for. But the
    // page *writes its own URL*, so within a second of arriving an ordinary
    // visitor's address bar held a date, and every reload, every restored tab
    // and every bookmark of a page they had just watched was silently a still
    // frame. Autoplay had become a once-ever event.
    expect(shouldAutoplay(link({ year: 1861.28 }))).toBe(true);
    expect(shouldAutoplay(link({ chapterId: 'division', year: 1861.28 }))).toBe(true);
  });

  it('reads a date of zero as a date rather than as absence', () => {
    // Not reachable from a real chapter, and that is not the point. The rule is
    // `year === null` and never a truthiness test, because the difference
    // between the two is a class of bug that only shows up on a value nobody
    // expected. Kept here even though the decision no longer reads `year`, since
    // `main.js` still decides whether to snap with `link.year !== null`.
    expect(shouldAutoplay(link({ year: 0 }))).toBe(true);
  });

  it('does not play when the link asks for a still', () => {
    expect(shouldAutoplay(link({ still: true }))).toBe(false);
    expect(shouldAutoplay(link({ still: true, chapterId: 'wwii' }))).toBe(false);
    // And `?still` beats a date as well, since it is the only thing left that
    // means "do not move".
    expect(shouldAutoplay(link({ still: true, year: 1861.28 }))).toBe(false);
  });

  it('is a function of the link alone, whatever else it is handed', () => {
    // The guard for the second reversal (2026-10-11). This used to take
    // `reducedMotion` as a second argument and return false whenever it was set,
    // so the film did not start on any machine whose operating system has
    // animations switched off — an old laptop tuned for speed, a corporate
    // image, a remote session, far more often than anyone with a vestibular
    // disorder — and said so only in one line of small print. The setting is now
    // read as *milder*, which is what `ui.css` already did with it; what it
    // takes away is the pointer parallax, in `main.js`.
    //
    // Behavioural first, and that is the part that matters: the natural
    // reintroduction is `(link, reducedMotion = false)`, whose `.length` is
    // **1** — a defaulted parameter is not counted — so an arity assertion on
    // its own would stay green with the gate back in place. This cannot: the
    // answer to the same link may not change because a second argument arrived.
    for (const still of [false, true]) {
      const subject = link({ still });
      expect(shouldAutoplay(subject, true)).toBe(shouldAutoplay(subject));
      expect(stillReason(subject, true)).toBe(stillReason(subject));
    }

    // And neither can be written the un-defaulted way at all.
    expect(shouldAutoplay).toHaveLength(1);
    expect(stillReason).toHaveLength(1);
  });
});

describe('what the page says when it is not moving', () => {
  it('says nothing when the film is about to start', () => {
    expect(stillReason(link())).toBeNull();
    expect(stillReason(link({ chapterId: 'founding', year: 1607.36 }))).toBeNull();
  });

  it('names the link as the reason, in the only line it can produce', () => {
    // The reason is invisible in the picture, so the only place to put it is on
    // the page: a still held on purpose and a still that looks broken are the
    // same frame otherwise.
    expect(stillReason(link({ still: true }))).toMatch(/still/i);

    // And there is exactly one reason now. The viewer's motion setting used to
    // be a second, *preferred* one — "Reduced motion — press Play to start" —
    // and it is gone with the gate it explained. A cause that no longer causes
    // anything is worse than no line at all, which is why this checks the whole
    // input space rather than the one case: a reason that reappears here without
    // a gate behind it is a page lying about why it is not moving.
    const lines = [false, true].map((still) => stillReason(link({ still }))).filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/link/i);
  });

  it('never says a reason while still claiming it will play', () => {
    // The line and the decision are separate functions, so they could drift.
    // This is the assertion that they cannot: a reason for holding still is
    // present exactly when the film is not going to start.
    for (const still of [false, true]) {
      const subject = link({ still });
      expect(Boolean(stillReason(subject))).toBe(!shouldAutoplay(subject));
    }
  });
});

describe('what the URL records', () => {
  const DATE = '1607-05-14';

  it('records the day while the cursor is held', () => {
    // A permalink is a still frame, and `date=` is the part that pins it. To the
    // day and not to the month: month precision made the link lossy, so a reload
    // could land up to a month early.
    expect(permalinkFor('/atlas/', { chapterId: 'founding', date: isoToYear(DATE), playing: false }))
      .toBe(`/atlas/?chapter=founding&date=${DATE}`);
  });

  it('records only the chapter while the film is running', () => {
    // Two reasons at once, and this is the assertion for both.
    //
    // A reload of a moving picture has always meant "start the reel again", so
    // there is no day to pin and `?chapter=` alone says exactly that. And the
    // cursor crosses a day in well under a millisecond, so writing the day on
    // every frame meant four `replaceState` calls a second for twenty-four
    // minutes — Safari throws after a hundred in thirty seconds, and because
    // this runs inside the frame loop the first throw takes the page with it.
    // A chapter change is the only thing that moves it now, which is eight
    // writes for the whole run.
    const url = permalinkFor('/atlas/', { chapterId: 'founding', date: isoToYear(DATE), playing: true });
    expect(url).toBe('/atlas/?chapter=founding');
    expect(url).not.toContain('date');
  });

  it('keeps the day it was given when the film stops, so a pause is shareable', () => {
    const held = permalinkFor('/atlas/', { chapterId: 'wwii', date: isoToYear('1944-06-06'), playing: false });
    expect(held).toBe('/atlas/?chapter=wwii&date=1944-06-06');
  });

  it('carries ?still through, so a still link stays a still link', () => {
    // The writer rewrites the URL as the cursor moves, which means it is also
    // what a viewer copies out of the address bar. Normalizing `still` away
    // would hand the next person a page that starts moving — the same surprise
    // as the one the date rule caused, one step further along. `anchor`, `tier`
    // and `intro` are still dropped, because those change how a moment is drawn
    // rather than what the page does.
    const still = permalinkFor('/atlas/', {
      chapterId: 'wwii',
      date: isoToYear('1944-06-06'),
      playing: false,
      still: true,
    });
    expect(still).toBe('/atlas/?chapter=wwii&still&date=1944-06-06');
    expect(stillReason({ year: isoToYear('1944-06-06'), still: true })).not.toBeNull();
  });

  it('drops the day from a still link while the film runs', () => {
    // A viewer who presses Play on a held page has asked to watch it; the URL
    // follows the film, and the still is still what a reload returns to.
    expect(permalinkFor('/atlas/', { chapterId: 'wwii', date: 1944.4, playing: true, still: true }))
      .toBe('/atlas/?chapter=wwii&still');
  });
});

describe('what the page says while it is standing on a beat', () => {
  it('says nothing while the cursor is travelling', () => {
    // The note and the fill under the timeline are the dock's two halves of one
    // answer — *is this page alive* — and the answer only exists during a hold.
    // Zero is the travelling case, and it is also what a chapter with no written
    // beats reports for its whole length.
    expect(dwellNote(0)).toBe('');
    expect(dwellNote(-1)).toBe('');
  });

  it('counts the hold down in whole seconds, rounding up', () => {
    // `Math.ceil`, so the line reaches "1s" and only then does the cursor move.
    // "0s" on a cursor that has not moved yet is a worse lie than no line, which
    // is the same argument `stillReason` is written with.
    expect(dwellNote(12)).toContain('12s');
    expect(dwellNote(2.5)).toContain('3s');
    expect(dwellNote(0.4)).toContain('1s');
  });

  it('keeps its width while it counts, so the dock does not twitch', () => {
    // Padded to two digits with a non-breaking space and set in the monospace
    // face, so twelve seconds and nine are the same number of characters. Without
    // it the whole line shifted sideways as it passed ten, once per beat —
    // subtle, and exactly the class of flicker that reads as a fault.
    const width = (seconds) => [...dwellNote(seconds)].length;
    expect(width(12)).toBe(width(9));
    expect(width(3)).toBe(width(12));
  });

  it('exists exactly while there is a hold left to run', () => {
    // The invariant `stillReason` is held to, and for the same reason: the line
    // and the state it describes are separate, so they could drift. Here the
    // state is whether the dock has a hold to draw at all.
    for (const seconds of [0, 0.001, 1, 3, 12]) {
      expect(Boolean(dwellNote(seconds))).toBe(seconds > 0);
    }
  });
});
