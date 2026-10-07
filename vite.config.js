import { defineConfig } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * The generated chapter bundles live in `data/`, not in `public/`.
 *
 * They are build output rather than source, and `public/` is reserved for
 * assets that ship exactly as they are — fonts, textures, the favicon. In
 * development this needs nothing: Vite
 * serves the project root, so `/data/chapters/…` resolves. A production build
 * only knows about `public/` and the module graph, so the bundles have to be
 * copied in — which is all this plugin does.
 */
function copyGeneratedData() {
  return {
    name: 'us-palimpsest:copy-generated-data',
    apply: 'build',
    async closeBundle() {
      const from = path.join(root, 'data/chapters');
      if (!existsSync(from)) {
        this.warn('data/chapters is missing — run `npm run data:build` before building');
        return;
      }
      await cp(from, path.join(root, 'dist/data/chapters'), { recursive: true });
      await mkdir(path.dirname(path.join(root, 'dist/data')), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [copyGeneratedData()],
  server: {
    // The bundles sit outside `public/`, so the dev server has to be told the
    // project root is fair game.
    fs: { allow: [root] },
    host: '127.0.0.1',
  },
  build: {
    target: 'es2022',
    // Nothing here is an asset that benefits from being inlined as a data URI;
    // the payload is geometry and it is fetched at runtime.
    assetsInlineLimit: 0,
    sourcemap: true,
  },
});
