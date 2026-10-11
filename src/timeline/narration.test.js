/**
 * The story layer's arithmetic.
 *
 * Almost all of this is about *dates*, and the reason is that a beat has no
 * visual failure mode. A boundary drawn in the wrong place looks wrong; a beat
 * that appears a day late, or never appears, or refuses to leave, looks like a
 * panel that is simply showing something. The cursor comparison is one
 * character deep — `<=` against `<` — and it is the whole mechanism.
 */

import { describe, expect, it } from 'vitest';

import { isoToN, isoToYear, yearToIso } from '../lib/dates.js';
import { CHAPTERS } from './chapters.js';
import {
  BEATS,
  DEFAULT_PACE,
  HOLD_SECONDS,
  OPENING_HOLD_SECONDS,
  TRAVEL_SECONDS,
  beatAt,
  beatsFor,
  holdsFor,
  paceFor,
} from './narration.js';

/** Every beat in the file, paired with the chapter that owns it. */
const owned = () => Object.entries(BEATS).map(([id, beats]) => [CHAPTERS.find((c) => c.id === id), beats]);

describe('the beats', () => {
  it('are attached to chapters that exist', () => {
    for (const [chapter] of owned()) expect(chapter, 'a chapter id in BEATS has no chapter').toBeTruthy();
  });

  it('all fall inside the window of their own chapter', () => {
    // The cursor is clamped to the chapter, so a beat dated outside it can
    // never be reached — it is a paragraph that will never be read, and nothing
    // else would notice.
    for (const [chapter, beats] of owned()) {
      for (const beat of beats) {
        expect(beat.n, `${chapter.id}/${beat.id} is before the chapter opens`).toBeGreaterThanOrEqual(
          chapter.startN,
        );
        expect(beat.n, `${chapter.id}/${beat.id} is after the chapter closes`).toBeLessThanOrEqual(
          chapter.endN,
        );
      }
    }
  });

  it('are strictly ordered, because beatAt scans and stops at the first date it passes', () => {
    for (const [chapter, beats] of owned()) {
      for (let i = 1; i < beats.length; i++) {
        expect(
          beats[i].year,
          `${chapter.id}: ${beats[i].id} is not after ${beats[i - 1].id}`,
        ).toBeGreaterThan(beats[i - 1].year);
      }
    }
  });

  it('round-trip their date to the day, which is what a deep link needs', () => {
    for (const [, beats] of owned()) {
      for (const beat of beats) {
        expect(beat.year, beat.id).toBeCloseTo(isoToYear(beat.date), 12);
        expect(beat.n, beat.id).toBe(isoToN(beat.date));
        expect(yearToIso(beat.year), beat.id).toBe(beat.date);
      }
    }
  });

  it('carry every string twice, and nothing empty', () => {
    // The bilingual convention is `name` / `nameZh` throughout the project, and
    // a half-written beat is worse than an absent one: an English-only panel is
    // not obviously a mistake, so it would survive review.
    for (const [chapter, beats] of owned()) {
      for (const beat of beats) {
        for (const field of ['id', 'title', 'titleZh', 'body', 'bodyZh']) {
          expect(typeof beat[field], `${chapter.id}/${beat.id}.${field}`).toBe('string');
          expect(beat[field].trim().length, `${chapter.id}/${beat.id}.${field} is empty`).toBeGreaterThan(0);
        }
        for (const field of ['name', 'nameZh']) {
          expect(beat.place[field]?.trim().length, `${chapter.id}/${beat.id}.place.${field}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('name a real point on the earth', () => {
    for (const [, beats] of owned()) {
      for (const beat of beats) {
        const { lon, lat } = beat.place;
        expect(Number.isFinite(lon) && Number.isFinite(lat), beat.id).toBe(true);
        expect(Math.abs(lon), beat.id).toBeLessThanOrEqual(180);
        expect(Math.abs(lat), beat.id).toBeLessThanOrEqual(90);
      }
    }
  });

  it('have ids that are unique, so one beat can be addressed', () => {
    const seen = new Set();
    for (const [, beats] of owned()) {
      for (const beat of beats) {
        expect(seen.has(beat.id), `duplicate beat id: ${beat.id}`).toBe(false);
        seen.add(beat.id);
      }
    }
  });
});

describe('beatAt', () => {
  const beats = BEATS.wwii;

  it('is null before the first beat has been reached', () => {
    expect(beatAt(beats, 1900)).toBeNull();
    expect(beatAt(beats, beats[0].year - 0.001)).toBeNull();
  });

  it('is in force on its own date, not the day after', () => {
    // The off-by-one that matters. `<=` is the whole of the mechanism, and it is
    // also what makes a beat dated on its chapter's opening day — which the
    // first one is — present on the very first frame rather than a moment later.
    for (const beat of beats) expect(beatAt(beats, beat.year)).toBe(beat);
  });

  it('holds the previous beat in the gap before the next one', () => {
    for (let i = 1; i < beats.length; i++) {
      expect(beatAt(beats, beats[i].year - 0.001)).toBe(beats[i - 1]);
    }
  });

  it('holds the last beat past the end of the chapter', () => {
    expect(beatAt(beats, 2100)).toBe(beats[beats.length - 1]);
  });

  it('has nothing to say about a chapter it does not know', () => {
    // Every chapter is written as of 2026-10-10, so the only way to reach the
    // empty branch is an id that names no chapter. It still has to be exercised:
    // `beatsFor` is called with whatever the UI hands it, and an unknown id must
    // produce an empty story rather than a crash.
    expect(beatAt([], 1950)).toBeNull();
    expect(beatsFor({ id: 'no-such-chapter' })).toEqual([]);
  });
});

describe('paceFor', () => {
  it('leaves an unwritten chapter playing at the M0 rate', () => {
    expect(paceFor([])).toBe(DEFAULT_PACE);
  });

  it('gives a written chapter a walk that does not depend on when the history happened', () => {
    // The point of separating travel from holds, and the thing a single pace
    // cannot do. Sampled on a real play-through, the first version gave one beat
    // six seconds and a later one twenty-seven, because the reading time was the
    // gap between the dates. This is not a function of how many beats there are
    // or how far apart they fall.
    expect(paceFor(BEATS.wwii)).toBeCloseTo(1 / TRAVEL_SECONDS, 12);
    expect(paceFor(BEATS.wwii)).toBe(paceFor(BEATS.wwii.slice(0, 2)));
  });

  it('takes travel plus one hold per beat to play a written chapter', () => {
    const beats = BEATS.wwii;
    const seconds = 1 / paceFor(beats) + beats.length * HOLD_SECONDS;
    expect(seconds).toBeCloseTo(TRAVEL_SECONDS + beats.length * HOLD_SECONDS, 9);
    // Eighteen seconds was what M0's rate gave it, which is a slideshow.
    expect(seconds).toBeGreaterThan(120);
  });

  it('agrees with the state machine about the pace of an unwritten chapter', async () => {
    // Two numbers with one meaning. The state machine owns its own default and
    // the story layer owns the rate it imposes on a chapter that has been
    // written; they are equal deliberately, not incidentally, and this is what
    // stops them drifting into disagreeing about a chapter nobody has written
    // yet. Imported here rather than at the head of the file because
    // `env/chapter.js` pulls in the uniforms and with them three.js, and a
    // content module has no business doing that for the sake of one assertion.
    const { ChapterState } = await import('../env/chapter.js');
    expect(paceFor([])).toBe(new ChapterState(CHAPTERS[0]).pace);
  });
});

describe('holdsFor', () => {
  it('hands over the beat dates in order, which is all the state machine needs', () => {
    const holds = holdsFor(BEATS.wwii);
    expect(holds).toEqual(BEATS.wwii.map((beat) => beat.year));
    for (let i = 1; i < holds.length; i++) expect(holds[i]).toBeGreaterThan(holds[i - 1]);
  });

  it('has nothing to stand on in a chapter that has not been written', () => {
    expect(holdsFor([])).toEqual([]);
  });
});

describe('the arrival hold', () => {
  it('is shorter than a reading hold and longer than nothing', () => {
    // A chapter's opening beat is the one beat the chapter card announces, so it
    // is held for the length of that card rather than for the time it takes to
    // read. Both bounds are statements: equal to `HOLD_SECONDS` would be the old
    // behaviour with a new name, and zero would walk past the chapter's own
    // opening before anyone could read it.
    expect(OPENING_HOLD_SECONDS).toBeGreaterThan(0);
    expect(OPENING_HOLD_SECONDS).toBeLessThan(HOLD_SECONDS);
  });

  it('lasts at least as long as the card that announces it', async () => {
    // Imported here rather than at the head of the file for the reason given
    // under `paceFor` above: `env/chapter.js` drags in the uniforms and three.js,
    // and a content module that only needs the number has no business doing that.
    //
    // The requirement is real rather than tidy. The card inks over the sheet for
    // `disperse + reform` and then holds for another 0.4 s; an arrival hold
    // shorter than that would walk the cursor off the chapter's opening beat
    // while the card announcing it was still on screen.
    const { TRANSITION } = await import('../env/chapter.js');
    const onScreen = TRANSITION.disperse + TRANSITION.reform + 0.4;
    expect(OPENING_HOLD_SECONDS).toBeGreaterThanOrEqual(onScreen);
  });

  it('has a chapter that actually opens on one of its beats', () => {
    // The hold's shortest day. It was written for Chapter 1, whose first beat is
    // dated the day the chapter opens — so the film used to begin on twelve
    // seconds of a near-empty plate that could not change, and it was reported as
    // the film having stopped. If no chapter opened on a beat, this constant
    // would be set on every chapter and consulted on none.
    const opensOnABeat = CHAPTERS.filter((chapter) =>
      BEATS[chapter.id]?.some((beat) => Math.abs(beat.year - chapter.start) < 1e-6),
    );
    expect(opensOnABeat.map((chapter) => chapter.id)).toContain('founding');
  });
});
