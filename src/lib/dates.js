/**
 * Dates, in the two forms this project actually uses.
 *
 * **Fractional year** is the atlas's axis. It is what the date cursor moves
 * along, what the shaders compare against, and what makes a boundary grow
 * rather than switch. Fractional, so a date in a leap year lands where it
 * belongs rather than drifting by a day.
 *
 * **YYYYMMDD integer** is how AHCB writes its own `START_N` and `END_N` fields.
 * Comparing against those is an integer comparison, not a date parse, which is
 * why the pipeline can filter two hundred geometries in microseconds.
 */

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month, February included, so a round trip cannot land on the 31st
 *  of a 30-day month. */
function daysInMonth(year, month) {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Read an ISO date, at whatever precision it was written.
 *
 * `YYYY-MM-DD` is the form the atlas writes and the form `chapters.js` uses.
 * `YYYY-MM` is accepted as well, because it is the form a person types when
 * handing a link to someone, and refusing it silently — which is what the deep
 * link used to do — loses the date without saying so. `YYYY` is accepted for the
 * same reason.
 *
 * Returns null rather than throwing: a malformed URL has to degrade to the
 * opening view, and `parseDeepLink` is the caller that needs that. Callers that
 * *should* be loud about a bad date call `isoToYear`, which throws.
 */
export function parseIso(iso) {
  if (typeof iso !== 'string') return null;

  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(iso.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] === undefined ? 1 : Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

/** `'1861-04-12'` -> `1861.279...` */
export function isoToYear(iso) {
  const parts = parseIso(iso);
  if (!parts) throw new Error(`not an ISO date: ${iso}`);
  return partsToYear(parts.year, parts.month, parts.day);
}

/** `'1861-04-12'` -> `18610412` */
export function isoToN(iso) {
  const parts = parseIso(iso);
  if (!parts) throw new Error(`not an ISO date: ${iso}`);
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function partsToYear(year, month, day) {
  const elapsed = Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1);
  return year + elapsed / 86_400_000 / (isLeap(year) ? 366 : 365);
}

/**
 * The inverse of `isoToYear`, to the day.
 *
 * The deep link used to be written at month precision, which meant the app
 * emitted a URL it could not read back: reloading lost the day, and for the
 * 1861 anchor that was the difference between landing on the secession line and
 * landing ten days before it. Round-tripping to the day costs four characters.
 */
export function yearToIso(year) {
  const whole = Math.floor(year);
  const days = isLeap(whole) ? 366 : 365;
  // Clamped, because a fraction of 0.99999 rounds up past the last day.
  const dayOfYear = Math.min(days, Math.max(1, Math.round((year - whole) * days) + 1));

  let month = 1;
  let remaining = dayOfYear;
  while (remaining > daysInMonth(whole, month)) {
    remaining -= daysInMonth(whole, month);
    month++;
  }

  return `${String(whole).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(remaining).padStart(2, '0')}`;
}

/** `18610412` -> `1861.279...` */
export function nToYear(n) {
  return partsToYear(Math.floor(n / 10000), Math.floor(n / 100) % 100, n % 100);
}

/** `18610412` -> `'1861-04-12'` */
export function nToIso(n) {
  const year = Math.floor(n / 10000);
  const month = String(Math.floor(n / 100) % 100).padStart(2, '0');
  const day = String(n % 100).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A fractional year as a short human label: `1861.28` -> `'Apr 1861'`. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function yearToLabel(year) {
  const whole = Math.floor(year);
  const frac = year - whole;
  const index = Math.min(11, Math.max(0, Math.floor(frac * 12)));
  return `${MONTHS[index]} ${whole}`;
}
