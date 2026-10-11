/**
 * The interface. All of it DOM, none of it WebGL.
 *
 * Text stays crisp at any resolution, the chrome is selectable and readable by
 * a screen reader, and changing a label costs a string rather than a texture.
 * The canvas draws the sheet; this draws everything a person actually operates.
 *
 * It also owns the story panel — the layer that speaks when the boundaries have
 * nothing to say. The panel is not a second timeline: it reads the same date
 * cursor the geometry reads, so `beatAt(beats, state.date)` is evaluated in
 * `syncDate` beside the date stamp, and scrubbing, playing and deep-linking all
 * move it without any of them knowing it exists.
 *
 * It also owns the URL, which is the one piece of state the atlas has that can
 * be handed to someone else. `?chapter=division&date=1861-04-12&anchor=1861`
 * opens on the exact shot M0 is judged by, which makes the acceptance test
 * something that can be pasted into a message rather than described.
 *
 * And it owns the question of whether the atlas plays itself, which is a URL
 * question more than a button question: {@link shouldAutoplay} reads the link
 * and says whether the film starts without being asked; `main.js` is what acts
 * on the answer. {@link permalinkFor} is the other half of that question — what
 * the page records about where it is — and {@link stillReason} is the answer to
 * the one a viewer actually asks out loud, *why is it not moving*, which the
 * dock prints beside the Play button.
 */

import { isoToYear, parseIso, yearToIso, yearToLabel } from '../lib/dates.js';
import { CHAPTERS } from '../timeline/chapters.js';
import { beatAt, beatsFor } from '../timeline/narration.js';
import { TRANSITION } from '../env/chapter.js';

const SCRUB_STEPS = 1000;

/**
 * Half of the range input's thumb, in pixels.
 *
 * A range's track does not run the full width of the control: the browser
 * insets it by half a thumb at each end, because the thumb's centre is what
 * marks the value. A tick placed at a plain percentage of the control's width
 * would therefore sit up to 4.5px away from the date it claims to mark — which
 * at a chapter's scale is months, and the whole point of a tick is that it is
 * in the right place. Kept in step with `::-webkit-slider-thumb` in `ui.css`.
 */
const THUMB_HALF = 4.5;

export class Interface {
  /**
   * Throttle clock for URL rewriting; see `#maybeWriteUrl`.
   *
   * Still needed now that the URL only changes at a chapter boundary or a pause:
   * a pause can arrive on any frame, and without it the write could land
   * mid-transition while the state is between two chapters.
   */
  #lastUrl = 0;

  /**
   * The link this page was opened with, and the line to show while the film is
   * not running.
   *
   * Both come from the URL and are read once, at boot, in one place — the
   * permalink writer needs to know whether the link asked for a still, and the
   * dock needs to know why it is not moving. `null` reason means the atlas is
   * going to start itself, which is the common case.
   */
  link = null;

  stillReason = null;

  /**
   * Take the link as a fact about this visit.
   *
   * Called before `mount`, because the dock reads it on its first frame.
   */
  openedWith(link) {
    this.link = link;
    this.stillReason = stillReason(link);
  }

  /** This chapter's beats, in date order. Rebuilt on a chapter change. */
  #beats = [];

  /**
   * The beat currently on the panel.
   *
   * Starts as `undefined` rather than `null` on purpose: `null` is a real value
   * here — "the cursor has not reached the first beat" — so a chapter change
   * that resets this to `null` would compare equal to a chapter with no beats
   * and leave the outgoing chapter's story on screen. A sentinel no beat can
   * hold is what forces the redraw.
   */
  #currentBeat = undefined;

  constructor(state) {
    this.state = state;
    this.dom = {
      chapters: document.getElementById('chapters'),
      scrub: document.getElementById('scrub'),
      beats: document.getElementById('beats'),
      stamp: document.getElementById('stamp'),
      play: document.getElementById('play'),
      rewind: document.getElementById('rewind'),
      material: document.getElementById('material'),
      hint: document.getElementById('hint'),
      card: document.getElementById('card'),
      cardIndex: document.getElementById('card-index'),
      cardName: document.getElementById('card-name'),
      cardMaterial: document.getElementById('card-material'),
      story: document.getElementById('story'),
      storyMeta: document.getElementById('story-meta'),
      storyTitle: document.getElementById('story-title'),
      storyBody: document.getElementById('story-body'),
      storyBodyZh: document.getElementById('story-body-zh'),
      loader: document.getElementById('loader'),
      loaderText: document.getElementById('loader-text'),
    };
    this.buttons = new Map();
    this.#lastUrl = 0;
  }

  mount() {
    this.#buildChapters();

    this.dom.scrub.addEventListener('input', () => {
      this.state.pause();
      this.#syncPlayButton();
      const chapter = this.state.chapter;
      const span = chapter.end - chapter.start;
      this.state.aimDate(chapter.start + (Number(this.dom.scrub.value) / SCRUB_STEPS) * span);
    });

    this.dom.play.addEventListener('click', () => {
      this.state.toggle();
      // Called here rather than left to the next frame so the label answers the
      // press itself: at the end of a chapter this is the click that starts a
      // dispersal, and a button that says Play for a frame while a chapter is
      // already moving reads as a missed click.
      this.#syncPlayButton();
    });

    this.dom.rewind.addEventListener('click', () => {
      this.state.pause();
      this.#syncPlayButton();
      this.state.aimDate(this.state.chapter.start);
    });

    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        this.state.toggle();
        this.#syncPlayButton();
      }
    });

    this.state.onChange((chapter) => {
      this.syncChapter(chapter);
      this.announce(chapter);
    });

    this.syncChapter(this.state.chapter);
    this.syncDate(this.state.date);
  }

  #buildChapters() {
    this.dom.chapters.replaceChildren();

    for (const chapter of CHAPTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chapter';
      button.dataset.chapter = chapter.id;
      button.disabled = !chapter.built;

      const num = document.createElement('span');
      num.className = 'chapter__num';
      num.textContent = String(chapter.index + 1).padStart(2, '0');

      const name = document.createElement('span');
      name.className = 'chapter__name';
      name.textContent = chapter.name;

      const years = document.createElement('span');
      years.className = 'chapter__years';
      years.textContent = `${Math.floor(chapter.start)}–${Math.floor(chapter.end)}`;

      button.append(num, name, years);

      // A chapter with no bundle is shown, disabled, rather than hidden: the
      // eight-chapter spine is the shape of the project, and a selector that
      // showed only the buildable ones would misrepresent it. Nothing is
      // disabled at present — Chapter 1 builds, from its own story routes, and
      // this branch exists for a chapter that has not been authored yet.
      if (chapter.built) {
        button.addEventListener('click', () => this.state.goTo(chapter));
      }

      this.dom.chapters.append(button);
      this.buttons.set(chapter.id, button);
    }
  }

  /** Reflect the current chapter in the chrome. */
  syncChapter(chapter) {
    for (const [id, button] of this.buttons) {
      button.setAttribute('aria-current', String(id === chapter.id));
    }
    this.dom.material.textContent = chapter.material.family;
    this.dom.scrub.value = String(Math.round(this.state.progress * SCRUB_STEPS));

    // The story belongs to the chapter, so it is rebuilt with the chapter: the
    // ticks on the scrub are re-placed and the panel is cleared. It falls out
    // of the frame loop a moment later — this is not where the beat is chosen,
    // only where the previous chapter's is taken down. A chapter change swaps
    // the date to the new chapter's opening inside the dispersal, so the new
    // beat is on screen before the sheet has finished reforming.
    this.#beats = beatsFor(chapter);
    this.#currentBeat = undefined;
    this.#buildBeats(chapter);
  }

  /**
   * Place a tick on the scrub for each of the chapter's beats.
   *
   * Rebuilt rather than reused, because the tick positions are fractions of
   * *this chapter's* window: 1944 is at a very different place in a four-year
   * chapter than in a hundred-and-sixty-year one.
   */
  #buildBeats(chapter) {
    this.dom.beats.replaceChildren();
    const span = chapter.end - chapter.start;
    if (!(span > 0)) return;

    for (const beat of this.#beats) {
      const fraction = (beat.year - chapter.start) / span;
      const tick = document.createElement('span');
      tick.className = 'dock__beat';
      tick.dataset.beat = beat.id;
      tick.style.left = `calc(${THUMB_HALF}px + (100% - ${THUMB_HALF * 2}px) * ${fraction.toFixed(6)})`;
      this.dom.beats.append(tick);
    }
  }

  /** Point the panel at the beat in force at this date, if it has changed. */
  #syncStory(year) {
    const beat = beatAt(this.#beats, year);
    if (beat === this.#currentBeat) return;
    this.#currentBeat = beat;
    this.#renderBeat(beat);
  }

  #renderBeat(beat) {
    for (const tick of this.dom.beats.children) {
      tick.dataset.current = String(Boolean(beat) && tick.dataset.beat === beat.id);
    }

    if (!beat) {
      this.dom.story.hidden = true;
      return;
    }

    this.dom.storyMeta.textContent = `${beat.date} · ${beat.place.name}`;
    this.dom.storyTitle.textContent = `${beat.title} · ${beat.titleZh}`;
    this.dom.storyBody.textContent = beat.body;
    this.dom.storyBodyZh.textContent = beat.bodyZh;

    this.dom.story.hidden = false;
    // The same honest replay the chapter card uses: a CSS animation can only be
    // restarted by taking the class off and forcing a reflow in between.
    this.dom.story.classList.remove('is-in');
    void this.dom.story.offsetWidth;
    this.dom.story.classList.add('is-in');
  }

  /** Reflect the date cursor. Called every frame; cheap on purpose. */
  syncDate(year) {
    const label = yearToLabel(year);
    if (this.dom.stamp.value !== label) this.dom.stamp.value = label;
    this.dom.scrub.value = String(Math.round(this.state.progress * SCRUB_STEPS));
    this.#syncPlayButton();
    this.#syncHint();
    this.#syncStory(year);
    this.#maybeWriteUrl();
  }

  /**
   * Say why the page is not moving, for as long as it is not.
   *
   * Derived every frame from `playing`, like the Play button beside it, so the
   * line leaves the moment anyone starts the film — including when the film
   * starts itself, and without every caller that can change `playing` having to
   * remember to clear it.
   */
  #syncHint() {
    const text = this.state.playing ? '' : (this.stillReason ?? '');
    if (this.dom.hint.textContent !== text) this.dom.hint.textContent = text;
  }

  /** The chapter card: inked in over the sheet, then out. */
  announce(chapter) {
    this.dom.cardIndex.textContent = `Chapter ${chapter.index + 1} — ${chapter.episodes ?? ''}`.trim();
    this.dom.cardName.textContent = `${chapter.name} · ${chapter.nameZh}`;
    this.dom.cardMaterial.textContent = chapter.material.family;

    // Restart the animation honestly: removing the attribute and forcing a
    // reflow is the only reliable way to replay a CSS animation.
    this.dom.card.setAttribute('aria-hidden', 'true');
    void this.dom.card.offsetWidth;
    this.dom.card.setAttribute('aria-hidden', 'false');

    window.setTimeout(
      () => this.dom.card.setAttribute('aria-hidden', 'true'),
      TRANSITION.disperse * 1000 + TRANSITION.reform * 1000 + 400,
    );
  }

  #syncPlayButton() {
    const playing = this.state.playing;
    // Idempotent, because this is called every frame from `syncDate`. `playing`
    // is not the button's to own: autoplay sets it, the end of the film clears
    // it, and the keyboard toggles it, so the only way the label can be trusted
    // is if it is derived from the state rather than written when someone
    // happens to remember to write it.
    if (this.dom.play.getAttribute('aria-pressed') === String(playing)) return;
    this.dom.play.setAttribute('aria-pressed', String(playing));
    this.dom.play.textContent = playing ? 'Pause' : 'Play';
  }

  setLoaderText(text) {
    this.dom.loaderText.textContent = text;
  }

  showLoaderError(error) {
    this.dom.loaderText.textContent = error?.message ?? String(error);
    this.dom.loaderText.style.color = '#7a1e22';
    this.dom.loaderText.style.textTransform = 'none';
    this.dom.loaderText.style.letterSpacing = '0';
  }

  async hideLoader() {
    this.dom.loader.classList.add('is-done');
    await new Promise((resolve) => setTimeout(resolve, 640));
    this.dom.loader.hidden = true;
  }

  #maybeWriteUrl() {
    const now = performance.now();
    if (now - this.#lastUrl < 250) return;
    this.#lastUrl = now;

    const url = permalinkFor(location.pathname, {
      chapterId: this.state.chapter.id,
      date: this.state.date,
      playing: this.state.playing,
      still: this.link?.still ?? false,
    });
    if (url !== `${location.pathname}${location.search}`) {
      history.replaceState(null, '', url);
    }
  }
}

/**
 * Read the view out of the URL.
 *
 * Every value is optional and every one has a sane default, so a malformed link
 * degrades to the opening view rather than to a blank screen.
 */
export function parseDeepLink() {
  const params = new URLSearchParams(location.search);
  const chapterId = params.get('chapter');
  const date = params.get('date');

  return {
    chapterId,
    /**
     * A fractional year, or null to use the chapter's opening.
     *
     * `parseIso` rather than a strict regex here, and the difference is not
     * academic: this used to accept only `YYYY-MM-DD` while the writer emitted
     * `YYYY-MM`, so the atlas handed out links it could not read back and a
     * reload quietly lost the day. `parseIso` takes either, and returns null for
     * anything else so a malformed link still degrades to the opening view.
     */
    year: parseIso(date) ? isoToYear(date) : null,
    anchors: params.get('anchor'),
    /** `lo` forces the quick tier; anything else streams full detail. */
    tier: params.get('tier'),
    intro: params.has('intro'),
    /** Open the view without starting the film. See `shouldAutoplay`. */
    still: params.has('still'),
  };
}

/**
 * Does the atlas start playing on its own?
 *
 * Yes, on **every** link except one that asks for a still. The eight chapters
 * are one continuous run and a person who opens the page has asked to be shown
 * it, so the atlas starts itself rather than waiting to be driven — which is
 * also the only way the narrative layer gets read, since a visitor who never
 * presses Play sees the opening date and one card behind a title card.
 *
 * Two things used to be read here and neither is any more, for the same reason.
 *
 * **A date in the URL** said *where to open*, not whether to move. It read well
 * — a shot pasted into a message would stay on the frame it was sent for — and
 * it failed in the direction that matters, because **the page writes its own
 * URL**: `#maybeWriteUrl` records the chapter and the day, so within a second of
 * arriving every ordinary visitor's address bar contained a date. Every reload,
 * every restored tab, every bookmark of the page they had just watched was a
 * still frame, and autoplay became a once-ever event with nothing on screen to
 * say why. A rule that turns the common case into the exception is not a rule
 * about links. Reversed 2026-10-11.
 *
 * **`prefers-reduced-motion`** used to be the other suppressor, and it was the
 * same shape of mistake one step further out: it made the film never start on a
 * machine whose operating system has animations switched off — an old laptop
 * tuned for speed, a corporate image, a remote session — and the viewer on the
 * receiving end of that setting is usually not the person the setting was
 * written for. **The atlas was already reading the setting two different ways on
 * the same machine.** `ui.css` reads it as *milder*: the chapter card still inks
 * itself in, in 0.6 s instead of two; the story panel simply appears. This
 * function read it as *cancel the content*, which is not a reduction of the
 * motion, it is a refusal to run the program. Reversed 2026-10-11, and the
 * setting now reduces rather than forbids: see the pointer parallax gate in
 * `main.js`, which is the one motion here that is *triggered by interaction*
 * and therefore the one WCAG 2.3.3 is actually about.
 *
 * Stillness is `?still`, which has a property neither of the old clauses could
 * have: it is **legible**. A page that is not moving says so in its own URL, so
 * a viewer — or whoever is reading over their shoulder — can tell a deliberate
 * still from a picture that looks broken. That distinction is the whole reason
 * this atlas bothers to tell you *why*; see {@link stillReason}.
 *
 * Takes its input as an argument rather than reading the environment, so it can
 * be pinned by a test — `parseDeepLink` above cannot be, because it has to read
 * `location`. That it takes **one** argument is itself the point, and
 * `ui.test.js` asserts the arity: the decision cannot depend on the motion
 * setting, and the way to say that is that it is never handed it.
 */
export function shouldAutoplay(link) {
  return !link.still;
}

/**
 * Why the film is not starting, in one line, or `null` when it is.
 *
 * There is now exactly one reason, and it needs saying for the reason this
 * function has always existed: it is invisible in the picture. A page held still
 * by `?still` and a page where something went wrong are the same frame
 * otherwise. This project's rule is that a state nobody can see is
 * indistinguishable from a bug, and the one time the rule was broken in the
 * other direction — the atlas declining to start and saying nothing — it cost a
 * run and a round of guessing.
 *
 * The viewer's motion setting used to be a second, preferred reason here. It is
 * gone with the gate it explained; a line that names a cause which no longer
 * causes anything is worse than no line.
 *
 * Pure, and beside the predicate it explains, so the wording is pinned by a test
 * rather than typed into `main.js` where nothing can check it.
 */
export function stillReason(link) {
  if (link.still) return 'Held still by the link — press Play to start';
  return null;
}

/**
 * What the URL should say about the position being shown.
 *
 * The day is written **only when the cursor is held** — paused, scrubbed, or
 * arrived by clicking a chapter. While the film runs, the URL records the
 * chapter and nothing finer. Two reasons, and they happen to agree:
 *
 * - **A permalink is a still frame.** `date=` is the part that pins a moment.
 *   There is no moment to pin while the cursor is moving, and a reload should
 *   not land on a frame the film has already left — which is what the returned
 *   chapter alone gives: the reel starts over, which is what a reload of a
 *   moving picture has always meant.
 * - **`replaceState` is rate-limited.** The cursor crosses a day in well under a
 *   millisecond, so the string changes on essentially every frame; writing it
 *   meant four `replaceState` calls a second for twenty-four minutes. Safari
 *   throws a `SecurityError` after a hundred in thirty seconds — and this runs
 *   inside the frame loop, so the first throw ends the film and the page with
 *   it, on the one browser the atlas has never been run on. Writing only when
 *   the cursor stops means eight writes for a whole run: one per chapter.
 *
 * Takes the pathname rather than reading `location`, so the policy can be pinned
 * by a test; the caller does the `history.replaceState`.
 *
 * `still` is carried through rather than normalized away, unlike `anchor`,
 * `tier` and `intro`. Those three change how the same moment is *drawn*; `still`
 * changes what the page *does*, so dropping it would make the URL a copy of
 * something else — hand the link on and it starts moving, which is the same
 * class of surprise as the one this function exists to stop.
 */
export function permalinkFor(pathname, { chapterId, date, playing, still = false }) {
  const parts = [`chapter=${encodeURIComponent(chapterId)}`];
  if (still) parts.push('still');
  if (!playing) parts.push(`date=${yearToIso(date)}`);
  return `${pathname}?${parts.join('&')}`;
}
