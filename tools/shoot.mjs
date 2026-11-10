// Loads the studio, steps inside, screenshots day and night from the starting spot. usage: node shoot.mjs <url> <out-prefix>
import fs from 'node:fs';
const [url, out] = process.argv.slice(2);
const page = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 200));
  else if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => fs.writeFileSync(`${out}-${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
await send('Runtime.enable'); await send('Page.enable');
const t0 = Date.now();
await send('Page.navigate', { url });
await wait(300);
while (Date.now() - t0 < 90000 && !(await evalJs(`!!document.querySelector('#enter') && !document.querySelector('#enter').disabled`))) await wait(200);
console.log(`ready after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await wait(500); await shot('0-intro');
await evalJs(`document.querySelector('#enter').click()`);
await wait(8000);
const mood = () => evalJs(`document.querySelector('#mood-btn').textContent`);
if ((await mood()).includes('Night')) { await evalJs(`document.querySelector('#mood-btn').click()`); await wait(4000); }
await shot('1-day');
await evalJs(`document.querySelector('#mood-btn').click()`); await wait(4000);
await shot('2-night');
console.log((await evalJs(`document.querySelector('#stats')?.textContent`)) || '');
console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no console errors');
ws.close();
