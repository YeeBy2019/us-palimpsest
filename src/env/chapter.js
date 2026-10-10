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

    /**
     * The *other* chapter in flight, or null when settled.
     *
     * A transition puts exactly two chapters on the sheet: the one being read
     * and the one arriving. Without this the renderer has no way to tell those
     * two apart from the five sitting loaded but idle behind them, and its only
     * options are "draw one" or "draw all seven" — and drawing all seven is
     * what it did. Seven coincident plates is not a heavier line, it is a
     * different drawing: the 1803 Mississippi line reappears across the middle
     * of the 1989 map, and the ink goes about twice as dark for the length of
     * the dispersal.
     *
     * It is written in both directions on purpose. Before the swap the chapter
     * being read is the outgoing one and the partner is the incoming one; after
     * the swap they trade, because the identity of `chapter` moves at the same
     * instant the date does.
     */
    this.partner = null;

    this.playing = false;
    /** Years per second while playing. Chapter length scales it downstream. */
    this.rate = 1;
    /**
     * Fraction of the chapter's own span the cursor covers per second while
     * playing, before `rate`.
     *
     * This is M0's value, and it is the state machine's *default* rather than
     * the atlas's setting: the story layer overrides it, because a chapter with
     * written beats has to hold each one long enough to read, and nine cards at
     * M0's rate would be eighteen seconds of screen time. `main.js` is what
     * does the overriding, which is why this module still knows nothing about
     * content. `narration.test.js` pins the two defaults equal so the number
     * cannot drift apart into two.
     */
    this.pace = 0.055;

    /**
     * Dates the cursor stops at while playing, ascending, in fractional years.
     *
     * A *hold* is a playback concept, not a historical one — the same shape as a
     * keyframe — which is why this module can own the mechanism while knowing
     * nothing about what is at a hold. `main.js` fills it from the story layer's
     * beats.
     */
    this.holds = [];
    /** How long to stand at each hold, in seconds. */
    this.holdSeconds = 0;
    /** Seconds still to stand at the current hold; 0 while travelling. */
    this.dwell = 0;
    /**
     * The hold last stood on, so arriving at it again does not re-trigger.
     *
     * Without this the cursor would stand on the first hold forever: the
     * chapter's opening beat is dated the day the chapter opens, so on the very
     * first tick `from` and `hold` are the same number.
     */
    this.heldAt = null;

    /**
     * The chapter to roll into when this one ends, or null to stop there.
     *
     * A **function of the chapter**, not a list, and it is the same bargain
     * `holds` makes: the state machine is told where to go without ever being
     * told what is there. `main.js` hands it `nextBuiltChapter`, so this module
     * still holds no chapter order of its own — only the one chapter it is
     * currently inside.
     *
     * Null is the default, and that default is load-bearing: it means "a chapter
     * is the whole of it", which is exactly what the atlas did before there was
     * a film. A `ChapterState` built in a test with nothing assigned still stops
     * at its end, which is why the tests written before this existed still pass
     * unchanged.
     */
    this.nextChapter = null;

    /**
     * Where Play starts when it is pressed on a film that has already finished.
     *
     * The unit that stopped was the whole run of chapters, not one chapter, so
     * pressing Play at the end of it starts again from the top rather than doing
     * nothing — a dead Play button is the one outcome worth six lines to avoid.
     * Unset, Play on a chapter that has run out is inert.
     */
    this.openingChapter = null;

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

  /**
   * Is a chapter change in flight?
   *
   * The partner is part of the answer, not an afterthought. `blend` and
   * `disperse` are written by GSAP, so between `goTo` returning and the first
   * tick neither of them has moved off zero — for that one frame the state
   * would claim to be settled while a transition was already running, and the
   * renderer would hide the chapter that is on its way. Naming the partner is
   * what happens at the start, so it is what "in flight" has to mean.
   */
  get isTransitioning() {
    return this.partner !== null || this.blend > 0 || this.disperse > 0;
  }

  /** Drop the cursor somewhere in the current chapter, with no animation. */
  snapDate(year) {
    this.#aim = null;
    // A viewer who takes hold of the timeline has taken it off the story, so a
    // hold in progress is abandoned rather than resumed wherever they let go.
    this.dwell = 0;
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
    // See `snapDate`: a scrub cancels a hold rather than leaving the cursor to
    // resume standing still at a date the viewer has just moved away from.
    this.dwell = 0;
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
    // Navigating does **not** touch `playing`. It used to pause here, on the
    // grounds that a chapter change is something the viewer asked for — which
    // was true when the only way to change chapter was to ask for one. With the
    // atlas playing itself, the common case is a film in progress, and a chapter
    // click then means "go to this one" rather than "stop". Pausing here would
    // let a viewer browse the selector, silently switch the film off without
    // noticing, and come back to a still page wondering what broke — which is a
    // worse failure than a chapter change that keeps rolling. Scrubbing still
    // pauses, because taking hold of the timeline *is* leaving the story, and
    // Restart still pauses, because it is a rewind.

    // Slot 0 is the chapter being left, slot 1 the one arriving. The shader
    // blends between the two by weight, so the paper's tint, the hatch and the
    // ink all cross over together rather than switching.
    writeChapterSlot(this.chapter, 0);
    writeChapterSlot(chapter, 1);
    U.uAppearWindow.value = appearWindowFor(chapter);

    const outgoing = this.chapter;
    const incoming = chapter;
    const arrivingAt = year ?? chapter.start;
    this.partner = incoming;

    const timeline = gsap.timeline({
      onComplete: () => {
        // Settle back to a single slot so the steady state has no blending
        // arithmetic running at all.
        writeChapterSlot(this.chapter, 0);
        writeChapterSlot(this.chapter, 1);
        U.uChapter.value.set(1, 0, 0, 0);
        this.blend = 0;
        this.disperse = 0;
        this.partner = null;
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
          // The two swap roles at the instant the identity moves, so the
          // outgoing plate stays on the sheet until the incoming one is
          // underneath it.
          this.partner = outgoing;
          this.date = arrivingAt;
          this.targetDate = arrivingAt;
          this.#aim = null;
          // The arriving chapter's beats have not been stood on. Cleared here,
          // under cover of the dispersal, for the same reason the date is: it is
          // the one moment in the atlas when nobody can see the state change.
          this.dwell = 0;
          this.heldAt = null;
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

  /**
   * Start, stop, or roll on.
   *
   * Pressing Play on a chapter that has already run out is not a dead button.
   * There are two ways to have run out and they take different roads: if another
   * chapter follows, the film carries on into it; if none does, the film has
   * finished and Play starts it again from the opening.
   *
   * Written as branches rather than as one conjunction, because the conjunction
   * that says the same thing — `#atEnd() && !#rollOn() && openingChapter`, with
   * the film left running by the fall-through — is true and unreadable, and it
   * makes `#rollOn`'s own "the film is now playing" a line that nothing needs.
   */
  toggle() {
    if (this.playing) {
      this.playing = false;
      return false;
    }

    if (this.#atEnd()) {
      if (this.#rollOn()) return true;
      if (this.openingChapter) {
        this.goTo(this.openingChapter);
        this.playing = true;
        return true;
      }
    }

    this.playing = true;
    return true;
  }

  /**
   * Carry the film into the chapter after this one. False when there is none.
   *
   * `goTo` deliberately leaves `playing` alone, so "rolled on" and "still
   * playing" are two statements here rather than one — which matters because
   * this is reached both from a play-through that is already running and from
   * Play itself, where the film was stopped a moment ago. Injection says the
   * line is load-bearing: remove it and Play on a chapter that has run out
   * arrives at the next one without the film running.
   *
   * Note what is *not* here: nothing about timing. The arriving chapter's date
   * and holds are installed under cover of the dispersal, which `goTo` already
   * does, and its pace and holds are applied by whoever listens for the chapter
   * change — the same path a chapter click takes. That is why a chapter that
   * plays one way when it is chosen plays the same way when it arrives on its
   * own, and why this is one call and not a second copy of the boot sequence.
   */
  #rollOn() {
    const next = this.nextChapter ? this.nextChapter(this.chapter) : null;
    if (!next) return false;
    this.goTo(next);
    this.playing = true;
    return true;
  }

  /**
   * Is the cursor parked at the end of its chapter with nothing holding it?
   *
   * "Nothing holding it" is the load-bearing half. A chapter whose last beat is
   * dated the day it closes is *at* its end while it is standing on that beat,
   * so a test that ignored the dwell would end the film before its last card was
   * read — and the film would be one beat short on exactly the chapters that
   * were written to end on their subject.
   *
   * The transition half matters for `toggle` rather than for `update`, which is
   * only ever reached when nothing is in flight: a viewer pressing Play during a
   * dispersal must not re-aim it.
   */
  #atEnd() {
    return !this.isTransitioning && this.dwell === 0 && this.date >= this.chapter.end;
  }

  #kill() {
    if (this.#timeline) {
      this.#timeline.kill();
      this.#timeline = null;
    }
    this.blend = 0;
    this.disperse = 0;
    this.partner = null;
    U.uInk.value = 0;
    this.dwell = 0;
    this.heldAt = null;
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
    this.partner = null;
    // A new chapter starts its own story from the beginning: no hold carried
    // over from the last one, and none of its beats already spent.
    this.dwell = 0;
    this.heldAt = null;

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
      // A frame that finishes a hold is not a frame thrown away: whatever is
      // left of it goes into travelling. Decrementing the dwell and travelling
      // in separate frames would stand the cursor still for one frame longer
      // than the hold says, on every beat, and the error would grow with the
      // frame rate rather than with anything anyone chose.
      let remaining = dt;

      if (this.dwell > 0) {
        // Standing on a beat. The date is already the hold's, so what moves is
        // the clock and not the cursor — which is the whole of the difference
        // between playing a chapter and scrubbing one.
        const spent = Math.min(this.dwell, remaining);
        this.dwell -= spent;
        remaining -= spent;
      }

      if (remaining > 0) {
        const span = this.chapter.end - this.chapter.start;
        // A chapter takes roughly the same time to walk whatever it spans, so
        // the pace is a fraction of the chapter per second rather than years per
        // second: a four-year chapter and a hundred-and-sixty-year one then play
        // at the same felt speed.
        const step = span * this.pace * this.rate * remaining;
        const target = this.date + step;
        const hold = this.#nextHold(this.date, target);

        if (hold !== null) {
          // Land exactly on the date rather than near it. A beat is a day, and a
          // card that appears a week early is a card about the wrong thing —
          // the same argument as the deep link having to round-trip to the day.
          this.date = hold;
          this.heldAt = hold;
          this.dwell = this.holdSeconds;
        } else {
          this.date = clamp(target, this.chapter.start, this.chapter.end);
        }
        this.targetDate = this.date;
      }

      // The chapter is over when the date is at its end and nothing is holding
      // it there. A chapter whose last beat is dated the day it closes gets its
      // hold and then stops, which is why the dwell is part of this condition.
      //
      // Over is not the same as finished. The eight chapters are one continuous
      // thing, so the end of one is a hand-off rather than a stop: the cursor
      // rolls into the next chapter and `playing` stays true across the
      // dispersal, which is the whole of the difference between watching the
      // atlas and operating it. Only the end of the last chapter stops it, and
      // that is `#rollOn` returning false rather than a decision made here.
      if (this.#atEnd() && !this.#rollOn()) this.playing = false;
    }

    // One write per frame, from one place. Everything above computes numbers;
    // nothing above touches the GPU.
    U.uTime.value = time;
    U.uInk.value = this.disperse;
    U.uDate.value = this.date;
    U.uChapter.value.set(1 - this.blend, this.blend, 0, 0);
  }

  /**
   * The first hold at or after `from` and no further than `to`, or null.
   *
   * Both bounds are load-bearing and each is here for a case that occurred:
   *
   * - **Inclusive of `from`.** Chapter 6's first beat is dated the day the
   *   chapter opens, so on the first tick `from` and the hold are the same
   *   number. A strict comparison would make the atlas skip the first beat of
   *   every chapter that opens on its own subject.
   * - **Exclusive of `heldAt`.** Otherwise the cursor arrives at a hold, stands
   *   there for the hold, and then finds it again — forever.
   *
   * A linear scan, because the longest chapter has sixteen beats and the list is
   * sorted.
   */
  #nextHold(from, to) {
    for (const hold of this.holds) {
      if (hold < from) continue;
      if (hold === this.heldAt) continue;
      if (hold > to) return null;
      return hold;
    }
    return null;
  }
}
