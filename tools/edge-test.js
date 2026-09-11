/* 边界测试：掩码继承、行序变化、异常输入、重复导入幂等性 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9337;
const ROOT = path.join(__dirname, '..');
const PROFILE = path.join(os.tmpdir(), 'ipv-edge-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (u) => (await fetch(u)).json();

(async () => {
  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?selftest';
  const child = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', url], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { await j(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(200); } }
  let target;
  for (let i = 0; i < 100; i++) { const l = await j(`http://127.0.0.1:${PORT}/json/list`); target = l.find((x) => x.type === 'page' && x.url.includes('index.html')); if (target) break; await sleep(200); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const errors = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  await send('Runtime.enable'); await sleep(1400);
  // 应用在 IIFE 内，需通过 __test 句柄暴露到页面作用域
  await ev(`(function(){
    window.IO = window.__test.IO; window.Wizard = window.__test.Wizard;
    window.Calc = window.__test.Calc; window.Store = window.__test.Store;
    window.Panel = window.__test.Panel; window.Data = window.__test.Data;
    return true;
  })()`);

  const out = [];
  const check = (n, ok, d) => out.push([n, !!ok, d || '']);

  // 通用：把指定 6 列行数组跑完整个导入流程
  const runImport = `async function(rows){
    Store.state.data.subnets = [];
    Wizard.start([{ name: 't', rows: rows }]);
    var cf = document.getElementById('confirm');
    if (cf.open) cf.querySelector('#cf-foot .btn.primary').click();
    document.getElementById('w-foot').querySelector('.btn.primary').click();
    document.getElementById('w-foot').querySelector('.btn.primary').click();
    var d = Store.state.data, n = 0, map = {};
    d.subnets.forEach(function(s){ n += Object.keys(s.ips).length;
      Object.keys(s.ips).forEach(function(ip){ map[s.cidr + '#' + ip] = s.ips[ip]; }); });
    return { rows: n, cidrs: d.subnets.map(function(s){return s.cidr;}).sort(), map: map, report: document.getElementById('toasts').textContent };
  }`;
  await ev(`window.__runImport = ${runImport}; window.__H = ['子网','设备名称','接口名称','接口IP','掩码','备注'];`);

  // A. 乱序：/30 行排在 VRRP 之前，同设备不同接口——应仍归属同接口的 /24（需预扫描）
  const reordered = await ev(`(async function(){
    var H = window.__H;
    var rows = [H,
      ['ATD','FW-A','Eth-Trunk30','192.168.249.145','30',''],   // /30 先出现（不同接口）
      ['ATD','FW-A','Eth-Trunk10','192.168.156.1','','VRRP虚地址'], // 无掩码，同接口行在下方
      ['ATD','FW-A','Eth-Trunk10','192.168.156.2','24','']      // 同接口的 /24 在后
    ];
    return await window.__runImport(rows);
  })()`);
  check('乱序：无掩码行仍找到同接口 /24（预扫描）', !!reordered.map['192.168.156.0/24#192.168.156.1'], JSON.stringify(reordered.cidrs));
  check('乱序：不误用到 /30', !reordered.map['192.168.156.0/30#192.168.156.1'], JSON.stringify(Object.keys(reordered.map)));

  // A2. 同设备多种掩码且接口不同 → 拒绝猜测，报 badMask（不静默错归属）
  const ambiguous = await ev(`(async function(){
    var H = window.__H;
    var r = await window.__runImport([H,
      ['ATD','FW-X','Gi0/1','10.9.9.1','24',''],
      ['ATD','FW-X','Gi0/2','10.9.9.2','30',''],
      ['ATD','FW-X','Gi0/7','10.9.9.3','','无参考虚地址']
    ]);
    return { n: r.rows, report: r.report };
  })()`);
  check('同设备多掩码且接口未知时不猜测', ambiguous.n === 2 && /掩码缺失/.test(ambiguous.report), JSON.stringify({ n: ambiguous.n }));

  // B. 只有设备名相同、接口也未知时，用同设备回退
  const devFallback = await ev(`(async function(){
    var H = window.__H;
    return await window.__runImport([H,
      ['ATD','FW-B','Gi0/1','10.0.0.1','24',''],
      ['ATD','FW-B','Gi0/9','10.0.0.2','','虚地址']   // 不同接口且无掩码 → 回退同设备
    ]);
  })()`);
  check('同设备回退：不同接口也能继承掩码', !!devFallback.map['10.0.0.0/24#10.0.0.2'], JSON.stringify(devFallback.cidrs));

  // C. 掩码缺失且无任何参考 → 记入 badMask，不静默丢行
  const noRef = await ev(`(async function(){
    var H = window.__H;
    return await window.__runImport([H, ['ATD','FW-C','Gi0/1','10.1.1.1','','']]);
  })()`);
  check('完全无掩码参考时给出报告', noRef.rows === 0 && /掩码/.test(noRef.report), noRef.report);

  // D. 非连续掩码 → 不推导，报 badMask
  const badMask = await ev(`(async function(){
    var H = window.__H;
    return await window.__runImport([H, ['ATD','FW-D','Gi0/1','10.2.2.2','255.0.255.0','']]);
  })()`);
  check('非连续掩码被拒绝并报告', badMask.rows === 0 && /掩码/.test(badMask.report), badMask.report);

  // E. 展平掩码：/31 /32 边界
  const edges = await ev(`(async function(){
    var H = window.__H;
    return await window.__runImport([H,
      ['ATD','FW-E','Gi0/1','10.3.3.3','32',''],
      ['ATD','FW-E','Gi0/2','10.4.4.4','255.255.255.254','']
    ]);
  })()`);
  check('/32 推导为单地址网段', !!edges.map['10.3.3.3/32#10.3.3.3'], JSON.stringify(edges.cidrs));
  check('/31 由点分十进制推导', !!edges.map['10.4.4.4/31#10.4.4.4'], JSON.stringify(edges.cidrs));

  // F. 重复导入幂等：同表导入两次不应产生重复网段
  const idem = await ev(`(async function(){
    var H = window.__H;
    var rows = [H, ['ATD','FW-F','Gi0/1','10.5.5.5','24',''], ['ATD','FW-G','Gi0/2','10.5.5.6','24','']];
    var first = await window.__runImport(rows);
    var second = await window.__runImport(rows);
    return { first: first.cidrs, second: second.cidrs, rows: second.rows };
  })()`);
  check('重复导入不产生重复网段', JSON.stringify(idem.first) === JSON.stringify(idem.second) && idem.second.length === 1, JSON.stringify(idem));
  check('重复导入记录数稳定', idem.rows === 2, JSON.stringify(idem));

  // G. 高清同表但「子网」为空 → 仍应工作
  const noSubnetCol = await ev(`(async function(){
    var H = window.__H;
    return await window.__runImport([H, ['','FW-H','Gi0/1','10.6.6.6','24','']]);
  })()`);
  check('子网列为空仍能推导网段', !!noSubnetCol.map['10.6.6.0/24#10.6.6.6'], JSON.stringify(noSubnetCol.cidrs));

  // H. 同一 IP 同设备不同接口（非多设备）不应触发多设备合并
  const sameDev = await ev(`(async function(){
    var H = window.__H;
    var r = await window.__runImport([H,
      ['ATD','FW-I','Gi0/1','10.7.7.7','24',''],
      ['ATD','FW-I','Gi0/2','10.7.7.7','24','']
    ]);
    return { n: r.rows, rec: r.map['10.7.7.0/24#10.7.7.7'], report: r.report };
  })()`);
  check('同设备同址不记为多设备合并', sameDev.n === 1 && !/同址/.test(sameDev.report), JSON.stringify(sameDev));

  // I. 导入模板：用「列序不同」的表导入，导出必须复现该列序，且子网列留空
  const tpl = await ev(`(async function(){
    var H = ['掩码','接口IP','子网','备注','接口名称','设备名称'];   // 故意打乱列序
    await window.__runImport([H, ['24','10.8.8.8','ATD','备注X','Gi0/1','dev1']]);
    var view = IO.huaweiView();
    var rows = IO.huaweiRows(view);
    return {
      headers: view.headers, custom: view.custom, first: rows[0],
      saved: Data.loadTemplate() ? Data.loadTemplate().headers : null
    };
  })()`);
  check('导入后记住模板表头', tpl.saved && JSON.stringify(tpl.saved) === JSON.stringify(['掩码','接口IP','子网','备注','接口名称','设备名称']), JSON.stringify(tpl.saved));
  check('导出复现导入列序', JSON.stringify(tpl.headers) === JSON.stringify(['掩码','接口IP','子网','备注','接口名称','设备名称']), JSON.stringify(tpl.headers));
  check('乱序列序下各字段仍落在正确列', tpl.first[0] === '24' && tpl.first[1] === '10.8.8.8' &&
    tpl.first[2] === '' && tpl.first[3] === '备注X' && tpl.first[4] === 'Gi0/1' && tpl.first[5] === 'dev1', JSON.stringify(tpl.first));

  // J. 自定义模板缺少的字段应并入备注列，不丢信息
  const spill = await ev(`(async function(){
    var H = ['接口IP','掩码','备注'];
    await window.__runImport([H, ['10.9.9.9','24','']]);
    var s = Store.state.data.subnets[0];
    var ip = Object.keys(s.ips)[0];
    s.ips[ip].mac = 'AA-BB-CC-DD-EE-FF';
    s.ips[ip].purpose = '核心';
    var rows = IO.huaweiRows(IO.huaweiView());
    return { headers: IO.huaweiView().headers, row: rows[0] };
  })()`);
  check('模板无该列时字段并入备注', spill.row.length === 3 &&
    /MAC: AA-BB-CC-DD-EE-FF/.test(spill.row[2]) && /用途: 核心/.test(spill.row[2]), JSON.stringify(spill));

  check('无运行时异常', errors.length === 0, errors.map((e) => JSON.stringify(e)).join('|').slice(0, 300));

  console.log('===== 边界测试 =====');
  out.forEach((r) => console.log((r[1] ? '✓' : '✗') + ' ' + r[0] + (r[2] ? '  [' + r[2] + ']' : '')));
  console.log(`\n${out.filter((r) => r[1]).length} / ${out.length} 通过`);
  child.kill();
  process.exit(out.some((r) => !r[1]) ? 1 : 0);
})();
