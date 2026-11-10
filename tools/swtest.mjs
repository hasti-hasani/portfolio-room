// First visit (clean), then a repeat visit: HDRI request count, what the service worker served, timings, console problems.
const origin = 'http://localhost:4173';
const page = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); let visit = null;
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (!visit) return;
  const p = m.params;
  if (m.method === 'Network.responseReceived') {
    visit.responses++;
    if (p.response.fromServiceWorker) visit.fromSW++;
    if (/\.hdr/.test(p.response.url)) visit.hdr.push(`${p.response.url.split('/').pop()} ${p.response.status}${p.response.fromServiceWorker ? ' (sw)' : ''}${p.response.fromDiskCache ? ' (disk)' : ''}`);
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) visit.console.push(`${p.type}: ${p.args.map(a => a.value ?? a.description).join(' ').slice(0, 160)}`);
  if (m.method === 'Runtime.exceptionThrown') visit.console.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 200));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
const wait = ms => new Promise(r => setTimeout(r, ms));
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'about:blank' }); await wait(500);
await send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
await send('Network.clearBrowserCache');

async function go(name) {
  visit = { responses: 0, fromSW: 0, hdr: [], console: [] };
  const t0 = Date.now();
  await send('Page.navigate', { url: `${origin}/` });
  await wait(300);
  while (Date.now() - t0 < 90000 && !(await evalJs(`!!document.querySelector('#enter') && !document.querySelector('#enter').disabled`))) await wait(200);
  const ready = ((Date.now() - t0) / 1000).toFixed(1);
  await wait(25000);   // let the worker register and cache, and the late files arrive
  const sw = await evalJs(`navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? 'active' : 'installing') + (navigator.serviceWorker.controller ? ', controls page' : ', not controlling yet') : 'none')`);
  const cached = await evalJs(`caches.open('studio-v1').then(c => c.keys()).then(k => k.length + ' files: ' + k.map(r => r.url.split('/').slice(-2).join('/')).slice(0, 40).join(' '))`);
  console.log(`--- ${name}: ready after ${ready} s; ${visit.responses} responses, ${visit.fromSW} from the service worker\n  hdr: ${visit.hdr.join(' | ')}\n  worker: ${sw}\n  cache: ${cached}\n  ${visit.console.length ? visit.console.join('\n  ') : 'no console errors or warnings'}`);
}
await go('first visit');
await go('repeat visit');
ws.close();
