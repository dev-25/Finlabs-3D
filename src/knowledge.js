import './kc-ui.js';
import { buildKnowledgeScene } from './kc-scene.js';

/* =====================================================
 * KNOWLEDGE CENTRE — the hub page
 * =====================================================
 * The 3D stand and the three section cards light each
 * other up; the topic list filters by section.
 * ===================================================== */

const PAGES = {
  blogs: 'knowledge-centre/blogs.html',
  infographics: 'knowledge-centre/infographics.html',
  summariwise: 'knowledge-centre/summariwise.html',
};
const doors = [...document.querySelectorAll('.kc-door')];
const stage = document.querySelector('.kc-hero__stage');

function light(id) {
  doors.forEach((d) => d.classList.toggle('is-lit', d.dataset.door === id));
}

const scene = stage
  ? buildKnowledgeScene(stage, {
      onPick: (id) => (location.href = PAGES[id]),
      onHover: light,
    })
  : null;

doors.forEach((door) => {
  const id = door.dataset.door;
  door.addEventListener('pointerenter', () => scene?.highlight(id));
  door.addEventListener('pointerleave', () => scene?.highlight(null));
  door.addEventListener('focusin', () => scene?.highlight(id));
  door.addEventListener('focusout', () => scene?.highlight(null));
});

// topics: show one section's topics, or all of them
const kinds = [...document.querySelectorAll('.kc-topics__filter [data-kind]')];
const topics = [...document.querySelectorAll('.kc-topics__list li')];
kinds.forEach((btn) =>
  btn.addEventListener('click', () => {
    const kind = btn.dataset.kind;
    kinds.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    topics.forEach((li) => (li.hidden = kind !== 'all' && li.firstElementChild.dataset.kind !== kind));
  })
);
