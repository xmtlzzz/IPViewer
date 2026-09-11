/* 校验 favicon 在真实浏览器里能作为图片加载，且不被 CSP 拦截 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9340;
const PROFILE = path.join(os.tmpdir(), 'ipv-fav-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (u) => (await fetch(u)).json();

(async () => {
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const url = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--disable-gpu', url], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { await j(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(200); } }
  let t;
  for (let i = 0; i < 100; i++) {
    const l = await j(`http://127.0.0.1:${PORT}/json/list`);
    t = l.find((x) => x.type === 'page' && x.url.includes('index.html'));
    if (t) break; await sleep(200);
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else if (m.method === 'Log.entryAdded') logs.push(m.params.entry);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await send('Runtime.enable');
  await send('Log.enable');
  await sleep(1500);

  const out = await ev(`(async function(){
    var href = document.querySelector('link[rel="icon"]').getAttribute('href');
    var img = new Image();
    var ok = await new Promise(function(res){ img.onload = function(){ res(true); }; img.onerror = function(){ res(false); }; img.src = href; });
    return { loaded: ok, w: img.naturalWidth, h: img.naturalHeight, scheme: href.split(':')[0] };
  })()`);
  console.log('favicon: ' + JSON.stringify(out));

  const bad = logs.filter((l) => l.level === 'error' || /Content Security Policy|Refused to/i.test(l.text || ''));
  console.log(bad.length ? '告警: ' + bad.map((b) => b.text).join(' | ').slice(0, 400) : '无 CSP/加载告警');

  const okAll = out.loaded === true && out.w === 32 && out.h === 32 && out.scheme === 'data' && bad.length === 0;
  console.log(okAll ? '\nOK  favicon 在浏览器中成功加载为 32x32 图片，且无 CSP 拦截' : '\nFAIL  favicon 校验未通过');
  child.kill();
  process.exit(okAll ? 0 : 1);
})();
