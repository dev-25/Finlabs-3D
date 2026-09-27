import { defineConfig } from 'vite';
import { readFileSync, statSync } from 'node:fs';
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

/* The saved light/dark choice, applied before the first paint. src/theme.js
 * only runs once the page has loaded, so without this a visitor in dark mode
 * sees every page flash light first. Every page gets it at the top of its
 * <head>; keep the key and the fallback in step with src/theme.js. */
const THEME_BOOT = `(function () {
  var t;
  try { t = localStorage.getItem('finlabs-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
})();`;

function themeBoot() {
  const CHARSET = /<meta charset=[^>]*>/i;
  return {
    name: 'theme-boot',
    transformIndexHtml(html) {
      // straight after the charset, which should stay first in the <head>
      if (CHARSET.test(html)) return html.replace(CHARSET, (tag) => `${tag}\n  <script>${THEME_BOOT}</script>`);
      return [{ tag: 'script', children: THEME_BOOT, injectTo: 'head-prepend' }];
    },
  };
}

/* Every page of the site, in the order a visitor would meet them. Rollup uses
 * it to know what to build; the sitemap uses it to know what to list. */
const PAGES = {
  home: 'index.html',
  products: 'products.html',
  services: 'services.html',
  solutions: 'solutions.html',
  terms: 'terms.html',
  privacy: 'privacy.html',
  'privacy-learngenie': 'privacy-learngenie.html',
  contact: 'contact.html',
  about: 'about.html',
  careers: 'careers.html',
  refer: 'refer.html',
  'knowledge-centre': 'knowledge-centre.html',
  // the Knowledge Centre's four sections
  'kc-blogs': 'knowledge-centre/blogs.html',
  'kc-infographics': 'knowledge-centre/infographics.html',
  'kc-summariwise': 'knowledge-centre/summariwise.html',
  'kc-sip': 'knowledge-centre/sip-calculator.html',
  'kc-lumpsum': 'knowledge-centre/lumpsum-calculator.html',
  // the services' own pages
  'service-cloud': 'services/cloud.html',
  // one page per product, sharing its body with the showroom's monitor
  'product-finexa': 'products/finexa.html',
  'product-finexa-gennxt': 'products/finexa-gennxt.html',
  'product-finaware': 'products/finaware.html',
  'product-fiscus': 'products/fiscus.html',
  'product-learngenie': 'products/learngenie.html',
};

/* robots.txt and sitemap.xml, written at build time so the addresses in them
 * always match the site they were built for (SITE_URL, above). A page's
 * lastmod is the date its own file last changed. Note that a crawler only
 * reads robots.txt from the root of a domain, so on GitHub Pages — where the
 * site sits in a folder — the file is there for when this moves to
 * finlabsindia.org, while the sitemap can be submitted from anywhere. */
function sitemap() {
  const loc = (page) => (page === 'index.html' ? `${SITE}/` : `${SITE}/${page}`);
  return {
    name: 'sitemap',
    apply: 'build',
    generateBundle() {
      const urls = Object.values(PAGES)
        .map((page) => {
          const when = statSync(resolve(ROOT, page)).mtime.toISOString().slice(0, 10);
          return `  <url>\n    <loc>${loc(page)}</loc>\n    <lastmod>${when}</lastmod>\n  </url>`;
        })
        .join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
      });
    },
  };
}

// GitHub Pages serves this project at https://dev-25.github.io/Finlabs-3D/,
// so production URLs need that prefix. The dev server keeps serving from /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/Finlabs-3D/' : '/',
  plugins: [htmlIncludes(), themeBoot(), sitemap()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(PAGES).map(([name, page]) => [name, resolve(ROOT, page)])
      ),
    },
  },
}));
