// Add ?stats to the address to see what this device is doing: frame rate, the slowest frames and what was going on
// in them, and how much is drawn. Only for finding problems; visitors never see it.
import { state } from '../core/state.js';
import { renderer } from '../core/renderer.js';

export const statsOn = new URLSearchParams(location.search).has('stats');
let el = null;
const st = { t: 0, frames: 0, drawn: 0, worst: 0, js: 0, hitches: 0, last: [] };

export function trackStats(raw, drawn, js, shadowRedraw) {
  el ||= document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'stats' }));
  st.t += raw; st.frames++; st.js = Math.max(st.js, js);
  if (drawn) st.drawn++;
  // a long gap between two frames while walking or turning is a visible jerk
  if (raw > 0.05 && drawn && state.mode === 'play') {
    st.hitches++;
    st.last.unshift(`${Math.round(raw * 1000)} ms${shadowRedraw ? ' (shadows redrawn)' : ''}${js > 16 ? ` (code ${Math.round(js)} ms)` : ''}`);
    st.last.length = Math.min(st.last.length, 3);
  }
  st.worst = Math.max(st.worst, raw);
  if (st.t < 1) return;
  const i = renderer.info.render, gl = renderer.getContext();
  const gpu = gl.getExtension('WEBGL_debug_renderer_info');
  el.textContent = [
    `fps ${Math.round(st.frames / st.t)}  (drawn ${st.drawn})   slowest frame ${Math.round(st.worst * 1000)} ms`,
    `code per frame up to ${st.js.toFixed(1)} ms`,
    `jerks while moving: ${st.hitches}${st.last.length ? '   last: ' + st.last.join(', ') : ''}`,
    `draw calls ${i.calls}   triangles ${Math.round(i.triangles / 1000)}k`,
    `resolution ${Math.round(renderer.getPixelRatio() * 100)}%  ${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`,
    gpu ? gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL).slice(0, 60) : '',
  ].join('\n');
  st.t = st.frames = st.drawn = st.worst = st.js = 0;
}
