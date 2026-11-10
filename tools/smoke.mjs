// Smoke test: loads the studio, steps inside, sweeps hover, click-to-walk, day→night, music; screenshots + console problems.
// usage: node tools/smoke.mjs <url> <outdir>   (needs Chrome on port 9333, see CLAUDE.md)
import fs from 'node:fs';
const [url, out] = process.argv.slice(2);
const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const log = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
    log.push(`console.${m.params.type}: ${m.params.args.map(a => a.value ?? a.description).join(' ')}`);
  if (m.method === 'Runtime.exceptionThrown') log.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) log.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) log.push(`load failed: ${m.params.errorText}`);
  if (m.method === 'Network.responseReceived' && /\.m4a/.test(m.params.response.url)) log.push(`music: HTTP ${m.params.response.status} ${m.params.response.mimeType}`);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, pointerType: 'mouse' });

await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url });
const t0 = Date.now();
while (Date.now() - t0 < 90000 && !(await evalJs(`!!document.querySelector('#enter') && !document.querySelector('#enter').disabled`))) await wait(500);
log.push(`ready after ${((Date.now() - t0) / 1000).toFixed(1)} s; button: ${await evalJs(`document.querySelector('#enter').textContent`)}`);
await shot('1-intro');
await evalJs(`document.querySelector('#enter').click()`);
await wait(9000);
const mood = await evalJs(`document.querySelector('#mood-btn').textContent`);
log.push(`mood: ${mood}`);
if (mood.includes('Night')) { await evalJs(`document.querySelector('#mood-btn').click()`); await wait(4000); }
await shot('2-day');
log.push('stats (day):\n' + await evalJs(`document.querySelector('#stats')?.textContent`));

// hover over a grid: how many points find something clickable, and how long a pick takes
let hits = 0, n = 0;
for (let y = 150; y <= 600; y += 75) for (let x = 100; x <= 1180; x += 90) {
  await mouse('mouseMoved', x, y); await wait(40); n++;
  if (await evalJs(`document.querySelector('#scene canvas').classList.contains('hovering')`)) hits++;
}
log.push(`hover: ${hits}/${n} grid points over something clickable`);
await wait(1500);
log.push('stats (after hover sweep):\n' + await evalJs(`document.querySelector('#stats')?.textContent`));

// click-to-walk on the floor, bottom middle of the screen
await mouse('mouseMoved', 640, 690); await mouse('mousePressed', 640, 690); await mouse('mouseReleased', 640, 690);
await wait(2500);
await shot('3-after-walk');

// day -> night
await evalJs(`document.querySelector('#mood-btn').click()`);
await wait(4500);
await shot('4-night');
log.push('stats (after night switch):\n' + await evalJs(`document.querySelector('#stats')?.textContent`));

// music: the speaker's hotspot
const music = await evalJs(`(() => { const b = [...document.querySelectorAll('.hotspot')].find(b => /Music/.test(b.textContent)); if (!b) return 'no speaker hotspot visible'; b.click(); return 'clicked'; })()`);
await wait(3000);
log.push(`music button: ${music}; label now: ${await evalJs(`[...document.querySelectorAll('.hotspot')].map(b => b.textContent).filter(t => /♪|Music/.test(t)).join(' | ')`)}`);
log.push('hint: ' + await evalJs(`document.querySelector('#hint').textContent`));
console.log(log.join('\n'));
ws.close();
