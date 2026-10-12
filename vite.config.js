import { defineConfig } from 'vite';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { PAGES } from './scripts/pages.mjs';
import { walkHtml, LOCALES, UI_STRINGS } from './scripts/i18n.mjs';

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

/* =====================================================
 * i18n — the translated copies of every page
 * =====================================================
 * The site is written in English. This takes each page
 * the build has just finished — assets hashed, scripts
 * injected, includes expanded — walks its visible text
 * and writes the same page again under /hi/ and /mr/.
 *
 * Doing it here rather than in the browser means each
 * language is a real, crawlable page: Google indexes
 * /hi/solutions.html on its own, and a reader never sees
 * English flash past before a dictionary loads.
 *
 * Links inside the pages are relative, so a link to
 * products.html inside /hi/ lands on /hi/products.html
 * without being rewritten. Assets are absolute, so they
 * keep pointing at the one copy of each file.
 *
 * What is NOT translated: the labels drawn inside the 3D
 * scenes. Those are painted into canvas textures by the
 * scene modules and stay in English in every language.
 * ===================================================== */
function i18n() {
  const dicts = new Map();
  for (const loc of LOCALES) {
    const file = resolve(ROOT, `locales/${loc}.json`);
    dicts.set(loc, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
  }

  // the address a page has in a given language
  const locUrl = (page, loc) => {
    const path = page === 'index.html' ? '' : page;
    return loc === 'en' ? `${SITE}/${path}` : `${SITE}/${loc}/${path}`;
  };

  // one <link rel="alternate"> per language, for every version of the page
  const alternates = (page) =>
    ['en', ...LOCALES]
      .map((loc) => `  <link rel="alternate" hreflang="${loc === 'en' ? 'en-IN' : loc}" href="${locUrl(page, loc)}" />`)
      .join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${locUrl(page, 'en')}" />\n`;

  const addHead = (html, extra) =>
    html.includes('</head>') ? html.replace('</head>', `${extra}</head>`) : html;

  // Inter, Outfit and JetBrains Mono carry no Devanagari, so the Indian
  // languages ask for one more family — and only they do.
  const DEVANAGARI =
    '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400..700&display=swap" />\n';

  /** One page, in one language. Shared by the build and the dev server. */
  const translate = (html, loc, page) => {
    const dict = dicts.get(loc) || {};
    let out = walkHtml(html, (text) => dict[text] || null);
    out = out.replace(/<html([^>]*)\slang="[^"]*"/i, `<html$1 lang="${loc}"`);
    const here = locUrl(page, loc);
    out = out
      .replace(/(<link[^>]+rel="canonical"[^>]+href=")[^"]*(")/i, `$1${here}$2`)
      .replace(/(<meta[^>]+property="og:url"[^>]+content=")[^"]*(")/i, `$1${here}$2`)
      .replace(/(<meta[^>]+property="og:locale"[^>]+content=")[^"]*(")/i, `$1${loc}_IN$2`);

    // the strings JavaScript writes once the page is running
    const ui = {};
    for (const text of UI_STRINGS) if (dict[text]) ui[text] = dict[text];
    const inline = `  <script>window.__I18N=${JSON.stringify(ui).replace(/</g, '\\u003c')}</script>\n`;
    return addHead(out, DEVANAGARI + inline);
  };

  return {
    name: 'i18n',
    enforce: 'post',

    /* `apply: 'build'` would leave /hi/ a 404 while developing, so the dev
     * server answers those addresses itself: it reads the English page,
     * hands it to Vite to transform as usual, then translates it. The
     * dictionaries are re-read each time, so a translation shows up on
     * reload without restarting the server. */
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/(\w\w)\/(.*)$/.exec((req.url || '').split('?')[0]);
        if (!match || !LOCALES.includes(match[1])) return next();
        let page = match[2] || 'index.html';
        if (page.endsWith('/') || !page.includes('.')) page = `${page.replace(/\/$/, '')}/index.html`.replace(/^\//, '');
        const file = resolve(ROOT, page);
        if (!existsSync(file)) return next();
        try {
          const loc = match[1];
          dicts.set(loc, JSON.parse(readFileSync(resolve(ROOT, `locales/${loc}.json`), 'utf8')));
          const html = await server.transformIndexHtml(`/${page}`, readFileSync(file, 'utf8'), req.originalUrl);
          res.setHeader('Content-Type', 'text/html');
          res.end(translate(html, loc, page));
        } catch (err) {
          next(err);
        }
      });
    },
    generateBundle(options, bundle) {
      if (!LOCALES.length) return;
      const pages = Object.values(bundle).filter((a) => a.type === 'asset' && a.fileName.endsWith('.html'));

      for (const page of pages) {
        const english = String(page.source);
        page.source = addHead(english, alternates(page.fileName));

        for (const loc of LOCALES) {
          this.emitFile({
            type: 'asset',
            fileName: `${loc}/${page.fileName}`,
            source: addHead(translate(english, loc, page.fileName), alternates(page.fileName)),
          });
        }
      }
    },
  };
}

/* robots.txt and sitemap.xml, written at build time so the addresses in them
 * always match the site they were built for (SITE_URL, above). A page's
 * lastmod is the date its own file last changed. Note that a crawler only
 * reads robots.txt from the root of a domain, so on GitHub Pages — where the
 * site sits in a folder — the file is there for when this moves to
 * finlabsindia.org, while the sitemap can be submitted from anywhere. */
function sitemap() {
  const loc = (page, lang = 'en') => {
    const path = page === 'index.html' ? '' : page;
    return lang === 'en' ? `${SITE}/${path}` : `${SITE}/${lang}/${path}`;
  };
  return {
    name: 'sitemap',
    apply: 'build',
    generateBundle() {
      const urls = Object.values(PAGES)
        .flatMap((page) => {
          const when = statSync(resolve(ROOT, page)).mtime.toISOString().slice(0, 10);
          // every language of a page, each listing the others as alternates
          return ['en', ...LOCALES].map((lang) => {
            const alt = ['en', ...LOCALES]
              .map(
                (other) =>
                  `    <xhtml:link rel="alternate" hreflang="${other === 'en' ? 'en-IN' : other}" href="${loc(page, other)}" />`
              )
              .join('\n');
            return `  <url>\n    <loc>${loc(page, lang)}</loc>\n    <lastmod>${when}</lastmod>\n${alt}\n  </url>`;
          });
        })
        .join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
          `${urls}\n</urlset>\n`,
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
  plugins: [htmlIncludes(), themeBoot(), i18n(), sitemap()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(PAGES).map(([name, page]) => [name, resolve(ROOT, page)])
      ),
    },
  },
}));
