/* UI DOM 断言：面板掩码字段可见且回填、导出菜单含华为项、向导映射下拉含掩码、结果统计正确 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9336;
const ROOT = path.join(__dirname, '..');
const XLSX = process.argv[2];
const PROFILE = path.join(os.tmpdir(), 'ipv-ui-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (u) => (await fetch(u)).json();

(async () => {
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const b64 = fs.readFileSync(XLSX).toString('base64');
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?selftest';
  const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,1000', url], { stdio: 'ignore' });

  for (let i = 0; i < 100; i++) { try { await j(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(200); } }
  let target;
  for (let i = 0; i < 100; i++) { const l = await j(`http://127.0.0.1:${PORT}/json/list`); target = l.find((x) => x.type === 'page' && x.url.includes('index.html')); if (target) break; await sleep(200); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const errors = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(1400);

  const out = [];
  const check = (n, ok, d) => { out.push([n, !!ok, d || '']); };

  // 向导映射 UI：掩码出现在目标字段里，且 IP+掩码 下拉已选中
  const wiz = await ev(`(async function(){
    var bin = atob("${b64}"); var u8 = new Uint8Array(bin.length);
    for (var i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
    var wb = await __test.IO.Xlsx.read(u8.buffer);
    __test.Store.state.data.subnets = [];
    __test.Wizard.start([wb.sheets[0]]);
    var cf = document.getElementById('confirm');
    if (cf.open) cf.querySelector('#cf-foot .btn').click();   // 重新映射
    var sels = Array.prototype.map.call(document.querySelectorAll('#w-body select[data-target]'), function(s){
      return s.dataset.target + '=' + (s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '');
    });
    return { selects: sels, bodyText: document.getElementById('w-body').textContent.slice(0,120) };
  })()`);
  check('向导目标字段含「掩码」', wiz.selects.some((s) => s.indexOf('mask=') === 0), JSON.stringify(wiz.selects));
  check('掩码下拉已选中表头「掩码」', wiz.selects.includes('mask=掩码'), JSON.stringify(wiz.selects));
  check('IP 下拉已选中「接口IP」', wiz.selects.includes('ip=接口IP'), JSON.stringify(wiz.selects));
  check('若下拉已选「子网」为归类列', wiz.selects.includes('subnet=子网') || wiz.selects.includes('subnet=（未映射）'), JSON.stringify(wiz.selects));

  // 走完导入
  await ev(`(function(){
    document.getElementById('w-foot').querySelector('.btn.primary').click();
    document.getElementById('w-foot').querySelector('.btn.primary').click();
    return true;
  })()`);
  await sleep(500);

  // 面板掩码字段
  const panel = await ev(`(function(){
    var s = __test.Store.state.data.subnets.find(function(x){ return x.cidr === '192.168.156.0/24'; });
    var ip = Object.keys(s.ips)[0];
    __test.Store.act('subnet-select', s.id);
    __test.Store.act('open-panel', ip);
    var f = document.getElementById('f-mask');
    var inp = document.getElementById('p-mask');
    var box = inp.getBoundingClientRect();
    return {
      fieldExists: !!f && !!inp,
      labelText: f ? f.querySelector('label').textContent : '',
      value: inp ? inp.value : null,
      visible: box.width > 0 && box.height > 0,
      panelOpen: document.getElementById('panel').classList.contains('open'),
      recMask: s.ips[ip].mask
    };
  })()`);
  check('面板存在掩码输入框', panel.fieldExists === true, JSON.stringify(panel));
  check('掩码字段可见且有标签', panel.visible === true && panel.labelText === '掩码', JSON.stringify(panel));
  check('掩码回填记录值', panel.value === panel.recMask && panel.value === '24', JSON.stringify(panel));

  // 面板保存掩码（改成 30 再读回）
  const saved = await ev(`(function(){
    document.getElementById('p-mask').value = '255.255.255.252';
    __test.Panel.save();
    var s = __test.Store.activeSubnet();
    var ip = __test.Store.state.ui.selectedIp;
    return { mask: s.ips[ip].mask, invalid: document.getElementById('f-mask').classList.contains('invalid') };
  })()`);
  check('面板可保存点分十进制掩码', saved.mask === '255.255.255.252', JSON.stringify(saved));
  check('合法掩码不报错', saved.invalid === false, JSON.stringify(saved));

  // 非法掩码 → 软提示但不阻断
  const bad = await ev(`(function(){
    document.getElementById('p-mask').value = '255.0.255.0';
    __test.Panel.save();
    var s = __test.Store.activeSubnet();
    var ip = __test.Store.state.ui.selectedIp;
    return { mask: s.ips[ip].mask, invalid: document.getElementById('f-mask').classList.contains('invalid') };
  })()`);
  check('非法掩码仅软提示（已保存且标记 invalid）', bad.mask === '255.0.255.0' && bad.invalid === true, JSON.stringify(bad));

  // 导出菜单
  const menu = await ev(`(function(){
    __test.Store.act('close-panel');
    var btn = document.querySelector('[data-action="export-table"]');
    var r = btn.getBoundingClientRect();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left, clientY: r.top }));
    var items = Array.prototype.map.call(document.querySelectorAll('.export-menu-item'), function(b){ return b.textContent; });
    return items;
  })()`);
  check('导出菜单含 4 项', menu.length === 4, JSON.stringify(menu));
  check('导出菜单含华为格式 xlsx', menu.some((m) => m.indexOf('华为格式 Excel') >= 0) || menu.some((m) => /沿用导入格式/.test(m)), JSON.stringify(menu));

  // 网段列表命名与统计
  const list = await ev(`(function(){
    var cards = Array.prototype.map.call(document.querySelectorAll('.snt-card'), function(c){ return c.textContent; });
    var stats = document.getElementById('stats').textContent;
    return { cards: cards, stats: stats };
  })()`);
  check('侧栏网段卡片显示 ATD 名称', list.cards.some((c) => c.indexOf('ATD') >= 0), JSON.stringify(list.cards));
  check('统计条显示已分配数量', /已分配/.test(list.stats), list.stats);

  check('无运行时异常', errors.length === 0, errors.map((e) => JSON.stringify(e)).join('|').slice(0, 300));

  console.log('===== UI 断言 =====');
  out.forEach((r) => console.log((r[1] ? '✓' : '✗') + ' ' + r[0] + (r[2] ? '  [' + r[2] + ']' : '')));
  console.log(`\n${out.filter((r) => r[1]).length} / ${out.length} 通过`);
  child.kill();
  process.exit(out.some((r) => !r[1]) ? 1 : 0);
})();
