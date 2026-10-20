/* Every page of the site, in the order a visitor would meet them. Rollup uses
 * it to know what to build, the sitemap to know what to list, and the i18n
 * extractor to know what to read. */
export const PAGES = {
  home: 'index.html',
  products: 'products.html',
  services: 'services.html',
  solutions: 'solutions.html',
  terms: 'terms.html',
  privacy: 'privacy.html',
  'privacy-learngenie': 'privacy-learngenie.html',
  contact: 'contact.html',
  // where every form lands on success — its own URL, so the conversion is countable
  'thank-you': 'thank-you.html',
  // the branded 404 — hosts serve it for any address that does not resolve
  '404': '404.html',
  about: 'about.html',
  careers: 'careers.html',
  brochure: 'brochure.html',
  partners: 'partners.html',
  'case-study': 'case-study.html',
  // the blog, reached from the footer of every page
  'kc-blogs': 'knowledge-centre/blogs.html',
  // the services' own pages
  'service-cloud': 'services/cloud.html',
  // one page per product, sharing its body with the showroom's monitor
  'product-finexa': 'products/finexa.html',
  'product-finexa-nova': 'products/finexa-nova.html',
  'product-finexa-gennxt': 'products/finexa-gennxt.html',
  'product-finaware': 'products/finaware.html',
  'product-fiscus': 'products/fiscus.html',
  'product-learngenie': 'products/learngenie.html',
};
