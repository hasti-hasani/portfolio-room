// Startup profile: CPU time by function until "Step inside" is enabled, network timings, error stacks.
// usage: node profile.mjs <url>
const [url] = process.argv.slice(2);
const page = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const log = []; const reqs = new Map(); let t0 = 0;
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  const p = m.params;
  if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error')
    log.push(`console.error: ${p.args.map(a => a.value ?? a.description).join(' ').slice(0, 150)}\n   at ${(p.stackTrace?.callFrames || []).slice(0, 8).map(f => `${f.functionName || '?'} (${f.url.split('/').pop()}:${f.lineNumber})`).join(' < ')}`);
  if (m.method === 'Network.requestWillBeSent') reqs.set(p.requestId, { url: p.request.url, start: p.timestamp });
  if (m.method === 'Network.loadingFinished' && reqs.has(p.requestId)) {
    const r = reqs.get(p.requestId); r.end = p.timestamp; r.size = p.encodedDataLength;
  }
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
const wait = ms => new Promise(r => setTimeout(r, ms));

await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable'); await send('Profiler.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Profiler.setSamplingInterval', { interval: 500 });
await send('Page.navigate', { url: 'about:blank' }); await wait(500);
await send('Profiler.start');
const tStart = Date.now();
await send('Page.navigate', { url });
while (Date.now() - tStart < 90000 && !(await evalJs(`!!document.querySelector('#enter') && !document.querySelector('#enter').disabled`))) await wait(250);
const ready = (Date.now() - tStart) / 1000;
const prof = (await send('Profiler.stop')).result.profile;

// self time per function
const dt = new Map(); const byId = new Map(prof.nodes.map(n => [n.id, n]));
prof.samples.forEach((s, i) => dt.set(s, (dt.get(s) || 0) + (prof.timeDeltas[i] || 0)));
const self = new Map();
for (const [nid, us] of dt) {
  const f = byId.get(nid).callFrame;
  const key = `${f.functionName || '(anon)'}  ${f.url.split('/').pop()}:${f.lineNumber}`;
  self.set(key, (self.get(key) || 0) + us);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
log.push(`ready after ${ready.toFixed(1)} s; profiled ${(total / 1e6).toFixed(1)} s`);
log.push('top self time:');
[...self].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, us]) => log.push(`  ${(us / 1000).toFixed(0).padStart(6)} ms  ${k}`));
log.push(`stats: ${await evalJs(`document.querySelector('#stats')?.textContent.split('\\n').find(l => l.startsWith('startup'))`)}`);
const all = [...reqs.values()].filter(r => r.end);
t0 = Math.min(...all.map(r => r.start));
log.push('network (start → end, s from first request):');
all.sort((a, b) => a.start - b.start).forEach(r => log.push(`  ${(r.start - t0).toFixed(2).padStart(6)} → ${(r.end - t0).toFixed(2).padStart(6)}  ${String(Math.round(r.size / 1024)).padStart(5)} KB  ${r.url.replace(/^https?:\/\/[^/]+\//, '').slice(0, 80)}`));
console.log(log.join('\n'));
ws.close();
