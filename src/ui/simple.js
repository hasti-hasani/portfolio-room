// The plain 2D page: everything from content.js in one scroll. Only shown when the browser has no WebGL.
import P from '../content.js';
import { $, h } from '../util.js';
import { state } from '../core/state.js';
import { PANELS } from './panels.js';
import { disposeViewer } from './viewer.js';

export function openSimple(canReturn = true) {
  state.simple = true;
  const sections = ['projects', 'articles', 'certificates', 'garments'].map(key => {
    const s = h('section', {}, h('h2', {}, PANELS[key].title));
    PANELS[key].render(s);
    return s;
  });
  $('#simple-inner').replaceChildren(
    h('div', { class: 'simple-top' },
      h('div', {}, h('h1', {}, P.owner || 'Portfolio'), P.tagline ? h('p', {}, P.tagline) : null),
      canReturn ? h('button', { class: 'btn ghost', onclick: closeSimple }, 'Back to the studio') : null),
    ...sections);
  $('#simple').classList.remove('hidden');
  $('#simple').scrollTop = 0;
}
export function closeSimple() {
  disposeViewer();
  state.simple = false;
  $('#simple').classList.add('hidden');
}
