/* CDP 集成测试：真实 Edge 中加载 index.html，跑内建 selftest，
 * 再用用户上传的华为 xlsx 走一遍完整「导入向导 → 自动格式识别 → 导入」流程。
 * 用法: node tools/cdp-test.js ["<xlsx路径>"]
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const ROOT = path.join(__dirname, '..');
const XLSX = process.argv[2] || 'C:\\Users\\xmtlz\\.dsh\\attachments\\v1\\files\\5f\\5fe61761c94a69b7080312bc19c288ccb058fa6d6995f7c41a5137c4c9857f61\\华为设备已配置IP统计.xlsx';
const PROFILE = path.join(require('os').tmpdir(), 'ipv-cdp-profile');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Node 侧独立的 CIDR 计算（不依赖页面作用域，供断言使用）
function cdpIpToUint(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip).trim());
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
function cdpCalcParse(cidr) {
  const [ip, preStr] = String(cidr).split('/');
  const pre = Number(preStr);
  const u = cdpIpToUint(ip);
  if (u === null || !(pre >= 0 && pre <= 32)) throw new Error('bad cidr ' + cidr);
  const mask = pre === 0 ? 0 : (0xFFFFFFFF << (32 - pre)) >>> 0;
  const network = (u & mask) >>> 0;
  return { network, broadcast: (network | (~mask >>> 0)) >>> 0 };
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function waitForDevtools() {
  for (let i = 0; i < 100; i++) {
    try { return await getJson(`http://127.0.0.1:${PORT}/json/version`); } catch (e) { await sleep(200); }
  }
  throw new Error('DevTools 未就绪');
}

async function findPageTarget(match) {
  for (let i = 0; i < 100; i++) {
    const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const t = list.find((x) => x.type === 'page' && (!match || x.url.includes(match)));
    if (t && t.webSocketDebuggerUrl) return t;
    await sleep(200);
  }
  throw new Error('未找到页面 target');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP 超时: ' + method)); } }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, allowUnsafeEvalBlockedByCSP: true
    });
    if (r.exceptionDetails) {
      throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }
}

(async () => {
  if (!fs.existsSync(XLSX)) { console.error('缺少 xlsx: ' + XLSX); process.exit(1); }
  const xlsxB64 = fs.readFileSync(XLSX).toString('base64');

  if (!fs.existsSync(PROFILE)) fs.mkdirSync(PROFILE, { recursive: true });
  const pageUrl = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
  const child = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--allow-file-access-from-files',
    pageUrl + '?selftest'
  ], { stdio: 'ignore', detached: false });

  const failures = [];
  const results = [];
  const check = (name, ok, detail) => {
    results.push([name, !!ok, detail || '']);
    if (!ok) failures.push(name + (detail ? ' — ' + detail : ''));
  };

  try {
    await waitForDevtools();
    const target = await findPageTarget('index.html');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const cdp = new CDP(ws);

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    // ---------- 1. 内建 selftest ----------
    let summary = null;
    for (let i = 0; i < 80; i++) {
      summary = await cdp.eval(`(function(){
        var box = document.getElementById('selftest');
        if (!box) return null;
        var hs = box.querySelectorAll('h3');
        var last = hs[hs.length-1];
        var fails = Array.prototype.map.call(box.querySelectorAll('.fail'), function(n){ return n.textContent; });
        var asyncDone = !!(last && /通过/.test(last.textContent));
        return { title: last ? last.textContent : '', fails: fails, asyncDone: asyncDone };
      })()`);
      if (summary && summary.asyncDone && summary.title && !/^0 \/ 0/.test(summary.title)) break;
      await sleep(250);
    }
    check('selftest 全部通过', summary && summary.fails.length === 0, summary ? (summary.title + ' ' + JSON.stringify(summary.fails)) : '未取得结果');
    console.log('selftest: ' + (summary ? summary.title : '?') + '  失败项=' + (summary ? summary.fails.length : '?'));

    // ---------- 2. 清空数据并载入华为 xlsx ----------
    await cdp.eval(`(function(){
      try { localStorage.clear(); } catch(e) {}
      return true;
    })()`);
    // 必须以 ?selftest 重新加载，否则 window.__test 不暴露（模块在 IIFE 内）
    await cdp.send('Page.navigate', { url: pageUrl + '?selftest' });
    await sleep(1800);
    const ready = await cdp.eval(`!!(window.__test && window.__test.Wizard && window.__test.IO)`);
    check('页面加载且模块就绪', ready === true);

    // 测试内统一通过 __test 句柄访问
    await cdp.eval(`(function(){
      window.IO = window.__test.IO;
      window.Wizard = window.__test.Wizard;
      window.Calc = window.__test.Calc;
      window.Store = window.__test.Store;
      return true;
    })()`);

    // 读取真实 xlsx（base64 → Uint8Array → Mini-XLSX 读取器）
    const wbInfo = await cdp.eval(`(async function(){
      var b64 = "${xlsxB64}";
      var bin = atob(b64);
      var u8 = new Uint8Array(bin.length);
      for (var i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
      window.__wb = await IO.Xlsx.read(u8.buffer);
      var s = window.__wb.sheets[0];
      var headers = s.rows[0].map(function(h){ return String(h||'').trim(); });
      var hit = Wizard.detectProfile(headers);
      return {
        sheetCount: window.__wb.sheets.length,
        sheetName: s.name,
        headers: headers,
        rowCount: s.rows.length,
        profile: hit ? hit.profile.id : null,
        mapping: hit ? hit.mapping : null
      };
    })()`);
    console.log('workbook:', JSON.stringify(wbInfo, null, 1));
    check('xlsx 解压读取成功', wbInfo.sheetCount === 1 && wbInfo.rowCount === 13, JSON.stringify(wbInfo));
    check('识别为华为格式', wbInfo.profile === 'huawei');
    check('表头与参考文件一致', JSON.stringify(wbInfo.headers) === JSON.stringify(['子网','设备名称','接口名称','接口IP','掩码','备注']), JSON.stringify(wbInfo.headers));

    // ---------- 3. 走真实向导 DOM ----------
    const step1 = await cdp.eval(`(function(){
      Wizard.start(window.__wb.sheets);
      return {
        mapping: Wizard.state.mapping,
        profile: Wizard.state.profile && Wizard.state.profile.id,
        confirmOpen: document.getElementById('confirm').open,
        confirmTitle: document.getElementById('cf-title').textContent
      };
    })()`);
    check('向导自动映射出 ip+mask', step1.mapping && step1.mapping.ip === 3 && step1.mapping.mask === 4, JSON.stringify(step1));
    check('弹出预设格式确认框', step1.confirmOpen === true && /华为/.test(step1.confirmTitle), JSON.stringify(step1));

    // 点「按此导入」→ 合并步骤 → 点「开始导入」
    const step2 = await cdp.eval(`(function(){
      var cf = document.getElementById('confirm');
      var ok = cf.querySelector('#cf-foot .btn.primary');
      ok.click();
      var merge = document.getElementById('w-merge');
      var wiz = document.getElementById('wiz');
      return { mergeVisible: !!merge && wiz.open, mergeValue: merge ? merge.value : null,
               footLabel: document.getElementById('w-foot').lastChild.textContent };
    })()`);
    check('进入合并步骤', step2.mergeVisible === true, JSON.stringify(step2));

    const imported = await cdp.eval(`(function(){
      var foot = document.getElementById('w-foot');
      var run = foot.querySelector('.btn.primary');
      run.click();
      var d = Store.state.data;
      var rowCount = 0;
      d.subnets.forEach(function(s){ rowCount += Object.keys(s.ips).length; });
      return {
        rows: rowCount,
        report: (document.getElementById('toasts') || {}).textContent || '',
        subnets: d.subnets.map(function(s){
          return { cidr: s.cidr, name: s.name, count: Object.keys(s.ips).length,
                   sample: Object.keys(s.ips).slice(0,3).map(function(ip){ return ip + '|' + JSON.stringify(s.ips[ip]); }) };
        }),
        firstRec: (function(){ var s = d.subnets[0]; if(!s) return null; var ip = Object.keys(s.ips)[0]; return s.ips[ip]; })()
      };
    })()`);
    console.log('imported subnets:', JSON.stringify(imported, null, 1));

    check('由掩码推导出网段', imported.subnets.length >= 4, '实得 ' + imported.subnets.length + ' 个: ' + imported.subnets.map(s=>s.cidr).join(', '));
    const byCidr = Object.fromEntries(imported.subnets.map((s) => [s.cidr, s]));
    check('192.168.156.0/24 存在且命名 ATD', !!byCidr['192.168.156.0/24'] && byCidr['192.168.156.0/24'].name === 'ATD', JSON.stringify(byCidr['192.168.156.0/24']));
    check('192.168.249.144/30 由 /30 推导', !!byCidr['192.168.249.144/30'], Object.keys(byCidr).join(', '));
    check('192.168.249.148/30 由 /30 推导', !!byCidr['192.168.249.148/30'], Object.keys(byCidr).join(', '));
    // openpyxl 权威值：1.1.1.x 的掩码是 24，不是 30
    check('1.1.1.0/24 由掩码 24 推导', !!byCidr['1.1.1.0/24'], Object.keys(byCidr).join(', '));
    const total = imported.subnets.reduce((n, s) => n + s.count, 0);
    // 12 行输入；两台设备共用 192.168.156.1（VRRP 虚地址）合并为 1 条 → 11 个唯一 IP
    check('12 行全部落库（同址 VRRP 合并后 11 个唯一 IP）', total === 11 && /12 行记录/.test(imported.report), '唯一IP=' + total + ' 报告=' + imported.report);
    check('导入报告含 VRRP 合并与掩码沿用', /同址 HSRP\/VRRP 1 行/.test(imported.report) && /沿用同设备掩码 2 条/.test(imported.report), imported.report);    check('掩码存入记录', imported.firstRec && imported.firstRec.mask === '24', JSON.stringify(imported.firstRec));
    // 参考文件应推导出恰好这 5 个网段（1.1.1.x 为 /24）
    const expectCidrs = ['1.1.1.0/24', '192.168.0.0/24', '192.168.1.0/24', '192.168.156.0/24', '192.168.249.144/30', '192.168.249.148/30'].sort();
    check('推导网段集合与参考表一致', JSON.stringify(Object.keys(byCidr).sort()) === JSON.stringify(expectCidrs), JSON.stringify(Object.keys(byCidr).sort()));
    // 空掩码行沿用同设备掩码
    const vrrpRows = await cdp.eval(`(function(){
      var out = [];
      Store.state.data.subnets.forEach(function(s){
        Object.keys(s.ips).forEach(function(ip){
          var r = s.ips[ip];
          if (r.note && r.note.indexOf('VRRP') >= 0) out.push({ ip: ip, cidr: s.cidr, mask: r.mask, iface: r.iface, device: r.name, note: r.note });
        });
      });
      return out;
    })()`);
    check('VRRP 行导入且继承掩码 24', vrrpRows.length === 1 && vrrpRows[0].mask === '24', JSON.stringify(vrrpRows));
    check('VRRP 虚地址落在 Eth-Trunk10 的 /24 网段', vrrpRows.every((r) => r.cidr === '192.168.156.0/24'), JSON.stringify(vrrpRows));
    check('同址设备名保留在备注', vrrpRows.length === 1 && /同址设备:/.test(vrrpRows[0].note), JSON.stringify(vrrpRows));

    // 子网内 IP 归属正确
    const membership = await cdp.eval(`(function(){
      var out = [];
      Store.state.data.subnets.forEach(function(s){
        Object.keys(s.ips).forEach(function(ip){ out.push(s.cidr + ' <- ' + ip); });
      });
      return out;
    })()`);
    check('每条 IP 都落在其网段内', membership.every((line) => {
      const [cidr, ip] = line.split(' <- ');
      const c = cdpCalcParse(cidr), u = cdpIpToUint(ip);
      return u !== null && u >= c.network && u <= c.broadcast;
    }), JSON.stringify(membership));

    // ---------- 4. 华为格式导出（沿用导入模板的列格式） ----------
    const exported = await cdp.eval(`(function(){
      var view = IO.huaweiView();
      var rows = IO.huaweiRows(view);
      var huawei = view.headers;
      return {
        headers: huawei,
        custom: view.custom,
        widths: IO.HUAWEI_WIDTHS,
        rowCount: rows.length,
        allSameWidth: rows.every(function(r){ return r.length === huawei.length; }),
        first: rows[0],
        ipCol: huawei.indexOf('接口IP'),
        subnetAllEmpty: rows.every(function(r){ return r[0] === ''; }),
        vrrp: rows.filter(function(r){ return r[5] && r[5].indexOf('VRRP') >= 0; }).length,
        xml: IO.Xlsx.sheetXml([huawei].concat(rows), IO.HUAWEI_WIDTHS)
      };
    })()`);
    check('导出 12 行且与表头等宽', exported.rowCount === 12 && exported.allSameWidth === true, JSON.stringify(exported.first));
    check('导出复现导入表头与列序', exported.custom === true &&
      JSON.stringify(exported.headers) === JSON.stringify(['子网', '设备名称', '接口名称', '接口IP', '掩码', '备注']), JSON.stringify(exported.headers));
    check('子网列全部留空（人工维护）', exported.subnetAllEmpty === true, JSON.stringify(exported.first));
    check('接口IP 仍在第 4 列，与上传文件一致', exported.ipCol === 3, 'ipCol=' + exported.ipCol);
    check('导出保留 VRRP 备注', exported.vrrp >= 1, 'vrrp=' + exported.vrrp);
    // 还原出的两行应各带一台设备名，且备注里的「同址设备」不再外泄
    const vrrpExport = await cdp.eval(`IO.huaweiRows().filter(function(r){ return r[5] && r[5].indexOf('VRRP') >= 0; })`);
    check('VRRP 导出为两行不同设备', vrrpExport.length === 2 &&
      vrrpExport.some(r => r[1] === 'FW-O1-MDF-10-B2-9-U6650-ATD') &&
      vrrpExport.some(r => r[1] === 'FW-O1-MDF-10-B2-9-U6650E-ATD'), JSON.stringify(vrrpExport));
    check('导出备注不残留「同址设备」标记', vrrpExport.every(r => !/同址设备/.test(r[5])), JSON.stringify(vrrpExport));
    check('导出 xlsx 含列宽与筛选', exported.xml.includes('<cols>') && exported.xml.includes('<autoFilter ref="A1:F1"/>'));

    // 真实生成 xlsx 字节，交给 Node 用 openpyxl 校验
    const xlsxB64Out = await cdp.eval(`(function(){
      var view = IO.huaweiView();
      var rows = IO.huaweiRows(view);
      var files = [];
      var sheetXml = IO.Xlsx.sheetXml([view.headers].concat(rows), IO.HUAWEI_WIDTHS);
      files.push(['xl/worksheets/sheet1.xml', sheetXml]);
      files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>']);
      files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
      files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="设备IP地址统计" sheetId="1" r:id="rId1"/></sheets></workbook>']);
      files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>']);
      var zip = IO.Xlsx.zipStore(files);
      var s = ''; for (var i=0;i<zip.length;i++) s += String.fromCharCode(zip[i]);
      return btoa(s);
    })()`);
    const outPath = path.join(require('os').tmpdir(), 'ipv-huawei-export.xlsx');
    fs.writeFileSync(outPath, Buffer.from(xlsxB64Out, 'base64'));
    console.log('导出文件: ' + outPath + ' (' + fs.statSync(outPath).size + ' bytes)');

    // ---------- 5. 往返：把刚导出的华为 xlsx 再导入一次，应还原 12 行 / 6 网段 ----------
    const roundB64 = fs.readFileSync(outPath).toString('base64');
    const roundTrip = await cdp.eval(`(async function(){
      var bin = atob("${roundB64}");
      var u8 = new Uint8Array(bin.length);
      for (var i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
      var wb = await IO.Xlsx.read(u8.buffer);
      var sheet = wb.sheets[0];
      var headers = sheet.rows[0].map(function(h){ return String(h||'').trim(); });
      var hit = Wizard.detectProfile(headers);
      Store.state.data.subnets = [];
      Wizard.start([sheet]);
      var cf = document.getElementById('confirm');
      if (cf.open) cf.querySelector('#cf-foot .btn.primary').click();
      document.getElementById('w-foot').querySelector('.btn.primary').click();
      document.getElementById('w-foot').querySelector('.btn.primary').click();
      var d = Store.state.data;
      var n = 0, cidrs = [], merged = null;
      d.subnets.forEach(function(s){
        n += Object.keys(s.ips).length;
        cidrs.push(s.cidr);
        Object.keys(s.ips).forEach(function(ip){
          if (/同址设备/.test(s.ips[ip].note || '')) merged = { ip: ip, note: s.ips[ip].note };
        });
      });
      return { rows: n, cidrs: cidrs.sort(), merged: merged, profile: hit ? hit.profile.id : null, report: document.getElementById('toasts').textContent };
    })()`);
    check('导出文件可被再次识别为华为格式', roundTrip.profile === 'huawei', JSON.stringify(roundTrip).slice(0, 200));
    check('往返处理 12 行并回到 11 个唯一 IP', roundTrip.rows === 11 && /12 行记录/.test(roundTrip.report), JSON.stringify(roundTrip).slice(0, 300));
    check('往返后网段集合不变', JSON.stringify(roundTrip.cidrs) === JSON.stringify(expectCidrs), JSON.stringify(roundTrip.cidrs));
    check('往返后同址 VRRP 合并关系保留', !!roundTrip.merged && /U6650E-ATD/.test(roundTrip.merged.note), JSON.stringify(roundTrip.merged));

    // ---------- 6. 无控制台异常 ----------
    const errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown');
    check('无运行时异常', errors.length === 0, errors.map((e) => JSON.stringify(e.params)).join(' | ').slice(0, 500));

    ws.close();
  } catch (e) {
    check('测试执行', false, e.message);
  } finally {
    try { child.kill(); } catch (e) {}
  }

  console.log('\n===== 结果 =====');
  results.forEach((r) => console.log((r[1] ? '✓' : '✗') + ' ' + r[0] + (r[2] ? '  [' + r[2] + ']' : '')));
  console.log(`\n${results.filter((r) => r[1]).length} / ${results.length} 通过`);
  process.exit(failures.length ? 1 : 0);
})();
