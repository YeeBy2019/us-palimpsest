/**
 * Loading chapter bundles.
 *
 * The quick tier is defined here: the current chapter's geometry, and nothing
 * else. The rest streams in behind it while the viewer is already reading the
 * first one, which is what lets the M0 shot be on screen in the time it takes
 * to fetch one 30 KB gzipped file.
 */

import { decodeArcs } from '../lib/topojson.js';

/** Bundles already asked for. Caching the *promise* means two callers racing
 *  for the same chapter cause one fetch, not two. */
const pending = new Map();

/**
 * @param {string} id  chapter id, e.g. `division`
 * @returns {Promise<{id: string, meta: object, geometries: object[], arcs: number[][][]}>}
 */
export function loadChapter(id) {
  const existing = pending.get(id);
  if (existing) return existing;

  const promise = (async () => {
    const url = `${import.meta.env.BASE_URL}data/chapters/${id}.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `could not load chapter "${id}" (${response.status}). Run \`npm run data:build\` first.`,
      );
    }
    const bundle = await response.json();
    return {
      id,
      meta: bundle.meta,
      sheet: bundle.meta.sheet,
      geometries: bundle.objects.states.geometries,
      arcs: decodeArcs(bundle),
    };
  })();

  pending.set(id, promise);
  // A failed load must not be cached, or a retry would replay the same error.
  promise.catch(() => pending.delete(id));
  return promise;
}

/** Warm a chapter in the background without caring whether it arrives. */
export function prefetchChapter(id) {
  loadChapter(id).catch(() => {});
}
