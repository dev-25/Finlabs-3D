import { defineConfig } from 'vite';
import { publicConfig } from './scripts/backend-config.mjs';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, sep } from 'node:path';
import { PAGES } from './scripts/pages.mjs';
import { walkHtml, LOCALES, UI_STRINGS } from './scripts/i18n.mjs';

const ROOT = __dirname;

/* Where the site is served from. Link previews need absolute addresses, so
 * pages write `{{site}}` and `{{url}}` and the build fills them in.
 *
 *   SITE_URL   the origin, for canonicals, og:url, the sitemap and llms.txt
 *   SITE_BASE  the path assets are served under
 *
 * GitHub Pages serves this project from a subfolder, so its build needs
 * base '/Finlabs-3D/'. S3 and CloudFront serve it from the root, so theirs
 * needs '/'. Getting that wrong does not fail the build — it ships a site
 * whose every stylesheet and script 404s — so both are set explicitly by
 * each deploy workflow rather than inferred here. */
const SITE = (process.env.SITE_URL || 'https://dev-25.github.io/Finlabs-3D').replace(/\/$/, '');
const BASE = process.env.SITE_BASE || null;

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

    /* A translated page is the English page copied one folder deeper, so a
     * relative link in it resolves one level short of where it did. Links
     * between pages are left alone on purpose — `../contact.html` from
     * /mr/products/ should reach the Marathi contact page, and it does. But
     * a file that only exists at the real site root (the favicons, the
     * brochure PDF) needs the extra step back, or it 404s on every page in
     * every language. */
    out = out.replace(
      /(\s(?:href|src)=")(?!\/|#|[a-z][a-z0-9+.-]*:|\/\/)([^"]+)(")/gi,
      (whole, open_, url, close) => (/\.html(?:[?#]|$)/i.test(url) ? whole : `${open_}../${url}${close}`)
    );

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
      // A page that says noindex has no business in the sitemap: Search Console
      // reports the pair as an error, and a confirmation page is not an entry
      // point anyway.
      const noindex = (page) =>
        /<meta name="robots" content="noindex/.test(readFileSync(resolve(ROOT, page), 'utf8'));

      const urls = Object.values(PAGES)
        .filter((page) => !noindex(page))
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
      // /llms.txt — a plain-language summary for AI answer engines, which
      // read a site far more cheaply from one file than from sixty pages.
      this.emitFile({
        type: 'asset',
        fileName: 'llms.txt',
        source: [
          '# Finlabs India',
          '',
          '> Finlabs India Pvt. Ltd. builds the platforms mutual fund distributors run their practice on, and the technology AMCs, banks, NBFCs and insurers use to take wealth, investor awareness and learning digital. Founded 2016, based in BKC, Mumbai.',
          '',
          '## Products',
          '- [Finexa](' + SITE + '/products/finexa.html): mutual fund distribution platform for MFDs and financial advisors — transactions on NSE Invest, BSE StAR MF and MF Utility, client portals, reporting and planning tools.',
          '- [Finexa Nova](' + SITE + '/products/finexa.html): the investor app that comes with Finexa — clients onboard themselves, track goals and portfolios, and transact under the distributor\'s brand.',
          '- [Finexa GenNxt](' + SITE + '/products/finexa-gennxt.html): multi-asset wealth management platform for wealth firms and family offices — aggregation, RM and client dashboards, analytics.',
          '- [Finaware](' + SITE + '/products/finaware.html): run, track and report Investor Awareness Programs end to end, with SEBI-aligned audit reports. Used by AMCs and regulated bodies.',
          '- [Learngenie](' + SITE + '/products/learngenie.html): AI-powered gamified learning platform for employees, partners and channels, in any sector. White-labelled, with HR integration.',
          '- [Fiscus](' + SITE + '/products/fiscus.html): personal finance app — bank accounts, cards and e-wallets tracked in one place without sharing passwords.',
          '',
          '## Solutions',
          '- [All six](' + SITE + '/solutions.html): cloud, website and app development, robo-advisory, data analytics and visualisation, document management, regulatory compliance automation.',
          '- [Cloud](' + SITE + '/services/cloud.html): AWS, Azure and Google Cloud migration and architecture for financial institutions.',
          '',
          '## Services',
          '- [Consulting and engineering](' + SITE + '/services.html): UI/UX consulting, application and infrastructure audits, cybersecurity, cloud architecture review, digital transformation strategy.',
          '',
          '## About',
          '- [The company](' + SITE + '/about.html): ten years, ISO certified since 2021, 100+ partners across markets, data and technology. Board includes a former PFRDA Chairman and a former MD & CEO of CARE Ratings.',
          '- [Case studies](' + SITE + '/case-study.html): delivery for AMCs, NBFCs and insurers.',
          '- [Partners](' + SITE + '/partners.html): LSEG, BSE, Digio, Signzy, Thakral One, Nine Triangles, AAFM and others.',
          '- [Knowledge Centre](' + SITE + '/knowledge-centre/blogs.html): writing on mutual fund distribution, investor awareness and wealth technology.',
          '',
          '## Contact',
          '- [Talk to us](' + SITE + '/contact.html) · info@finlabsindia.com · WeWork, Enam Sambhav, 10th Floor, G Block, BKC, Mumbai 400051',
          '',
          '## Policies',
          '- [Privacy Notice](' + SITE + '/privacy.html) — DPDP Act 2023',
          '- [Terms & Conditions](' + SITE + '/terms.html)',
          '',
          'The site is also published in Hindi (/hi/) and Marathi (/mr/).',
          '',
        ].join('\n'),
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
  base: BASE ?? (command === 'build' || isPreview ? '/Finlabs-3D/' : '/'),
  plugins: [htmlIncludes(), themeBoot(), i18n(), sitemap()],
  // Only the public half of backend.config.json reaches the browser: the API
  // URL and the Turnstile site key, both of which are meant to be read by
  // anyone. Table names, buckets and recipients stay server-side.
  define: { __BACKEND__: JSON.stringify(publicConfig()) },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(PAGES).map(([name, page]) => [name, resolve(ROOT, page)])
      ),
    },
  },
}));
