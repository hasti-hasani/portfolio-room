export const $ = s => document.querySelector(s);
export const clamp01 = t => Math.min(1, Math.max(0, t));
export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Seeded random numbers, so the books, plants and garments look the same on every visit
export const seeded = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
// The shared sequence: the room is built in a fixed order, and each piece takes its numbers from here in turn
export const rnd = seeded(11);

// Small DOM builder: h('div', { class: 'x', onclick }, ...children)
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false && k !== '') el.append(k);
  return el;
}
