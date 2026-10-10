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
 * and the viewer's motion setting, and says whether the film starts without
 * being asked. `main.js` is what acts on the answer.
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
  /** Throttle clock for URL rewriting; see `#maybeWriteUrl`. */
  #lastUrl = 0;

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
    this.#syncStory(year);
    this.#maybeWriteUrl();
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

    const params = new URLSearchParams();
    params.set('chapter', this.state.chapter.id);
    // To the day, not to the month. Month precision made the link lossy against
    // a reader that wanted a day, so a reload could land up to a month early.
    params.set('date', yearToIso(this.state.date));

    const url = `${location.pathname}?${params.toString()}`;
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
 * Yes by default. The eight chapters are one continuous run and a person who
 * opens the page has asked to be shown it, so the atlas starts itself rather
 * than waiting to be driven — which is also the only way the narrative layer
 * gets read, since a visitor who never presses Play sees the opening date and
 * one card.
 *
 * Three things override that default, and each is a promise the atlas has
 * already made rather than a preference:
 *
 * - **A link that names a date is a link to a moment, not to the film.** The
 *   deep link exists so that a shot can be pasted into a message and land on
 *   that shot, which means the cursor has to stay where it landed. Playing it
 *   would carry the reader off the frame they were sent to look at, and the one
 *   thing the URL is for is holding a frame still.
 * - **`?still`.** The escape hatch, and it is not redundant with the rule above:
 *   a link that names a *chapter* and no date is a legitimate thing to share,
 *   and without this there would be no way to share one without it starting to
 *   move. See the deep link table in `docs/ARCHITECTURE.md`.
 * - **`prefers-reduced-motion`.** Continuous motion is the most aggressive
 *   thing this page does, and the setting belongs to the viewer rather than to
 *   the link, so it wins even over a default. The rest of the atlas's motion is
 *   still owed to that setting and is still M5's work; this is the one case
 *   where getting it wrong means a page that moves on its own.
 *
 * Takes both inputs as arguments rather than reading the environment, so it can
 * be pinned by a test — `parseDeepLink` above cannot be, because it has to read
 * `location`.
 */
export function shouldAutoplay(link, reducedMotion) {
  return !reducedMotion && !link.still && link.year === null;
}
