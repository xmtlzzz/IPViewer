/* 截图验证 UI：导入向导、目录分组侧栏、折叠态、IP 详情面板、导出菜单 */
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
  await ev(`(function(){
    window.IO = window.__test.IO; window.Wizard = window.__test.Wizard;
    window.Store = window.__test.Store; window.Data = window.__test.Data;
    window.Dialog = window.__test.Dialog; window.Events = window.__test.Events;
    return true;
  })()`);

  // 1. 导入向导：映射步骤（点「重新映射」跳过预设确认）
  await ev(`(async function(){
    var bin = atob("${b64}"); var u8 = new Uint8Array(bin.length);
    for (var i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
    var wb = await IO.Xlsx.read(u8.buffer);
    Store.state.data.subnets = [];
    Store.state.data.groups = [];
    Wizard.start([wb.sheets[0]]);
    var cf = document.getElementById('confirm');
    if (cf.open) cf.querySelector('#cf-foot .btn').click();
    return true;
  })()`);
  await sleep(600);
  await shot('01-wizard-mapping');

  // 2. 完成导入 → 目录分组侧栏
  await ev(`(function(){
    document.getElementById('w-foot').querySelector('.btn.primary').click();
    document.getElementById('w-foot').querySelector('.btn.primary').click();
    Store.act('subnet-select', Store.state.data.subnets[0].id);
    return true;
  })()`);
  await sleep(900);
  await shot('02-sidebar-groups');

  // 3. 折叠 ATD 目录
  await ev(`(function(){
    var h = Array.prototype.filter.call(document.querySelectorAll('.grp-head'), function(x){
      return x.textContent.indexOf('ATD') >= 0; })[0];
    h.click();
    return true;
  })()`);
  await sleep(600);
  await shot('03-group-collapsed');

  // 4. 展开并新建一个空目录 ADR
  await ev(`(function(){
    var h = Array.prototype.filter.call(document.querySelectorAll('.grp-head'), function(x){
      return x.textContent.indexOf('ATD') >= 0; })[0];
    h.click();
    document.querySelector('[data-action="add-group"]').click();
    document.getElementById('g-name').value = 'ADR';
    document.getElementById('g-note').value = 'B 栋新增站点';
    document.getElementById('dlg-foot').querySelector('.btn.primary').click();
    return true;
  })()`);
  await sleep(600);
  await shot('04-group-created');

  // 5. IP 详情面板（含掩码字段）
  await ev(`(function(){
    var s = Store.state.data.subnets[0];
    Store.act('open-panel', Object.keys(s.ips)[0]);
    return true;
  })()`);
  await sleep(500);
  await shot('05-panel-mask');

  // 6. 导出菜单
  await ev(`(function(){
    Store.act('close-panel');
    var btn = document.querySelector('[data-action="export-table"]');
    var r = btn.getBoundingClientRect();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left, clientY: r.bottom }));
    return true;
  })()`);
  await sleep(500);
  await shot('06-export-menu');

  // 7. 多选模式（批量删除）
  await ev(`(function(){
    var m = document.querySelector('.export-menu'); if (m) m.remove();
    document.getElementById('side-pick-btn').click();
    var cards = document.querySelectorAll('.snt-card');
    cards[0].click();
    cards[1].click();
    cards[2].click();
    return true;
  })()`);
  await sleep(500);
  await shot('07-multi-select');

  console.log('输出目录: ' + OUT);
  child.kill();
})();
