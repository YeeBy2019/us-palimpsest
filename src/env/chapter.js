/**
 * Chapter state: what the atlas is showing, and how it got there.
 *
 * This module owns the date cursor, the chapter weights and the dispersal, and
 * it is the only thing in the project that writes to the shared uniforms. That
 * single-writer rule is what makes a chapter change reach the whole frame in
 * one frame, and it is why nothing here touches a material or a uniform
 * belonging to a specific layer.
 *
 * GSAP is used in its three distinct roles rather than as a general tweening
 * habit:
 *
 * - **Snaps** — a deep link, a chapter jump — are `gsap.set`. Instant, no
 *   animation, no ambiguity about what the value is.
 * - **Continuous state** — the date cursor following a drag — is
 *   `gsap.quickTo`, which re-aims a moving target every call instead of
 *   building and tearing down a tween. This is the case that makes a timeline
 *   library worthwhile here rather than merely convenient.
 * - **Authored sequences** — the dispersal between chapters — is a
 *   `gsap.timeline`, with the date swap placed at the moment the sheet is
 *   invisible.
 */

import gsap from 'gsap';

import { U, writeChapterSlot } from '../core/shared.js';
import { clamp } from '../lib/math.js';

/**
 * How long a boundary takes to arrive or leave, in years, derived from the
 * chapter's own length.
 *
 * A fixed number of years would be wrong in both directions: half a year is a
 * flicker in a chapter that spans a hundred and sixty, and half a year is most
 * of a four-year chapter. Six per cent, clamped, keeps arrival legible at every
 * scale — which is the same reasoning behind letting each chapter carry its own
 * time axis.
 */
export function appearWindowFor(chapter) {
  return clamp((chapter.end - chapter.start) * 0.06, 0.12, 1.1);
}

/** Timing of the dispersal, in seconds. */
export const TRANSITION = {
  disperse: 0.85,
  swap: 0.85,
  blend: 0.4,
  reform: 1.15,
};

export class ChapterState {
  /** The `quickTo` re-aimer for the date cursor, built on first use. */
  #aim = null;
  /** The in-flight dispersal, if any. */
  #timeline = null;

  constructor(initialChapter) {
    this.chapter = initialChapter;
    this.date = initialChapter.start;
    this.targetDate = initialChapter.start;

    /** Weight of the incoming chapter during a transition. 0 when settled. */
    this.blend = 0;
    /** Dot dispersal. 0 settled, 1 fully dispersed. */
    this.disperse = 0;

    this.playing = false;
    /** Years per second while playing. Chapter length scales it downstream. */
    this.rate = 1;

    this.#aim = null;
    this.#timeline = null;
    this._listeners = new Set();

    writeChapterSlot(initialChapter, 0);
    writeChapterSlot(initialChapter, 1);
    U.uChapter.value.set(1, 0, 0, 0);
    U.uAppearWindow.value = appearWindowFor(initialChapter);
    U.uDate.value = this.date;
  }

  /** Subscribe to chapter changes. Returns an unsubscribe function. */
  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  #announce() {
    for (const listener of this._listeners) listener(this.chapter);
  }

  /** How far through its own window the cursor is, 0..1. */
  get progress() {
    const span = this.chapter.end - this.chapter.start;
    return span > 0 ? clamp((this.date - this.chapter.start) / span, 0, 1) : 0;
  }

  get isTransitioning() {
    return this.blend > 0 || this.disperse > 0;
  }

  /** Drop the cursor somewhere in the current chapter, with no animation. */
  snapDate(year) {
    this.#aim = null;
    this.date = clamp(year, this.chapter.start, this.chapter.end);
    this.targetDate = this.date;
    U.uDate.value = this.date;
  }

  /**
   * Aim the cursor at a date, letting it travel there.
   *
   * `quickTo` is built for this: the viewer can drag while it is still
   * travelling, and each call re-aims the value already in flight rather than
   * starting a second animation that fights the first.
   */
  aimDate(year) {
    this.targetDate = clamp(year, this.chapter.start, this.chapter.end);
    if (!this.#aim) {
      // `this.date` is the single source of truth; `update()` writes it into the
      // uniform every frame, so the tween only has to move the number.
      this.#aim = gsap.quickTo(this, 'date', { duration: 0.55, ease: 'power2.out' });
    }
    this.#aim(this.targetDate);
  }

  /** Jump to a chapter and a date with no animation — a deep link, a snap. */
  snap(chapter, year = null) {
    this.#kill();
    this.#promote(chapter, year ?? chapter.start);
  }

  /** Travel to a chapter through the dispersal. */
  goTo(chapter, year = null) {
    if (chapter === this.chapter && !this.isTransitioning) {
      if (year !== null) this.aimDate(year);
      return;
    }
    if (chapter === this.chapter) return;

    this.#kill();
    this.playing = false;

    // Slot 0 is the chapter being left, slot 1 the one arriving. The shader
    // blends between the two by weight, so the paper's tint, the hatch and the
    // ink all cross over together rather than switching.
    writeChapterSlot(this.chapter, 0);
    writeChapterSlot(chapter, 1);
    U.uAppearWindow.value = appearWindowFor(chapter);

    const incoming = chapter;
    const arrivingAt = year ?? chapter.start;

    const timeline = gsap.timeline({
      onComplete: () => {
        // Settle back to a single slot so the steady state has no blending
        // arithmetic running at all.
        writeChapterSlot(this.chapter, 0);
        writeChapterSlot(this.chapter, 1);
        U.uChapter.value.set(1, 0, 0, 0);
        this.blend = 0;
        this.disperse = 0;
        U.uInk.value = 0;
        this.#timeline = null;
      },
    });

    timeline
      .to(this, { disperse: 1, duration: TRANSITION.disperse, ease: 'power2.in' }, 0)
      // The sheet is fully dispersed here, so the date can move without anyone
      // seeing it. This is the only moment in the atlas when time jumps.
      .call(
        () => {
          this.chapter = incoming;
          this.date = arrivingAt;
          this.targetDate = arrivingAt;
          this.#aim = null;
          U.uDate.value = arrivingAt;
          this.#announce();
        },
        null,
        TRANSITION.swap,
      )
      .to(this, { blend: 1, duration: TRANSITION.blend, ease: 'power1.inOut' }, TRANSITION.swap)
      .to(this, { disperse: 0, duration: TRANSITION.reform, ease: 'power2.out' }, TRANSITION.swap + 0.1);

    this.#timeline = timeline;
  }

  play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    this.playing = !this.playing;
    return this.playing;
  }

  #kill() {
    if (this.#timeline) {
      this.#timeline.kill();
      this.#timeline = null;
    }
    this.blend = 0;
    this.disperse = 0;
    U.uInk.value = 0;
  }

  /** Settle immediately on a chapter, skipping the dispersal entirely. */
  #promote(chapter, year) {
    const previous = this.chapter;
    this.chapter = chapter;
    this.date = clamp(year, chapter.start, chapter.end);
    this.targetDate = this.date;
    this.#aim = null;
    this.blend = 0;
    this.disperse = 0;

    writeChapterSlot(chapter, 0);
    writeChapterSlot(chapter, 1);
    U.uChapter.value.set(1, 0, 0, 0);
    U.uAppearWindow.value = appearWindowFor(chapter);
    U.uDate.value = this.date;
    U.uInk.value = 0;

    if (previous !== chapter) this.#announce();
  }

  /**
   * Advance time, then write the shared uniforms exactly once.
   *
   * Everything above computes numbers; nothing above touches the GPU. One write
   * per frame from one place is what keeps the frame coherent.
   */
  update(dt, time) {
    if (this.playing && !this.isTransitioning) {
      const span = this.chapter.end - this.chapter.start;
      // A chapter takes roughly the same time to read whatever it spans, so the
      // rate is expressed as fractions of a chapter per second rather than years
      // per second. A four-year chapter and a hundred-and-sixty-year one then
      // play at the same felt speed.
      const step = span * 0.055 * this.rate * dt;
      this.date = clamp(this.date + step, this.chapter.start, this.chapter.end);
      this.targetDate = this.date;
      if (this.date >= this.chapter.end) this.playing = false;
    }

    // One write per frame, from one place. Everything above computes numbers;
    // nothing above touches the GPU.
    U.uTime.value = time;
    U.uInk.value = this.disperse;
    U.uDate.value = this.date;
    U.uChapter.value.set(1 - this.blend, this.blend, 0, 0);
  }
}
