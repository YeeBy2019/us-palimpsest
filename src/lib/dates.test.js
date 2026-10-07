/**
 * The two date forms, and the round trip between them.
 *
 * The round trip has a test because it broke in production: the deep link was
 * written at month precision and read at day precision, so the atlas handed out
 * links it could not read back and a reload silently moved the date. Nothing
 * crashed and nothing looked wrong — the stamp just said the wrong day.
 */

import { describe, expect, it } from 'vitest';

import { isoToN, isoToYear, nToIso, nToYear, parseIso, yearToIso } from './dates.js';

describe('parseIso', () => {
  it('takes a full date, a month, or a year', () => {
    expect(parseIso('1861-04-12')).toEqual({ year: 1861, month: 4, day: 12 });
    // A month-only link is what a person types when handing one on, and the
    // reader used to reject it in silence.
    expect(parseIso('1861-04')).toEqual({ year: 1861, month: 4, day: 1 });
    expect(parseIso('1861')).toEqual({ year: 1861, month: 1, day: 1 });
  });

  it('refuses anything it cannot honour', () => {
    for (const bad of ['', 'apr 1861', '1861-13', '1861-02-30', '1861-00-01', '1861-1-1', '861-04-12', null, 1861]) {
      expect(parseIso(bad), `should refuse ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  it('knows February in a leap year', () => {
    expect(parseIso('1860-02-29')).toEqual({ year: 1860, month: 2, day: 29 });
    expect(parseIso('1861-02-29')).toBeNull();
    expect(parseIso('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseIso('1900-02-29')).toBeNull();
  });
});

describe('isoToYear and yearToIso', () => {
  it('round-trips to the day', () => {
    const dates = [
      '1607-05-14', '1783-09-03', '1848-02-02', '1861-04-12', '1863-06-20',
      '1865-04-09', '1900-01-01', '1941-12-07', '1945-08-15', '1989-11-09',
      '2000-12-31', '2020-02-29', '2021-01-01', '2021-12-31', '1900-12-31',
    ];

    for (const iso of dates) {
      expect(yearToIso(isoToYear(iso)), `round trip for ${iso}`).toBe(iso);
    }
  });

  it('lands inside the year it was asked for', () => {
    for (let year = 1607; year <= 2000; year += 7) {
      const iso = yearToIso(year + 0.999);
      expect(iso.startsWith(String(year))).toBe(true);
    }
  });

  it('is the inverse of the pipeline format as well', () => {
    for (const n of [16070514, 17830903, 18610412, 19411207, 20001231]) {
      expect(isoToN(yearToIso(nToYear(n)))).toBe(n);
      expect(nToIso(n)).toBe(yearToIso(nToYear(n)));
    }
  });

  it('refuses a date it cannot parse, loudly', () => {
    // Callers that should be loud are the chapter table and the pipeline, where
    // a typo would otherwise become a silently wrong boundary window.
    expect(() => isoToYear('1861-13-01')).toThrow(/not an ISO date/);
    expect(() => isoToN('whenever')).toThrow(/not an ISO date/);
  });
});
