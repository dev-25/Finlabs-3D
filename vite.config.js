import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';

const ROOT = __dirname;

/* Where the site is served from. Link previews need absolute addresses, so
 * pages write `{{site}}` and `{{url}}` and the build fills them in. Point it
 * at the real domain when the site moves:
 *   SITE_URL=https://finlabsindia.org npm run build */
const SITE = (process.env.SITE_URL || 'https://dev-25.github.io/Finlabs-3D').replace(/\/$/, '');

/* HTML includes: `<!-- include: src/partials/x.html -->` is replaced by that
 * file, so one piece of markup can serve several pages. It runs before Vite
 * reads the page, so the included markup's images get the same treatment
 * as the page's own. `{{root}}` in any page becomes the path back to the
 * site root ('' at the top level, '../' one folder down), for site links
 * in markup shared between folders. */
function htmlIncludes() {
  const INCLUDE = /<!--\s*include:\s*([\w./-]+)\s*(\|\s*demote\s*)?-->/g;
  const expand = (html, depth = 0) => {
    if (depth > 8) throw new Error('html-includes: includes nested too deep');
    return html.replace(INCLUDE, (_, file, demote) => {
      const part = expand(readFileSync(resolve(ROOT, file), 'utf8'), depth + 1);
      // `| demote` turns the included page's h1 into an h2, for a page that
      // already has an h1 of its own — the showroom's monitor, say
      return demote ? part.replace(/<h1(\s|>)/g, '<h2$1').replace(/<\/h1>/g, '</h2>') : part;
    });
  };
  return {
    name: 'html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = ctx.filename ? relative(ROOT, ctx.filename) : ctx.path.replace(/^\//, '');
        const up = dirname(page).split(sep).filter((part) => part && part !== '.').length;
        return expand(html)
          .replaceAll('{{root}}', '../'.repeat(up))
          .replaceAll('{{site}}', SITE)
          .replaceAll('{{url}}', page === 'index.html' ? `${SITE}/` : `${SITE}/${page.split(sep).join('/')}`);
      },
    },
    // partials aren't in Vite's module graph, so reload the page when one changes
    configureServer(server) {
      server.watcher.add(resolve(ROOT, 'src/partials'));
      server.watcher.on('change', (file) => {
        if (file.includes(`${sep}src${sep}partials${sep}`)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

// GitHub Pages serves this project at https://dev-25.github.io/Finlabs-3D/,
// so production URLs need that prefix. The dev server keeps serving from /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/Finlabs-3D/' : '/',
  plugins: [htmlIncludes()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(ROOT, 'index.html'),
        products: resolve(ROOT, 'products.html'),
        services: resolve(ROOT, 'services.html'),
        solutions: resolve(ROOT, 'solutions.html'),
        terms: resolve(ROOT, 'terms.html'),
        privacy: resolve(ROOT, 'privacy.html'),
        'privacy-learngenie': resolve(ROOT, 'privacy-learngenie.html'),
        contact: resolve(ROOT, 'contact.html'),
        about: resolve(ROOT, 'about.html'),
        careers: resolve(ROOT, 'careers.html'),
        'knowledge-centre': resolve(ROOT, 'knowledge-centre.html'),
        // the Knowledge Centre's three sections
        'kc-blogs': resolve(ROOT, 'knowledge-centre/blogs.html'),
        'kc-infographics': resolve(ROOT, 'knowledge-centre/infographics.html'),
        'kc-summariwise': resolve(ROOT, 'knowledge-centre/summariwise.html'),
        // one page per product, sharing its body with the showroom's monitor
        'product-finexa': resolve(ROOT, 'products/finexa.html'),
        'product-finexa-gennxt': resolve(ROOT, 'products/finexa-gennxt.html'),
        'product-finaware': resolve(ROOT, 'products/finaware.html'),
        'product-fiscus': resolve(ROOT, 'products/fiscus.html'),
        'product-learngenie': resolve(ROOT, 'products/learngenie.html'),
      },
    },
  },
}));
