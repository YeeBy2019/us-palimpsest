/**
 * The interface. All of it DOM, none of it WebGL.
 *
 * Text stays crisp at any resolution, the chrome is selectable and readable by
 * a screen reader, and changing a label costs a string rather than a texture.
 * The canvas draws the sheet; this draws everything a person actually operates.
 *
 * It also owns the URL, which is the one piece of state the atlas has that can
 * be handed to someone else. `?chapter=division&date=1861-04-12&anchor=1861`
 * opens on the exact shot M0 is judged by, which makes the acceptance test
 * something that can be pasted into a message rather than described.
 */

import { isoToYear, parseIso, yearToIso, yearToLabel } from '../lib/dates.js';
import { CHAPTERS } from '../timeline/chapters.js';
import { TRANSITION } from '../env/chapter.js';

const SCRUB_STEPS = 1000;

export class Interface {
  /** Throttle clock for URL rewriting; see `#maybeWriteUrl`. */
  #lastUrl = 0;

  constructor(state) {
    this.state = state;
    this.dom = {
      chapters: document.getElementById('chapters'),
      scrub: document.getElementById('scrub'),
      stamp: document.getElementById('stamp'),
      play: document.getElementById('play'),
      rewind: document.getElementById('rewind'),
      material: document.getElementById('material'),
      card: document.getElementById('card'),
      cardIndex: document.getElementById('card-index'),
      cardName: document.getElementById('card-name'),
      cardMaterial: document.getElementById('card-material'),
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
      const playing = this.state.toggle();
      this.#syncPlayButton(playing);
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
        this.#syncPlayButton(this.state.toggle());
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

      // The six chapters with no bundle are shown, disabled, rather than
      // hidden: the eight-chapter spine is the shape of the project, and a
      // selector that shows two would misrepresent it.
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
  }

  /** Reflect the date cursor. Called every frame; cheap on purpose. */
  syncDate(year) {
    const label = yearToLabel(year);
    if (this.dom.stamp.value !== label) this.dom.stamp.value = label;
    this.dom.scrub.value = String(Math.round(this.state.progress * SCRUB_STEPS));
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

  #syncPlayButton(playing = this.state.playing) {
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
  };
}
