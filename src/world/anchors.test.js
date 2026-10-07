/**
 * The palimpsest rule, tested as arithmetic rather than as pixels.
 *
 * `visibleAnchors` is pure — a chapter, a date in, a list out — which means the
 * three rules it encodes can be pinned down without a renderer, a GPU or a
 * screenshot diff. That matters because the failure mode of a wrong anchor is
 * not a crash: it is a line on the paper that should not be there, or a line
 * missing that should be, and both are easy to mistake for art direction.
 *
 * The rules, restated here because the tests are the clearest statement of
 * them: fade by *page distance*, not by years; never show an anchor before its
 * own date; and never exceed the cap, which falls out of the fade window rather
 * than being a second rule.
 */

import { describe, expect, it } from 'vitest';

import { CHAPTERS, chapterById } from '../timeline/chapters.js';
import { ANCHOR_FADE, anchorStrength, visibleAnchors } from './anchors.js';

const ids = (list) => list.map((a) => a.id);

describe('anchor strength', () => {
  it('is full on the page that owns the anchor and zero beyond the window', () => {
    expect(anchorStrength(0)).toBe(1);
    expect(anchorStrength(ANCHOR_FADE.length)).toBe(0);
    expect(anchorStrength(ANCHOR_FADE.length + 5)).toBe(0);
  });

  it('never increases with distance, which is the whole idea of sediment', () => {
    for (let d = 1; d < ANCHOR_FADE.length; d++) {
      expect(anchorStrength(d)).toBeLessThanOrEqual(anchorStrength(d - 1));
    }
  });
});

describe('what is on the sheet', () => {
  it('shows nothing before the anchor has happened', () => {
    // Reading Chapter 2 in 1784: the Treaty of Paris has just been signed, so
    // the 1783 line is due, but the Purchase is nineteen years away.
    const found = visibleAnchors(chapterById('expansion'), 1784, 3);
    expect(ids(found)).toEqual(['treaty-1783']);
  });

  it('does not show a chapter its own anchors before their dates', () => {
    // Chapter 5 spans 1900-1941 and owns 1907 and 1912. In 1901 the sheet must
    // carry no sediment from them at all.
    const found = visibleAnchors(chapterById('boom'), 1901, 3);
    expect(ids(found)).not.toContain('oklahoma-1907');
    expect(ids(found)).not.toContain('arizona-1912');
  });

  it('counts the window in chapters, not in years', () => {
    // The 1783 line is written in Chapter 2. It is sediment in 2 and 3, and it
    // is gone by Chapter 5 — not because of how many years have passed (that
    // number is enormous and would end it immediately) but because three pages
    // have turned.
    const owner = CHAPTERS.findIndex((c) => c.anchors?.some((a) => a.id === 'treaty-1783'));
    expect(owner).toBeGreaterThanOrEqual(0);

    for (let distance = 0; distance <= ANCHOR_FADE.length; distance++) {
      const index = owner + distance;
      if (index >= CHAPTERS.length) break;
      const chapter = CHAPTERS[index];
      const found = visibleAnchors(chapter, chapter.end, 99);
      const present = ids(found).includes('treaty-1783');
      expect(present, `${distance} chapters later, in ${chapter.id}`).toBe(distance < ANCHOR_FADE.length);
    }
  });

  it('never puts more than the cap on the sheet, even where five qualify', () => {
    // Chapter 5's window admits three chapters' worth of anchors: its own two,
    // Industry's two and Division's one. Only three may be drawn, and the cap
    // is what keeps the paper legible.
    const found = visibleAnchors(chapterById('boom'), chapterById('boom').end, 3);
    expect(found).toHaveLength(3);

    for (const chapter of CHAPTERS) {
      const all = visibleAnchors(chapter, chapter.end, 3);
      expect(all.length, chapter.id).toBeLessThanOrEqual(3);
    }
  });

  it('keeps the most recent sediment when it has to drop some', () => {
    const found = visibleAnchors(chapterById('boom'), chapterById('boom').end, 3);
    for (let i = 1; i < found.length; i++) {
      expect(found[i - 1].year).toBeGreaterThanOrEqual(found[i].year);
    }
    // The secession line is the oldest of the five candidates and falls out.
    expect(ids(found)).not.toContain('secession-1861');
  });

  it('inks an anchor in over a quarter of a year rather than popping it', () => {
    const chapter = chapterById('boom');
    const justBefore = visibleAnchors(chapter, 1907.5, 3).find((a) => a.id === 'oklahoma-1907');
    const justAfter = visibleAnchors(chapter, 1907.9, 3).find((a) => a.id === 'oklahoma-1907');
    const settled = visibleAnchors(chapter, 1930, 3).find((a) => a.id === 'oklahoma-1907');

    expect(justBefore).toBeUndefined();
    expect(justAfter.strength).toBeGreaterThan(0);
    expect(justAfter.strength).toBeLessThan(settled.strength);
  });

  it('gives every built chapter a coherent set of anchors', () => {
    // A chapter may legitimately have none — Chapters 6, 7 and 8 do, because
    // nothing moved in their windows — but an anchor that exists must be dated
    // inside the chapter that owns it, or its boundary state is not in that
    // chapter's bundle and the pin would draw nothing.
    for (const chapter of CHAPTERS) {
      for (const anchor of chapter.anchors ?? []) {
        expect(anchor.id, `${chapter.id} anchor needs an id`).toBeTruthy();
        expect(anchor.label).toBeTruthy();
        expect(anchor.detail).toBeTruthy();
        const year = Number(anchor.date.slice(0, 4));
        expect(year, `${anchor.id} is dated outside ${chapter.id}`).toBeGreaterThanOrEqual(Math.floor(chapter.start));
        expect(year, `${anchor.id} is dated outside ${chapter.id}`).toBeLessThanOrEqual(Math.ceil(chapter.end));
        expect(chapter.built, `${anchor.id} belongs to unbuilt ${chapter.id}`).toBe(true);
      }
    }
  });
});
