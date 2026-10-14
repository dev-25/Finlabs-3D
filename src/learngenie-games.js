/* =====================================================
 * LEARNGENIE — the five playable demos
 * =====================================================
 * The game cards on the Learngenie page open a modal and
 * run one of five formats, with the questions, scoring
 * and end screens the live platform uses:
 *
 *   crorepati — five questions, 20 seconds each, 200 XP a
 *               correct answer, certificate at four
 *   row       — six statements, right or wrong
 *   zipline   — five questions, the rider slides a little
 *               further along the line for each one right
 *   match     — five terms against their definitions
 *   scramble  — two words to rebuild from their letters
 *
 * The three formats still in build open the demo booking
 * instead. Called from product-page.js (the page of its
 * own) and product-viewport.js (the showroom's monitor).
 * ===================================================== */

import './learngenie-games.css';

const DEMO_URL = 'https://calendly.com/finlabsindia/book-a-call-on-teams';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------
// the content, as the platform asks it
// ---------------------------------------------------------------------

const QUIZ = [
  {
    q: 'What is NAV in the context of mutual funds?',
    opts: ['Net Annual Value', 'Net Asset Value', 'National Asset Value', 'Net Accrual Value'],
    ans: 1,
    exp: 'NAV (Net Asset Value) is the per-unit price of a mutual fund scheme.',
  },
  {
    q: 'Under which section of Income Tax Act can you claim deduction for ELSS investments?',
    opts: ['Section 80D', 'Section 80C', 'Section 24(b)', 'Section 10(10D)'],
    ans: 1,
    exp: 'Section 80C allows deduction up to Rs.1.5 lakh for ELSS investments.',
  },
  {
    q: 'If you invest Rs.10,000/month via SIP at 12% annual return for 20 years, approximately how much wealth do you accumulate?',
    opts: ['Rs.50 Lakh', 'Rs.75 Lakh', 'Rs.1 Crore', 'Rs.2.4 Crore'],
    ans: 2,
    exp: 'The power of compounding! Rs.10,000/month at 12% for 20 years ≈ Rs.1 Crore.',
  },
  {
    q: 'What is the full form of SID in mutual fund terminology?',
    opts: ['Scheme Information Document', 'Standard Investment Document', 'Securities Investment Deed', 'Scheme Index Data'],
    ans: 0,
    exp: 'SID (Scheme Information Document) contains complete details about a mutual fund scheme.',
  },
  {
    q: 'What is the minimum lock-in period for ELSS funds?',
    opts: ['1 year', '2 years', '3 years', '5 years'],
    ans: 2,
    exp: 'ELSS funds have a 3-year lock-in — the shortest of all Section 80C instruments.',
  },
];

const STATEMENTS = [
  { text: 'SEBI stands for Securities and Exchange Board of India.', correct: true, exp: "SEBI is India's capital market regulator, established in 1992." },
  { text: 'A Demat account can hold both equity shares and mutual fund units.', correct: true, exp: 'Demat accounts can hold various securities including shares, bonds, ETFs, and mutual fund units.' },
  { text: 'SIP investments are guaranteed to give positive returns.', correct: false, exp: 'SIPs do not guarantee returns. They are subject to market risk.' },
  { text: 'NPS (National Pension System) is open to all Indian citizens aged 18–70.', correct: true, exp: 'NPS is available for any Indian citizen between 18 and 70 years of age.' },
  { text: 'CDSL and NSDL are both depositories that hold securities in dematerialised form.', correct: true, exp: 'India has two depositories: CDSL (Central Depository Services) and NSDL (National Securities Depository).' },
  { text: 'Dividend from equity mutual funds is tax-free in the hands of the investor.', correct: false, exp: "Dividends from mutual funds are taxable as per the investor's income tax slab rate since 2020." },
];

const ZIPLINE = [
  { q: 'What is the maximum deduction allowed under Section 80C?', opts: ['Rs. 1 Lakh', 'Rs. 1.5 Lakh', 'Rs. 2 Lakh'], ans: 1 },
  { q: 'Which mutual fund category has the shortest lock-in period for tax saving?', opts: ['PPF', 'NSC', 'ELSS'], ans: 2 },
  { q: 'What happens if you stop a SIP midway?', opts: ['You lose all money', 'You pay a huge penalty', 'Your existing units remain invested'], ans: 2 },
  { q: 'What does "Liquid Fund" primarily invest in?', opts: ['Gold and Silver', 'Short-term debt instruments', 'High-risk stocks'], ans: 1 },
  { q: 'Who regulates mutual funds in India?', opts: ['RBI', 'SEBI', 'IRDAI'], ans: 1 },
];

const PAIRS = [
  { id: 1, term: 'SIP', def: 'Investing a fixed amount at regular intervals' },
  { id: 2, term: 'Compounding', def: 'Earning returns on your accumulated returns over time' },
  { id: 3, term: 'Rupee Cost Averaging', def: 'Buying more units when markets are down, fewer when up' },
  { id: 4, term: 'NAV', def: 'The per-unit market price of a mutual fund scheme' },
  { id: 5, term: 'ELSS', def: 'A tax-saving mutual fund with a 3-year lock-in period' },
];

const WORDS = [
  { word: 'BUDGET', hint: 'A plan for managing your income and expenses.' },
  { word: 'EQUITY', hint: 'Ownership interest in a company in the form of shares.' },
];

// ---------------------------------------------------------------------
// the modal, built once and reused
// ---------------------------------------------------------------------

let modal = null;
let box = null;
let onClose = null; // whatever the running game needs to stop

function ensureModal() {
  if (modal) return;
  modal = document.createElement('div');
  modal.className = 'lg-modal';
  modal.hidden = true;
  modal.innerHTML = '<div class="lg-modal__box" role="dialog" aria-modal="true" aria-label="Learngenie demo"></div>';
  box = modal.querySelector('.lg-modal__box');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
  document.body.append(modal);
}

function open() {
  ensureModal();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function close() {
  if (!modal) return;
  onClose?.();
  onClose = null;
  modal.hidden = true;
  box.innerHTML = '';
  document.body.style.overflow = '';
}

/** head + body, with the close button and an optional progress bar */
function paint({ tint, kicker, title, bar, body }) {
  box.innerHTML = `
    <div class="lg-modal__head"${tint ? ` style="background:${tint}"` : ''}>
      <button class="lg-modal__close" type="button" aria-label="Close">&times;</button>
      <p class="lg-modal__kicker">${kicker}</p>
      <p class="lg-modal__title">${title}</p>
      ${bar === undefined ? '' : `<div class="lg-modal__bar"><i style="width:${bar}%"></i></div>`}
    </div>
    <div class="lg-modal__body">${body}</div>`;
  box.querySelector('.lg-modal__close').addEventListener('click', close);
  box.scrollTop = 0;
  return box.querySelector('.lg-modal__body');
}

function endScreen({ tint, kicker, title, body }) {
  const el = paint({ tint, kicker, title, body: `<div class="lg-end">${body}
    <div class="lg-end__cta"${tint ? ` style="background:${tint}"` : ''}>
      <b>Want this for your team?</b>
      <a href="${DEMO_URL}" target="_blank" rel="noopener">🎯 Build This for My Organisation</a>
    </div></div>` });
  confetti(24);
  return el;
}

// ---------------------------------------------------------------------
// the small rewards
// ---------------------------------------------------------------------

const CONFETTI = ['#1b6098', '#3cdec2', '#2980e0', '#6fe7d0', '#22d3ee'];

function confetti(count) {
  if (REDUCED) return;
  const wrap = document.createElement('div');
  wrap.className = 'lg-confetti';
  wrap.setAttribute('aria-hidden', 'true');
  for (let k = 0; k < count; k++) {
    const piece = document.createElement('i');
    piece.style.left = `${10 + Math.random() * 80}%`;
    piece.style.top = '-14px';
    piece.style.background = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.append(piece);
  }
  document.body.append(wrap);
  setTimeout(() => wrap.remove(), 1600);
}

function xpFlash(text) {
  if (REDUCED) return;
  const el = document.createElement('div');
  el.className = 'lg-xp';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 1200);
}

function note(host, right, text) {
  const el = document.createElement('div');
  el.className = `lg-note lg-note--${right ? 'right' : 'wrong'}`;
  el.innerHTML = `<strong>${right ? '✅ Correct!' : '❌ Incorrect'}</strong><br/>${text}`;
  host.append(el);
}

// ---------------------------------------------------------------------
// 1 — Crorepati Finance Challenge
// ---------------------------------------------------------------------

function crorepati() {
  const state = { idx: 0, score: 0, xp: 0 };
  let tick = null;
  onClose = () => clearInterval(tick);

  function question() {
    const q = QUIZ[state.idx];
    const body = paint({
      kicker: '🏆 Crorepati Finance Challenge',
      title: `Q ${state.idx + 1} / ${QUIZ.length}`,
      bar: Math.round((state.idx / QUIZ.length) * 100),
      body: `
        <div class="lg-meta" style="margin:0 0 10px"><span>🧠 Financial Knowledge</span><span id="lgClock">20s</span></div>
        <div class="lg-timer"><i id="lgClockBar" style="width:100%"></i></div>
        <p class="lg-q">${q.q}</p>
        <div class="lg-opts">${q.opts.map((o, i) => `<button class="lg-opt" type="button" data-i="${i}">${o}</button>`).join('')}</div>
        <div class="lg-meta"><span>XP: <strong>${state.xp}</strong></span><span>Score: <strong>${state.score} / ${state.idx}</strong></span></div>`,
    });

    const opts = [...body.querySelectorAll('.lg-opt')];
    opts.forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.i))));

    let left = 20;
    clearInterval(tick);
    tick = setInterval(() => {
      left--;
      const clock = body.querySelector('#lgClock');
      const bar = body.querySelector('#lgClockBar');
      if (clock) clock.textContent = `${left}s`;
      if (bar) bar.style.width = `${(left / 20) * 100}%`;
      if (left <= 0) answer(-1); // out of time counts as a miss
    }, 1000);

    function answer(picked) {
      clearInterval(tick);
      const right = picked === q.ans;
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === q.ans) b.classList.add('is-right');
        else if (i === picked) b.classList.add('is-wrong');
      });
      if (right) {
        state.score++;
        state.xp += 200;
        xpFlash('+200 XP!');
        confetti(4);
      }
      note(body.querySelector('.lg-opts'), right, q.exp);
      setTimeout(() => {
        state.idx++;
        if (state.idx < QUIZ.length) question();
        else end();
      }, 1800);
    }
  }

  function end() {
    const pct = Math.round((state.score / QUIZ.length) * 100);
    const certified = state.score >= 4;
    endScreen({
      kicker: '🏆 Quiz Complete!',
      title: 'Crorepati Finance Challenge',
      body: `
        <div class="lg-end__ring" style="--p:${pct}%"><span>
          <span class="lg-end__score">${state.score}/${QUIZ.length}</span>
          <span class="lg-end__label">Score</span>
        </span></div>
        ${certified ? '<div class="lg-end__big">📜</div><p class="lg-end__line">Certificate Unlocked!</p>' : ''}
        <p>You scored <strong>${state.score} / ${QUIZ.length}</strong> and earned <strong>${state.xp} XP</strong>.
        ${certified ? 'Your digital certificate is ready.' : 'Keep practising to unlock your certificate!'}</p>`,
    });
  }

  question();
}

// ---------------------------------------------------------------------
// 2 — Right or Wrong
// ---------------------------------------------------------------------

const MINT = 'linear-gradient(135deg,#1b6098,#3cdec2)';

function rightOrWrong() {
  const state = { idx: 0, score: 0 };

  function card() {
    const stmt = STATEMENTS[state.idx];
    const body = paint({
      tint: MINT,
      kicker: '✅ Right or Wrong',
      title: `Statement ${state.idx + 1} of ${STATEMENTS.length}`,
      body: `
        <p class="lg-stmt">${stmt.text}</p>
        <div class="lg-rw">
          <button class="is-right" type="button" data-say="1">✅ Right</button>
          <button class="is-wrong" type="button" data-say="0">❌ Wrong</button>
        </div>
        <p class="lg-meta" style="justify-content:center">Score: <strong>${state.score}</strong> / ${state.idx}</p>`,
    });

    body.querySelectorAll('.lg-rw button').forEach((b) =>
      b.addEventListener('click', () => {
        const right = (b.dataset.say === '1') === stmt.correct;
        body.querySelectorAll('.lg-rw button').forEach((x) => (x.disabled = true));
        if (right) {
          state.score++;
          confetti(4);
        }
        note(body, right, stmt.exp);
        setTimeout(() => {
          state.idx++;
          if (state.idx < STATEMENTS.length) card();
          else end();
        }, 2000);
      })
    );
  }

  function end() {
    endScreen({
      tint: MINT,
      kicker: '✅ Round Complete!',
      title: 'Right or Wrong',
      body: `
        <div class="lg-end__big">📊</div>
        <p class="lg-end__line">${state.score} / ${STATEMENTS.length} Correct</p>
        <p>Great effort! Every correct answer improves your financial literacy score.</p>`,
    });
  }

  card();
}

// ---------------------------------------------------------------------
// 3 — Financial Quiz Challenge (Zipline Dash)
// ---------------------------------------------------------------------

const SKY = 'linear-gradient(135deg,#2980e0,#0ea5e9)';

function zipline() {
  const state = { idx: 0, score: 0 };

  function run() {
    const done = state.idx >= ZIPLINE.length;
    const pct = done ? 100 : (state.score / ZIPLINE.length) * 100;
    const q = done ? null : ZIPLINE[state.idx];
    const body = paint({
      tint: SKY,
      kicker: '🚠 Financial Quiz Challenge',
      title: 'Zipline Dash',
      body: `
        <div class="lg-track">
          <div class="lg-track__line"></div>
          <div class="lg-track__rider" style="left:calc(14px + ${pct}% - ${pct > 0 ? 24 : 0}px)">🛹</div>
          <div class="lg-track__goal${done ? ' is-reached' : ''}">🏆</div>
        </div>
        ${q
          ? `<p class="lg-q" style="text-align:center">${q.q}</p>
             <div class="lg-opts">${q.opts.map((o, i) => `<button class="lg-opt" type="button" data-i="${i}">${o}</button>`).join('')}</div>`
          : '<p class="lg-end__line" style="text-align:center;color:#10b981">Zipline Completed!</p>'}`,
    });

    if (done) {
      setTimeout(end, 800);
      return;
    }

    const opts = [...body.querySelectorAll('.lg-opt')];
    opts.forEach((b) =>
      b.addEventListener('click', () => {
        const picked = Number(b.dataset.i);
        opts.forEach((x, i) => {
          x.disabled = true;
          if (i === q.ans) x.classList.add('is-right');
          else if (i === picked) x.classList.add('is-wrong');
        });
        if (picked === q.ans) {
          state.score++;
          confetti(3);
        }
        setTimeout(() => {
          state.idx++;
          run();
        }, 1000);
      })
    );
  }

  function end() {
    endScreen({
      tint: SKY,
      kicker: '🏁 Finish Line!',
      title: 'Financial Quiz Challenge',
      body: `<div class="lg-end__big">🏆</div><p class="lg-end__line">Score: ${state.score} / ${ZIPLINE.length}</p>`,
    });
  }

  run();
}

// ---------------------------------------------------------------------
// 4 — SIP & Investment Challenge (match the following)
// ---------------------------------------------------------------------

const VIOLET = 'linear-gradient(135deg,#1b6098,#7c3aed)';

function match() {
  const terms = PAIRS.map((p) => ({ ...p, done: false }));
  const defs = PAIRS.map((p) => ({ ...p, done: false })).sort(() => Math.random() - 0.5);
  let pickedTerm = null;
  let pickedDef = null;
  let busy = false;

  function draw() {
    const body = paint({
      tint: VIOLET,
      kicker: '🔗 SIP &amp; Investment Challenge',
      title: 'Match the Following',
      body: `
        <p class="lg-meta" style="justify-content:center;margin:0 0 14px">Select a term on the left, then its matching definition on the right.</p>
        <div class="lg-match">
          <div class="lg-match__col" data-col="term">${terms
            .map((t) => `<button type="button" data-id="${t.id}" class="${t.done ? 'is-done' : ''}${pickedTerm === t.id ? ' is-picked' : ''}" ${t.done ? 'disabled' : ''}>${t.term}</button>`)
            .join('')}</div>
          <div class="lg-match__col" data-col="def">${defs
            .map((d) => `<button type="button" data-id="${d.id}" class="${d.done ? 'is-done' : ''}${pickedDef === d.id ? ' is-picked' : ''}" ${d.done ? 'disabled' : ''}>${d.def}</button>`)
            .join('')}</div>
        </div>`,
    });

    body.querySelectorAll('.lg-match button').forEach((b) =>
      b.addEventListener('click', () => {
        if (busy) return;
        const id = Number(b.dataset.id);
        if (b.closest('[data-col]').dataset.col === 'term') pickedTerm = id;
        else pickedDef = id;
        settle();
      })
    );
  }

  function settle() {
    draw();
    if (!pickedTerm || !pickedDef) return;
    busy = true;
    const hit = pickedTerm === pickedDef;
    setTimeout(() => {
      if (hit) {
        terms.find((t) => t.id === pickedTerm).done = true;
        defs.find((d) => d.id === pickedDef).done = true;
        confetti(5);
      } else {
        box.querySelectorAll('.lg-match .is-picked').forEach((el) => el.classList.add('is-miss'));
      }
      setTimeout(() => {
        pickedTerm = null;
        pickedDef = null;
        busy = false;
        if (terms.every((t) => t.done)) end();
        else draw();
      }, 500);
    }, 200);
  }

  function end() {
    endScreen({
      tint: VIOLET,
      kicker: '🏆 Challenge Complete!',
      title: 'SIP &amp; Investment Challenge',
      body: `<div class="lg-end__big">🧠</div><p class="lg-end__line">Perfect Match! +500 XP</p>
        <p>You successfully matched all fundamental investment concepts.</p>`,
    });
  }

  draw();
}

// ---------------------------------------------------------------------
// 5 — Budget Builder (word scramble)
// ---------------------------------------------------------------------

const EMBER = 'linear-gradient(135deg,#f43f5e,#fb923c)';

function scramble() {
  let level = 0;
  let slots = [];
  let letters = [];

  function start() {
    const { word } = WORDS[level];
    slots = Array(word.length).fill(null);
    letters = word
      .split('')
      .sort(() => Math.random() - 0.5)
      .map((char, id) => ({ id, char, used: false }));
    draw();
  }

  function draw(missed = false) {
    const lvl = WORDS[level];
    const body = paint({
      tint: EMBER,
      kicker: '💰 Budget Builder',
      title: `Word Scramble — Level ${level + 1}`,
      body: `
        <p class="lg-hint">${lvl.hint}</p>
        <div class="lg-slots${missed ? ' is-miss' : ''}">${slots
          .map((s, i) => (s ? `<button class="lg-slot is-filled" type="button" data-slot="${i}">${s.char}</button>` : '<span class="lg-slot"></span>'))
          .join('')}</div>
        <div class="lg-letters">${letters
          .map((l) => `<button type="button" data-letter="${l.id}" ${l.used ? 'disabled' : ''}>${l.char}</button>`)
          .join('')}</div>`,
    });

    body.querySelectorAll('[data-letter]').forEach((b) =>
      b.addEventListener('click', () => {
        const item = letters.find((l) => l.id === Number(b.dataset.letter));
        const free = slots.indexOf(null);
        if (!item || item.used || free === -1) return;
        slots[free] = item;
        item.used = true;
        check();
      })
    );
    body.querySelectorAll('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.slot);
        if (!slots[i]) return;
        slots[i].used = false;
        slots[i] = null;
        draw();
      })
    );
  }

  function check() {
    draw();
    if (slots.some((s) => s === null)) return;
    if (slots.map((s) => s.char).join('') === WORDS[level].word) {
      confetti(10);
      setTimeout(() => {
        level++;
        if (level < WORDS.length) start();
        else end();
      }, 1000);
    } else {
      draw(true);
      setTimeout(() => {
        slots.forEach((s) => s && (s.used = false));
        slots = slots.map(() => null);
        draw();
      }, 600);
    }
  }

  function end() {
    endScreen({
      tint: EMBER,
      kicker: '🏆 Master Builder!',
      title: 'Budget Builder',
      body: `<div class="lg-end__big">💰</div><p class="lg-end__line">All Words Solved! +600 XP</p>`,
    });
  }

  start();
}

// ---------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------

const GAMES = { crorepati, row: rightOrWrong, zipline, match, scramble };

/** Wires the cards inside `root`; safe to call again for the same root. */
export function wireGames(root = document) {
  root.querySelectorAll('[data-game]').forEach((card) => {
    if (card.dataset.wired) return;
    card.dataset.wired = 'on';
    card.addEventListener('click', () => {
      const game = GAMES[card.dataset.game];
      if (!game) return;
      open();
      game();
    });
  });
}
