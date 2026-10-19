# Finlabs website — implementation roadmap

Source: `Finlabs-website-page-inventory-reviewed.xlsx` (built 12 Oct 2026, reviewed).
Covers all 106 items: 242 marked copy rows, 29 Launch Fixes, 24 SEO/AIEO findings,
17 Lead Generation items, 15 Domain Authority levers, 17 DPDP requirements.

Item numbers (**#1**–**#106**) match the consolidated list. Every number appears
exactly once below, in the stage where it should be done.

## How to read this

Each line is `#N — what — who — blocked by`.

- **Me** = front-end work in this repo.
- **Leadership / Product / Sales / Legal / IT** = someone else has to answer first.
- Durations are working days of focused effort, not calendar time.

Two rules drive the whole order:

1. **Decisions before build.** Fifteen items are waiting on an answer from someone.
   Each one that arrives late forces rework in a page that has already been rewritten.
2. **Nothing that collects personal data ships before the notice that covers it.**
   Forms, analytics and cookies go live in the same release as the Privacy Notice,
   consent checkboxes and cookie banner — not before.

---

## Stage 0 — Decisions and accounts

**Blocks almost everything. Start today, chase daily.** No code.

| # | What | Who | Note |
|---|---|---|---|
| ~~#46a~~ | ~~Confirm the launch domain~~ — **DECIDED 19 Oct 2026: `finlabsindia.com`** | Leadership | Settled. `.org` stays registered and redirects page by page. Every canonical, sitemap entry and schema URL is built from this. |
| #47a | Choose the host | IT | Cloudflare Pages / Netlify / Vercel / own server. GitHub Pages cannot do server-side 301s or host a form backend, so this gates #40, #41, #45 and #59. |
| #18, #38 | Fiscus positioning | Leadership | Keep as B2C "Find an Advisor" lead source, reposition as an MFD engagement tool, or move down the product order. Changes Home (HOM-015), Products and the Fiscus page. |
| #10 | Which proof figures may be published | Rajan & Nimish | "Trusted by 10 of India's AMCs" and the MFD/AUM/IAP figure. Without these the new Home stats block cannot be finished. |
| #36 | Is the Finexa free trial real and offerable? | Sales | If yes it becomes the second CTA on the Finexa page. |
| #33 | The real answer to P-FX-163 (investor permission controls) | Product | Currently a duplicate of P-FX-161. |
| #34 | White-labelling: what is standard, what costs extra | Product | P-FX-159 and P-FX-175 contradict each other. |
| #35 | Does the ISO certification cover Finexa, and which standard? | Product | Needed next to the AES-GCM claim and on the Security page (#54). |
| #32 | Verify every About timeline date, ABT-033–062 | Marketing | Almost all fall on the 28th — looks like placeholder data. |
| #37 | Careers: "team of 8+" vs "teams of 6–10"; internship category and type | HR | |
| #56a | What returns from the Knowledge Centre | Leadership | Summariwise, FF11, calculators, quiz, infographics, downloads, Founder's Desk. Drives both the redirect map and Stage 6. |
| #81 | Pricing signal | Leadership | "Plans from ₹X/month", or "Transparent pricing, no commission on transactions — request a quote". |
| #50a | Brand assets | Design | Open Sans webfont files/licence, and the exact token values around #11568E / #9AD438. |
| #96a | Appoint the Grievance Officer | Legal / HR | Name, designation, and a working `privacy@finlabsindia.com`. Statutory, and blocks the Privacy Notice. |
| #101a | Vendor list and DPAs | Legal / IT | Zoho, Calendly, Google, Microsoft, Meta/WhatsApp, LinkedIn, host. |
| — | Zoho licences | IT | Forms, CRM, Bookings, Campaigns, SalesIQ. Gates all of Stage 7. |

---

## Stage 1 — Same-day fixes

**~1 day. No dependencies. Do these before anything else, because each one is
actively costing something right now.**

| # | What | Who |
|---|---|---|
| #48 | `noindex` (or password) on `dev-25.github.io` | Me — Google may already be indexing staging as a duplicate |
| #70 | Fix the Terms clause banning spiders/crawlers (TRM-032) | Me — it contradicts robots.txt and blocks AI citation |
| #86 | Delete the deep-link ban in the same clause | Me — it tells journalists not to link to product pages |
| #69 | Publish `/llms.txt` | Me — low effort, immediate AIEO gain |
| #84 | Record Moz DA, Ahrefs DR and referring domains for both domains | Marketing — **must happen before the migration** or the baseline is lost forever |

---

## Stage 2 — Platform foundations

**~3–5 days. Blocked by #46a and #47a.** Everything downstream assumes the final
domain and a host that can redirect.

| # | What | Who |
|---|---|---|
| #47 | Migrate hosting off GitHub Pages | IT + Me |
| #59 | Move to clean URLs (`/products/finexa/`) | Me — do it now, while every URL is changing anyway |
| #45 | Build the full redirect map from Search Console → Pages and the old WordPress sitemap | Me + Marketing |
| #46 | Implement page-to-page 301s `.org` → `.com` | Me — never redirect everything to the home page |

The redirect map in the workbook has seven rows marked "Decision needed"
(`/summariwises/`, `/ff11/`, `/financial-calculators-2/`, `/infographics/`,
`/download/`, `/article/`, and the Learngenie app privacy URL). They resolve from
#56a. The Learngenie one matters most: the app-store listings link to it, and the
listing breaks if it 404s.

---

## Stage 3 — Brand repaint

**~3–4 days. Blocked by #50a. Do it before the copy rewrites, not after.**

| # | What | Who |
|---|---|---|
| #50 | Open Sans + #11568E/#9AD438 across tokens, buttons, gradients and 3D materials; check contrast on #11568E | Me |
| #60 | Logos as SVG (PNGs are ~100 KB each) | Me + Design |

Brand touches CSS tokens; copy touches HTML text. They barely overlap, so they
*can* run in parallel — but every screenshot, review and sign-off during the copy
pass is wasted if the page is about to change colour and typeface.

---

## Stage 4 — Copy

**~8–12 days, the largest block. 242 marked rows plus 177 proofread corrections.**
Blocked by #14–#19 landing first, and by the Stage 0 answers for the flagged rows.

Work page by page, heaviest first, so the long tail doesn't hide the risk:

| # | Page | Marks | Who |
|---|---|---|---|
| #14–#19 | **Product naming, everywhere** — Finexa, GenNxt, Finaware, Learngenie, Fiscus, and programme/program | Me | Do this first: every page below depends on it |
| #1–#6 | Sitewide nav and footer | Me |
| #7–#13 | Home — new H1, lead, two-door CTAs, proof stats | Me — #10 and #18 gate the stats and the Fiscus line |
| #20 | Finexa — 34 rewrites, 1 delete, 5 checks | Me — #33–#36 gate five of them |
| #21 | Learngenie — 27 | Me |
| #22 | Terms & Conditions — 25 | Me + Legal |
| #23 | Finaware — 22 | Me |
| #24 | Products — 17 | Me |
| #25 | About Us — 13, incl. removing "Educate. Empower. Engage." | Me — #32 gates the timeline |
| #26 | Fiscus 12 · Blogs 11 · Privacy 9 · Learngenie privacy 8 · Services 6 · Careers 5 · Solutions 4 · Contact 4 · Partners 3 · Corporate Deck 2 · Case Studies 1 · GenNxt 1 | Me |
| #27–#31 | The nine deletions | Me |
| #39 | 177 proofread corrections (68 UK spelling, 36 grammar, 26 consistency, 17 punctuation, 14 typos, 11 accuracy, 5 legal) | Me |
| #58 | Trim 14 meta descriptions and 4 titles | Me |
| #66 | Rewrite the keyword-free H1s | Me |
| #71 | Answer-first 40–60 word openers on every product page | Me |

#27–#28 are partly deferred: the "Sending opens your email app" lines and the
Contact website field disappear when the forms are rebuilt in Stage 7. Delete the
copy now, rebuild the form then.

---

## Stage 5 — Structure and SEO

**~6–8 days. Mostly independent of Stage 4, can overlap it.**

| # | What | Who |
|---|---|---|
| #44 | Give all 36 blog articles their own URLs with Article schema, author, dates, related links, sitemap entries | Me — currently held as JSON and unindexable |
| #64 | Render case studies and Partners testimonials in HTML, each case study on its own URL | Me — AI crawlers don't run JS, so the best proof is invisible today |
| #65 | Cut the 8,217-word duplicate product content on `products.html` down to summaries that link out | Me |
| #67 | Alt text: 22 About team photos, 38 blog thumbnails, Cloud/Products/Finexa images | Me + Marketing |
| #68 | FAQPage on ~100 FAQs; BreadcrumbList sitewide; Article, Person, VideoObject, Review | Me |
| #62 | Plain scannable card/list view as the default on Products; 3D becomes an extra | Me |
| #61 | Shrink or hide the hero 3D below ~768px; respect `prefers-reduced-motion` everywhere | Me |
| #75a | Internal linking, breadcrumbs, "Related reading" | Me |
| #75b | Branded 404 with search and links to Products, Finexa, Contact | Me |
| #74 | Native-speaking finance editor reviews the 40 Hindi and Marathi pages | Marketing — **or `noindex` them until reviewed**; machine-sounding finance copy hurts trust |

---

## Stage 6 — New pages and proof

**~6–8 days. #51 and #54 are blocked by Stage 0 answers.**

| # | What | Who |
|---|---|---|
| #51 | Build `products/finexa-nova.html` from the workbook brief — hero, business case, ecosystem fit, 6 feature cards, security, white label, screens, proof, 5 FAQs, closing CTA; link from Finexa, Products, footer, Contact interest list | Me — FAQ answers and real screenshots from Product |
| #52 | Proof band after the hero: real client logos, 2–3 case-study outcomes, "Guided by" strip with 3–4 Board members | Me — needs #64 first |
| #53 | Outcome numbers on every case study, with client sign-off where named | Marketing + Me |
| #54 / #106 | Security & DPDP readiness page: ISO standard named, encryption, residency, access control, breach process, processor agreements | Me + Legal — one page serves both the institution sales path and due diligence |
| #55 | Finexa demo video and, if #36 confirms, the free-trial CTA | Me + Sales |
| #56 | Restore whatever #56a chose — calculators and downloads recommended as gated lead magnets | Me |
| #63 | Gate the 13.7 MB corporate deck behind a short form; keep the web version open | Me |

---

## Stage 7 — Lead capture and DPDP, as one release

**~8–10 days. Item #49 in the list is this whole stage.** These ship together or not at all — a Zoho form that collects
personal data without a notice and unbundled consent is the exact thing the Act
penalises.

### Capture

| # | What | Who |
|---|---|---|
| #40 | Every form submits to Zoho CRM with hidden page URL, UTM source/medium/campaign and lead type; thank-you page per form; auto-reply | Me + IT |
| #41 | Add forms where there are none: Home, Products, Finexa, every product page, Case Studies, Partners. MFD fields: name, mobile, email, city, ARN (optional), AUM band, current platform. Institution: name, work email, organisation, type, role, interest, timeline | Me |
| #42 | Split Calendly into Finexa demo / Institution discovery / Services consult, each routed and synced — or move to Zoho Bookings | IT |
| #76 | Zoho SalesIQ chat; tracked, pre-filled WhatsApp links | IT + Me |
| #77 | Separate the two journeys: MFD → Finexa → demo/trial; Institution → Solutions/case study → discovery call | Me |
| #78 | Offer ladder: demo video → trial → demo (MFD); IAP compliance checklist, cloud readiness assessment, security consult, case-study PDFs (institution) | Marketing |
| #79 | 4–5 field forms, one qualifier each; progressive profiling | Me |
| #80 | Proof beside every form: 3–4 logos, a testimonial, "No commission on your transactions", a privacy line | Me |
| #83 | Sticky bottom bar on mobile: "Book demo" + "WhatsApp" | Me |

### DPDP

| # | What | Who |
|---|---|---|
| #91 | Replace the Privacy Policy with a DPDP Privacy Notice — data/purpose/basis/retention table, rights, withdrawal, Board complaint route, named contact — in English, Hindi and Marathi, versioned and dated | Me + Legal |
| #92 | Two-line notice above the submit button on every form | Me |
| #93 | Unbundle consent: CON-031 currently bundles marketing into the enquiry. Separate unticked optional checkbox; log consent in Zoho with timestamp, form, page, notice version | Me + IT |
| #94 | One-click unsubscribe, "Your privacy choices" footer link, WhatsApp STOP, all synced to Zoho | IT + Me |
| #95 | Cookie banner with Google Consent Mode v2 — analytics and ads load only after opt-in | Me |
| #43 | GA4 + Search Console, LinkedIn Insight Tag, Clarity; conversions for form submit, booking, WhatsApp click, deck download, video play; GA4 linked to Zoho | Me + Marketing — **after #95**, not before |
| #96 | Publish the Grievance Officer on the Privacy Notice and Contact page; 90-day resolution | Legal |
| #97 | "Your data rights" section: Zoho request form, email identity check, request log, 7-day ack / 30-day response | Me + Legal |
| #98 | TLS 1.2+, HSTS, CSP, X-Frame-Options, MFA on Zoho, one-year logs | IT — penalty for failure is up to ₹250 crore |
| #99 | One-page breach response plan, tested annually | Legal + IT |
| #100 | Retention automation: unconverted enquiries at 24 months, CVs at 12 | IT |
| #101 | Sign vendor DPAs; use Zoho's India data centre; list vendors in the notice | Legal |
| #102 | State the site is not for under-18s; verifiable parental consent and no behavioural tracking for Learngenie students | Me + Product |
| #103 | Move CVs off the open `hr@` inbox into Zoho Recruit with a notice and 12-month retention | HR + Me |
| #104 | Rewrite the Learngenie app privacy notice to the same standard | Me + Legal |
| #105 | Data register, consent logs, annual training for marketing and sales | Legal |

The Act's notice, consent, security, breach, retention and rights obligations bite
from **13 May 2027** (consent-manager provisions 13 Nov 2026), but the IT Act 2000
and SPDI Rules 2011 already require a privacy policy and a grievance contact today —
and AMC/bank buyers will ask in due diligence long before 2027.

---

## Stage 8 — Launch cutover

**~2 days, plus a watching brief. One window, in this order.**

1. Final build on `finlabsindia.com` — canonicals, sitemap, hreflang and schema URLs all `.com` from the first byte.
2. Switch DNS; 301s live (#46).
3. Verify Search Console and Bing Webmaster Tools; submit both sitemaps; enable IndexNow (#75c).
4. Search Console → Change of Address.
5. Remove staging `noindex` from production only; keep it on staging.
6. Claim/refresh the Google Business Profile for the BKC office (#75d).
7. Keep `finlabsindia.org` registered and redirecting for at least two years.
8. Update every link you control: LinkedIn, YouTube, Instagram, X, email signatures, app-store listings, partner pages (#85).

Expect a ranking dip for a few weeks. That is normal for a domain move and is not
a signal to change anything.

---

## Stage 9 — After launch, ongoing

Nothing here blocks the launch. All of it compounds, so start in month one.

| # | What | Who | Cadence |
|---|---|---|---|
| #57 | Shift the content mix off retail personal finance (15 of 36 posts) toward MFD growth, IAP/investor education, regtech, cybersecurity, BFSI transformation | Marketing | Every new post |
| #73 | Landing pages for the searches buyers make: "mutual fund software for distributors", "MFD software India", "white label LMS India", "SEBI IAP guidelines", "NPS software", "family office software India"; plus comparison pages and a glossary | Marketing + Me | 1–2 a month |
| #72 | G2, Capterra, SoftwareSuggest, Techjockey profiles; Cafemutual and Wealth Forum pitches; MFD reviews. Test monthly whether Finlabs appears in ChatGPT/Gemini/Perplexity answers | Marketing | Monthly |
| #85 | Reclaim links pointing at old or broken URLs | Marketing | Month 1, then quarterly |
| #87 | Partner, client, award and event links — LSEG, Digio, Signzy, Thakral One, Nine Triangles, AAFM; D&B, Mint, IFTA, nasscom, MIT ADT; "Built by Finlabs" credits on client sites | BD | Month 1–3 |
| #88 | Monthly bylined columns in Cafemutual, Wealth Forum, ET BFSI, Moneycontrol, BusinessLine, Financial Express, using the Board's credentials | Marketing | Monthly |
| #89 | Annual "State of MFD technology in India" from anonymised Finexa/Finaware data; embeddable calculators with "Powered by Finlabs"; definitive guides; podcasts and webinars | Marketing + Me | Quarterly |
| #90 | **Avoid**: paid links, link exchanges, PBNs, bulk guest posts | — | Standing rule |
| #82 | Nurture sequences per audience, lead scoring, LinkedIn/Meta pixels behind consent, heatmaps, A/B tests on hero, CTA wording and form length | Marketing + IT | Month 2 on |
| #84b | Track DA, DR and referring domains against the Stage 1 baseline | Marketing | Monthly |

---

## Critical path

Everything else can slip without moving the launch date. These cannot:

```
#46a domain decision ─┐
#47a host decision  ──┴─→ #47 migrate → #45/#46 redirects ──┐
                                                            ├─→ Stage 8 launch
Zoho licences ─→ #40/#41 forms ─┬─→ Stage 7 release ────────┘
#96a Grievance Officer ─→ #91 notice ─┘
```

Four of those five are decisions, not work. If Stage 0 takes a week, the launch
moves a week — so chase the decisions harder than the code.

## What is not in this roadmap

- Effort for #53 (case-study outcome numbers) depends on what the clients will let you publish; it could be a day or a month of chasing.
- #74 assumes a finance editor can be found for Hindi and Marathi. If not, `noindex` is the honest fallback and costs 40 URLs of reach.
- #89's annual data report is a real editorial project, not a website task.
