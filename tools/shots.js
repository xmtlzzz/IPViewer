/* 截图验证 UI：导入向导映射步骤、IP 详情面板（含掩码）、导出菜单、华为导入后的网段列表 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9335;
const ROOT = path.join(__dirname, '..');
const XLSX = process.argv[2];
const OUT = path.join(os.tmpdir(), 'ipv-shots');
const PROFILE = path.join(os.tmpdir(), 'ipv-shot-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (u) => (await fetch(u)).json();

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const b64 = fs.readFileSync(XLSX).toString('base64');
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?selftest';
  const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1000', url], { stdio: 'ignore' });

  for (let i = 0; i < 100; i++) { try { await j(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(200); } }
  let target;
  for (let i = 0; i < 100; i++) {
    const l = await j(`http://127.0.0.1:${PORT}/json/list`);
    target = l.find((x) => x.type === 'page' && x.url.includes('index.html'));
    if (target) break; await sleep(200);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    console.log('shot: ' + name);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(1400);
  await ev(`document.getElementById('selftest').remove()`);

  // 1. 导入向导：映射步骤（先"重新映射"跳过预设确认）
  await ev(`(async function(){
    var bin = atob("${b64}"); var u8 = new Uint8Array(bin.length);
    for (var i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
    var wb = await __test.IO.Xlsx.read(u8.buffer);
    __test.Store.state.data.subnets = [];
    __test.Wizard.start([wb.sheets[0]]);
    var cf = document.getElementById('confirm');
    if (cf.open) cf.querySelector('#cf-foot .btn').click();  // 取消/重新映射
    return true;
  })()`);
  await sleep(600);
  await shot('01-wizard-mapping');

  // 2. 选好映射 → 进入合并 → 导入
  await ev(`(function(){
    var next = document.getElementById('w-foot').querySelector('.btn.primary');
    next.click();  // collectMap → stepMerge
    document.getElementById('w-foot').querySelector('.btn.primary').click(); // run
    __test.Store.act('subnet-select', __test.Store.state.data.subnets[0].id);
    return __test.Store.state.data.subnets.length;
  })()`);
  await sleep(900);
  await shot('02-after-import');

  // 3. IP 详情面板（含掩码字段）
  await ev(`(function(){
    var s = __test.Store.state.data.subnets[0];
    var ip = Object.keys(s.ips)[0];
    __test.Store.act('open-panel', ip);
    return ip;
  })()`);
  await sleep(500);
  await shot('03-panel-mask');

  // 4. 导出菜单（含华为格式）
  await ev(`(function(){
    __test.Store.act('close-panel');
    var btn = document.querySelector('[data-action="export-table"]');
    var r = btn.getBoundingClientRect();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left, clientY: r.bottom }));
    return true;
  })()`);
  await sleep(500);
  await shot('04-export-menu');

  // 5. 暗色主题下的面板
  await ev(`(function(){ __test.Store.act('close-panel'); __test.Store.act('toggle-theme'); var ex = document.querySelector('.export-menu'); if (ex) ex.remove(); return true; })()`);
  await sleep(600);
  await shot('05-dark-grid');

  console.log('输出目录: ' + OUT);
  child.kill();
})();
