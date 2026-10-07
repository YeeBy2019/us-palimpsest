/**
 * Writing a generated file, and proving that it landed.
 *
 * `writeFile` resolves once the bytes have been handed to the system, and a
 * build that reports success from the length of a string in memory is reporting
 * what it *sent*, which is not evidence of what *arrived*. The two can disagree,
 * and here they did: a chapter bundle came out **zero bytes long** while the
 * build printed `125.5 KB` beside it. Nothing in the pipeline noticed. The only
 * symptom was the browser refusing to parse a file the build believed it had
 * written, and the only reason it was found at all is that a human opened the
 * page — which is not a guard.
 *
 * So the number a build prints is read back off the disk, and a disagreement is
 * a build failure rather than a log line. The rule is that this function's
 * return value may be used as evidence; `contents.length` may not.
 *
 * Two halves, and it is worth being honest that only one is reachable from a
 * test. The parse check is: a document that landed truncated does not parse, and
 * `pipeline.test.js` feeds it one. The length check catches the other shape of
 * the same failure — bytes missing without a syntax error — and reaching it from
 * a test would mean injecting a partial write, so it stands on reasoning rather
 * than on a red test. It is kept because it is the only check that would speak
 * if a file were somehow short but still self-consistent.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Write a JSON document, then read it back and prove it is what was meant.
 *
 * @param {string} file      absolute path to write
 * @param {string} contents  the serialised JSON document
 * @returns {Promise<number>} characters actually found on disk, not the count sent
 */
export async function writeJson(file, contents) {
  await writeFile(file, contents);

  const written = await readFile(file, 'utf8');
  const name = path.basename(file);

  if (written.length !== contents.length) {
    throw new Error(`${name}: wrote ${contents.length} chars, read back ${written.length}`);
  }

  try {
    JSON.parse(written);
  } catch (error) {
    throw new Error(`${name}: wrote a file that does not parse — ${error.message}`);
  }

  return written.length;
}
