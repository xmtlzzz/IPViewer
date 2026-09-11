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
  // 模块在 IIFE 内，需经 __test 暴露到页面作用域
  await ev(`(function(){
    window.IO = window.__test.IO; window.Wizard = window.__test.Wizard;
    window.Store = window.__test.Store; window.Data = window.__test.Data;
    window.Dialog = window.__test.Dialog; window.Events = window.__test.Events;
    return true;
  })()`);

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

  // ---------- 目录分组 UI ----------
  const grp = await ev(`(function(){
    var heads = Array.prototype.map.call(document.querySelectorAll('.grp-head'), function(h){ return h.textContent; });
    var body = document.querySelector('.grp-body');
    return {
      heads: heads,
      cardsInGroup: body ? body.querySelectorAll('.snt-card').length : 0,
      ungrouped: !!document.querySelector('.grp.ungrouped'),
      addGroupBtn: !!document.querySelector('[data-action="add-group"]')
    };
  })()`);
  check('侧栏出现目录分组标题', grp.heads.some((h) => h.includes('ATD')), JSON.stringify(grp.heads));
  check('目录下挂载 6 个网段卡片', grp.cardsInGroup === 6, JSON.stringify(grp));
  check('存在「未分组」分组', grp.ungrouped === true, JSON.stringify(grp));
  check('侧栏有「＋ 目录」按钮', grp.addGroupBtn === true, JSON.stringify(grp));

  const collapse = await ev(`(function(){
    // 明确选中 ATD 目录的标题（.grp-head 的第一次可能是未分组）
    var head = Array.prototype.filter.call(document.querySelectorAll('.grp-head'), function(h){
      return h.textContent.indexOf('ATD') >= 0;
    })[0];
    // Store.act 会整段重渲染侧栏，故每次操作后重新查询 DOM
    head.click();
    var box = Array.prototype.filter.call(document.querySelectorAll('.grp'), function(g){
      return g.querySelector('.grp-name').textContent === 'ATD';
    })[0];
    var collapsed = box.classList.contains('collapsed');
    var body = box.querySelector('.grp-body');
    var bodyHidden = body ? getComputedStyle(body).display === 'none' : true;
    box.querySelector('.grp-head').click();
    var box2 = Array.prototype.filter.call(document.querySelectorAll('.grp'), function(g){
      return g.querySelector('.grp-name').textContent === 'ATD';
    })[0];
    return { collapsed: collapsed, bodyHidden: bodyHidden,
             reopened: !box2.classList.contains('collapsed') };
  })()`);
  check('点击目录标题可折叠', collapse.collapsed === true && collapse.bodyHidden === true, JSON.stringify(collapse));
  check('再次点击可展开', collapse.reopened === true, JSON.stringify(collapse));

  const dlg = await ev(`(function(){
    document.querySelector('[data-action="add-group"]').click();
    var d = document.getElementById('dlg');
    var open = d.open, title = document.getElementById('dlg-title').textContent;
    document.getElementById('g-name').value = 'ADR';
    document.getElementById('g-note').value = 'B 栋';
    document.getElementById('dlg-foot').querySelector('.btn.primary').click();
    var names = Store.state.data.groups.map(function(g){ return g.name; });
    var heads = Array.prototype.map.call(document.querySelectorAll('.grp-head'), function(h){ return h.textContent; });
    return { open: open, title: title, names: names, heads: heads, closed: !d.open };
  })()`);
  check('新建目录对话框可打开', dlg.open === true && /新建目录/.test(dlg.title), JSON.stringify(dlg));
  check('新建 ADR 目录成功', JSON.stringify(dlg.names) === JSON.stringify(['ATD', 'ADR']), JSON.stringify(dlg.names));
  check('空目录也显示在侧栏', dlg.heads.filter((h) => h.includes('ADR')).length === 1, JSON.stringify(dlg.heads));

  const sel = await ev(`(function(){
    var s = Store.state.data.subnets[0];
    __test.Dialog.promptSubnet(s.id);
    var g = document.getElementById('d-group');
    var opts = g ? Array.prototype.map.call(g.options, function(o){ return o.textContent; }) : null;
    document.getElementById('dlg').close();
    return { opts: opts };
  })()`);
  check('网段对话框有目录选择器', !!sel.opts && sel.opts[0] === '（未分组）' && sel.opts.includes('ATD'), JSON.stringify(sel));

  const del = await ev(`(function(){
    var atd = Store.state.data.groups.filter(function(g){ return g.name === 'ATD'; })[0];
    Events.deleteGroup(atd.id);
    document.getElementById('cf-foot').querySelector('.btn.primary').click();
    var d = Store.state.data;
    return { groups: d.groups.map(function(g){ return g.name; }), subnets: d.subnets.length,
             ungrouped: d.subnets.filter(function(s){ return !s.groupId; }).length };
  })()`);
  check('删除目录后网段保留并回到未分组', del.groups.length === 1 && del.subnets === 6 && del.ungrouped === 6, JSON.stringify(del));

  // 窄视口：目录分组不应导致页面横向溢出
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  const narrow = await ev(`(function(){
    return {
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
      grpHeads: document.querySelectorAll('.grp-head').length,
      headW: document.querySelector('.grp-head') ? Math.round(document.querySelector('.grp-head').getBoundingClientRect().width) : 0,
      addBtn: !!document.querySelector('[data-action="add-group"]')
    };
  })()`);
  check('窄视口无横向溢出', narrow.docW <= narrow.winW + 1, JSON.stringify(narrow));
  check('窄视口下目录头仍在视口内', narrow.headW > 0 && narrow.headW <= narrow.winW, JSON.stringify(narrow));
  check('窄视口下「＋ 目录」仍可用', narrow.addBtn === true, JSON.stringify(narrow));
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(400);

  // ---------- 网段批量删除 ----------
  const pick = await ev(`(function(){
    var btn = document.getElementById('side-pick-btn');
    var before = btn.textContent;
    btn.click();
    var on = document.getElementById('side-bar').classList.contains('open');
    var after = btn.textContent;
    var cards = document.querySelectorAll('.snt-card.picking').length;
    var boxes = document.querySelectorAll('.snt-card .pick').length;
    return { before: before, after: after, barOpen: on, cards: cards, boxes: boxes,
             delDisabled: document.getElementById('side-del').disabled };
  })()`);
  check('「多选」按钮进入多选模式', pick.before === '多选' && pick.after === '完成', JSON.stringify(pick));
  check('多选操作条出现', pick.barOpen === true, JSON.stringify(pick));
  check('每张卡片显示勾选框', pick.cards === 6 && pick.boxes === 6, JSON.stringify(pick));
  check('未选时删除按钮禁用', pick.delDisabled === true, JSON.stringify(pick));

  const selCards = await ev(`(function(){
    var cards = document.querySelectorAll('.snt-card');
    cards[0].click();
    cards[1].click();
    var picked = document.querySelectorAll('.snt-card.picked').length;
    return { picked: picked, n: document.getElementById('side-n').textContent,
             delDisabled: document.getElementById('side-del').disabled };
  })()`);
  check('点击卡片可勾选', selCards.picked === 2, JSON.stringify(selCards));
  check('计数与删除按钮状态同步', selCards.n === '2' && selCards.delDisabled === false, JSON.stringify(selCards));

  const pickAll = await ev(`(function(){
    document.getElementById('side-all').click();
    var picked = document.querySelectorAll('.snt-card.picked').length;
    var label = document.getElementById('side-all').textContent;
    document.getElementById('side-all').click();
    return { picked: picked, label: label, after: document.querySelectorAll('.snt-card.picked').length };
  })()`);
  check('全选勾中全部网段', pickAll.picked === 6, JSON.stringify(pickAll));
  check('全选后再点可取消全选', pickAll.label === '取消全选' && pickAll.after === 0, JSON.stringify(pickAll));

  const grpPick = await ev(`(function(){
    // 选中有网段的那个目录头（未分组），而不是空的 ADR
    var heads = Array.prototype.filter.call(document.querySelectorAll('.grp-head .pick-grp'), function(b){
      return b.closest('.grp-head').textContent.indexOf('未分组') >= 0;
    });
    var box = heads[0];
    box.click();
    var picked = document.querySelectorAll('.snt-card.picked').length;
    var on = box.classList.contains('on');
    box.click();
    return { picked: picked, on: on, after: document.querySelectorAll('.snt-card.picked').length };
  })()`);
  check('目录头复选框全选该目录网段', grpPick.picked === 6 && grpPick.on === true, JSON.stringify(grpPick));
  check('目录头再点取消该目录选择', grpPick.after === 0, JSON.stringify(grpPick));

  const batchDel = await ev(`(function(){
    var cards = document.querySelectorAll('.snt-card');
    cards[0].click();
    cards[1].click();
    var nBefore = Store.state.data.subnets.length;
    document.getElementById('side-del').click();
    var d = document.getElementById('confirm');
    var body = document.getElementById('cf-body').textContent;
    document.getElementById('cf-foot').querySelector('.btn.primary').click();
    return { opened: !!body, body: body.slice(0, 60), nBefore: nBefore,
             nAfter: Store.state.data.subnets.length,
             barOpen: document.getElementById('side-bar').classList.contains('open'),
             pickBtn: document.getElementById('side-pick-btn').textContent };
  })()`);
  check('批量删除有确认框并说明记录数', /2/.test(batchDel.body) && /网段/.test(batchDel.body), JSON.stringify(batchDel));
  check('批量删除生效', batchDel.nBefore === 6 && batchDel.nAfter === 4, JSON.stringify(batchDel));
  check('删除后退出多选模式', batchDel.barOpen === false && batchDel.pickBtn === '多选', JSON.stringify(batchDel));

  // Shit 范围选择
  const range = await ev(`(function(){
    document.getElementById('side-pick-btn').click();
    var cards = document.querySelectorAll('.snt-card');
    cards[0].click();
    var ev2 = new MouseEvent('click', { bubbles: true, shiftKey: true });
    cards[2].dispatchEvent(ev2);
    var picked = document.querySelectorAll('.snt-card.picked').length;
    document.getElementById('side-pick-btn').click();   // 退出
    return { picked: picked };
  })()`);
  check('Shift 点击可范围勾选', range.picked === 3, JSON.stringify(range));

  // 滚动条隐藏但可滚轮滚动（把窗口压矮，强制侧栏溢出）
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 360, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  const scroll = await ev(`(function(){
    var el = document.getElementById('subnet-list');
    var cs = getComputedStyle(el);
    var barW = el.offsetWidth - el.clientWidth;
    var barH = el.offsetHeight - el.clientHeight;
    var canScroll = el.scrollHeight > el.clientHeight;
    el.scrollTop = 400;
    var moved = el.scrollTop;
    el.scrollTop = 0;
    return { scrollbarWidth: cs.scrollbarWidth, barW: barW, barH: barH, canScroll: canScroll, moved: moved };
  })()`);
  check('侧栏滚动条已隐藏', scroll.scrollbarWidth === 'none' && scroll.barW === 0 && scroll.barH === 0, JSON.stringify(scroll));
  check('侧栏内容仍可滚动', scroll.canScroll === true && scroll.moved > 0, JSON.stringify(scroll));
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(400);

  // ---------- favicon（CSP 仅允许 data:，不能是外链）----------
  const fav = await ev(`(function(){
    var links = Array.prototype.map.call(document.querySelectorAll('link[rel*="icon"]'), function(l){
      return { rel: l.getAttribute('rel'), href: (l.getAttribute('href')||'').slice(0, 30),
               scheme: (l.getAttribute('href')||'').split(':')[0] };
    });
    return { links: links };
  })()`);
  check('已声明 data URI favicon', fav.links.length >= 1 && fav.links[0].scheme === 'data', JSON.stringify(fav));
  check('favicon 不含外链（符合 CSP）', fav.links.every((l) => l.scheme === 'data'), JSON.stringify(fav.links));

  check('无运行时异常', errors.length === 0, errors.map((e) => JSON.stringify(e)).join('|').slice(0, 300));

  console.log('===== UI 断言 =====');
  out.forEach((r) => console.log((r[1] ? '✓' : '✗') + ' ' + r[0] + (r[2] ? '  [' + r[2] + ']' : '')));
  console.log(`\n${out.filter((r) => r[1]).length} / ${out.length} 通过`);
  child.kill();
  process.exit(out.some((r) => !r[1]) ? 1 : 0);
})();
