// The side panel that opens for each object, filled from content.js
import P from '../content.js';
import { $, h } from '../util.js';
import { state } from '../core/state.js';
import { closeUp } from '../systems/player.js';
import { openViewer, disposeViewer } from './viewer.js';

const meta = item => [item.venue || item.issuer, item.year].filter(Boolean).join(' · ');
const thumb = (item, fallback) => item.image
  ? h('div', { class: 'thumb' }, h('img', { src: item.image, alt: item.title || '', loading: 'lazy' }))
  : h('div', { class: 'thumb', style: item.color ? `background: linear-gradient(135deg, ${item.color}, #fbf1ea)` : '' }, fallback);

function card(item, { image = true, linkText = 'Open' } = {}) {
  return h('article', { class: 'card' },
    image ? thumb(item, 'Add an image in content.js') : null,
    h('div', { class: 'body' },
      h('h3', {}, item.title || 'Untitled'),
      meta(item) ? h('div', { class: 'meta' }, meta(item)) : null,
      item.summary ? h('p', {}, item.summary) : null,
      item.tags?.length ? h('div', { class: 'tags' }, item.tags.map(t => h('span', { class: 'tag' }, t))) : null,
      h('div', { class: 'actions' }, item.link ? h('a', { class: 'small-btn', href: item.link, target: '_blank', rel: 'noopener' }, `${linkText} →`) : null)));
}

export const PANELS = {
  projects: { title: 'Projects', render: el => (P.projects || []).forEach(p => el.append(card(p, { linkText: 'View case study' }))) },
  articles: { title: 'Articles', render: el => (P.articles || []).forEach(a => el.append(card(a, { image: false, linkText: 'Read' }))) },
  certificates: { title: 'Certificates', render: el => el.append(h('div', { class: 'grid' }, (P.certificates || []).map(c => card(c)))) },
  garments: {
    title: 'CLO3D Garments',
    render: el => (P.garments || []).forEach(g => {
      const c = card(g);
      c.querySelector('.actions').append(h('button', { class: 'small-btn', onclick: () => openViewer(g, c.querySelector('.thumb')) }, 'View in 3D'));
      el.append(c);
    }),
  },
  // the paintings and the rug: picture, artist / origin line and a short text
  ...Object.fromEntries(Object.entries(P.artworks || {}).map(([k, a]) => [`art-${k}`, {
    title: a.title,
    render: el => el.append(
      a.image ? h('img', { class: 'art-img', src: a.image, alt: a.title }) : null,
      a.meta ? h('p', { class: 'art-meta' }, a.meta) : null,
      h('p', { class: 'art-text' }, a.text || '')),
  }])),
  exit: {
    title: 'Leave the studio?',
    render: el => el.append(
      h('p', { style: 'line-height:1.6; margin-top:0' }, 'The door leads back to my main site. Thanks for visiting!'),
      h('div', { class: 'actions' },
        h('a', { class: 'btn', href: P.homeUrl || '#' }, 'Back to my site'),
        h('button', { class: 'btn ghost', onclick: () => closePanel() }, 'Stay a little longer'))),
  },
};

export function openPanel(key) {
  disposeViewer();
  const def = PANELS[key];
  $('#panel-title').textContent = def.title;
  const body = $('#panel-body');
  body.replaceChildren();
  body.scrollTop = 0;
  def.render(body);
  state.panel = key;
  const panel = $('#panel');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  $('#panel-close').focus({ preventScroll: true });
}
export function closePanel() {
  disposeViewer();
  state.panel = null;
  closeUp.tk = 1; closeUp.tox = 0;
  const panel = $('#panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}
