# IPViewer — 项目状态与待办清单

> 更新时间：2026-09-09（NetBox 第三阶段）
> 项目路径：`D:\Desktop\code\vibe\IPViewer`
> 产物：`index.html`（单文件全内联）+ `README.md`

---

## 一、项目概况

离线环境的 IP 地址池手工登记工具（IPAM）。参考 [ip-pool-visualizer v6.0.0](https://gitee.com/do-first_admin/ip-pool-visualizer)（Python FastAPI + Vue3，扫描驱动）的交互模式，提取精华做轻量化：**纯前端单文件 HTML，双击即用，手工登记驱动，零外链零依赖**。

### 已确认的核心决策

| 决策点 | 结论 |
|---|---|
| 运行形态 | 纯前端单文件 HTML，无后端/无构建/无 CDN |
| 持久化 | localStorage + JSON 导入导出（唯一可靠备份手段） |
| 网段规模 | 多网段，任意掩码（/24 /25 /30 /31 /32 等） |
| 状态模型 | 手动四态：已分配(绿)/空闲(灰)/预留(蓝)/冲突(红) |
| Excel 映射 | 首次导入列映射向导，映射持久化，二次自动应用 |
| 明确不做 | 扫描(ARP/ICMP/TCP)、交换机SSH、登录/JWT/License、后端、数据库、IPv6 |

---

## 二、已完成 ✅

### P0 骨架
- [x] HTML 分区布局（header / 侧栏网段列表 / 格子图区 / 侧滑面板 / dialog / footer）
- [x] CSS 变量主题（亮/暗，`[data-theme]` 覆盖，跟随 `prefers-color-scheme`，手动切换持久化）
- [x] 单 IIFE 十分区 JS 架构（常量→工具→Calc→Data→Store→Render→Panel→IO→Events→App）
- [x] 单一 Store + 发布订阅，`Store.act()` 唯一 mutation 入口，防抖 150ms 落盘
- [x] 事件委托（document 级 `data-action` 分发，格子无独立监听器）

### P1 数据层 + Calc
- [x] schema v1（`ipviewer.data.v1`，subnets[].ips 字典稀疏存储，空闲=记录不存在）
- [x] 4 个 LS key：data / settings / colmap / backup
- [x] 版本迁移链（`Data.migrate`，LS 与 JSON 导入共用）
- [x] backup 槽（导入/恢复前自动备份，footer 一键恢复）
- [x] Calc 纯函数层：`parseCidr/ipToUint/uintToIp/idxToIp/roleOf/usableCount/inSubnet/idxOfIp/normalizeCidr`
- [x] `/31`（RFC 3021）/`/32` 边界处理；网络/广播地址识别
- [x] `/20`（4096 格）渲染硬上限，超限停用格子图改提示搜索登记
- [x] 内建自测页（`index.html?selftest`，30+ 断言，浮动面板不覆盖 UI）

### P2 网段管理
- [x] 侧栏列表（名称+CIDR+VLAN+利用率条）
- [x] 新增/编辑/删除（删除需确认，提示记录数）
- [x] CIDR 校验/主机位规范化提示（192.168.10.77/24 → 192.168.10.0/24）
- [x] 重复网段拦截、大网段创建前警告

### P3 格子图
- [x] renderGrid（一次 innerHTML，全量 esc() 转义）
- [x] 密度 16/32/64 列、字号 10/12/14px（纯 CSS 变量切换，零重排）
- [x] 四态配色 + 图例（点击图例 chip = 筛选该状态）
- [x] 统计条（总地址/可用/已分配/预留/冲突/空闲/利用率%）
- [x] 网络/广播格灰底斜纹 + 不可标记已分配
- [x] 悬浮提示（完整 IP + 设备名/状态）
- [x] /23 及更小前缀每 256 地址块插入分组分隔行

### P4 详情面板
- [x] 右侧滑入面板（380px，格子图保持可见）
- [x] 状态分段按钮点即存；其余字段「保存」提交
- [x] 字段：设备名称/管理IP/使用接口/MAC/用途/设备类型(8种)/备注
- [x] 管理 IP / MAC 软校验（红字提示不阻断）
- [x] 清除登记（confirm）、空记录自动删除
- [x] 键盘 ←→↑↓ 相邻格切换、Esc 关闭
- [x] 越界保护（setIp 前验证 IP 属当前网段）

### P5 导入导出
- [x] JSON 全量导出/导入（含迁移链、覆盖前自动备份）
- [x] Mini-XLSX 读取器（EOCD 扫描→中央目录→DEFLATE 解压用原生 `DecompressionStream`，sharedStrings/inlineStr/公式缓存值）
- [x] Mini-XLSX 写出器（STORE zip + CRC32 查表法，5 条目最小合法包）
- [x] CSV 读写（GBK/UTF-8 自动识别、状态机解析引号转义、导出带 BOM）
- [x] 列映射向导三步：选 sheet → 预览 10 行 → 字段映射（IP 必选）
- [x] 表头关键词自动猜测映射 + colmap 持久化（表头指纹一致则下次免映射）
- [x] 状态值关键词归一（分配/在用→assigned，预留→reserved，冲突/异常→conflict）
- [x] 合并策略（默认合并非空字段 / 跳过已登记 IP）
- [x] 按文件「所属网段」列分组自动建段
- [x] footer 实时体积显示，>3MB 黄色预警
- [x] 双标签页防护（storage 事件提示刷新）
- [x] 旧内核检测（缺 Promise/dialog 提示用 Edge）
- [x] @media print 打印样式

### P13 审计项全量实现（2026-09-11 第 7 轮，6 agent 并发 + 集成）

- [x] **撤销/重做**：Ctrl+Z / Ctrl+Y（输入框内忽略），footer 撤销/重做按钮随可用态禁用；可撤销 action 白名单（UI-only 不入历史），栈深 30，内存态（刷新清空）
- [x] **多级时间戳快照**：导入/恢复前自动落 5 份环形快照（LS.snaps），footer「快照」可查看时间列表并按份恢复，恢复前自动再备份
- [x] **下一个可用 IP 推荐**：面板「下一个空闲」+ 工具条「跳到空闲」，`Calc.nextFreeIp` 环形扫描（跳过网络/广播位，/31 /32 正确，全满报错提示）
- [x] **面板登记/更新时间**：`ip-set` 首次登记写 `createdAt`；面板底部小字「登记 … · 更新 …」
- [x] **全库冲突扫描**：工具条「冲突扫描」，跨网段重复登记 IP 表格化展示（可复制），超 20 组截断
- [x] **全局总览仪表盘**：header「总览」，聚合网段/目录/记录/四态/整体利用率 + Top5 利用率条（坏网段与 /0 跳过计数）
- [x] **格子图导出 PNG**：工具条「导出图片」，canvas 绘制（统计行/四态/网广角标/选中描边/图例/时间戳），白底不随主题，超限自动重排
- [x] **高级搜索**：工具条「高级」展开（IP 前缀 + 字段限定 + 关键词），与顶部搜索/图例筛选三重 AND 叠加，均有 dim/hit 反馈
- [x] **日期列支持**：导入映射步骤「日期列转换」折叠区勾选列，Excel 序列 → YYYY-MM-DD（含 1900 幽灵日语义），随 colmap 持久化
- [x] **记录标签系统**：面板「标签（逗号分隔）」输入（规范化去重）、导入映射 targets/自动归一、13 列导出「标签」列、顶部搜索与高级搜索字段均匹配
- [x] 集成修复：`ip-set` 补写 `createdAt`；`window.__test` 导出 PanelExtras/Audit/PngExport
- [x] 回归：selftest **100/100**、合并回归 11/11、网段多选 9/9、标签专项 8/8、tools 三套件 37/47/21 全过，零运行时异常
- 实现方式：6 个 git worktree 分支并发 subagent（undo-snap / panel-extras / audit-tools / grid-png / adv-search / wizard-dates），逐分支合并解决 selftest 锚与工具条锚冲突；测试基建注意：headless 页面打开超 5 分钟会被 Chromium 冻结（定时器全停），CDP 套件需 `Page.setWebLifecycleState({state:'active'})` 解冻

### P12 网段多选批量删除（2026-09-08 第 6 轮）

- [x] **网段多选批量删除**：侧栏「多选」按钮进入勾选模式（卡片带复选框），点击勾选/取消、Shift 范围选、目录头全选该目录、「全选/取消全选」，底部批量条显示已选数与登记记录数，删除前确认（含记录数警示）；批量删除后激活网段自动切换、清空时回欢迎页。Store 层新增 `subnet-delete-many`（返回删除数）
- [x] **修复：`Store.act` 不透传返回值**——批量删除后 toast 显示"已删除 undefined 个网段"。act 现在返回 action 的返回值
- [x] **修复：`?selftest` 桩测试污染真实数据**——桩测试整体替换 Store.state 后 `Store.act` 会把桩数据持久化进 localStorage，测试结束内存恢复但磁盘已脏，后续正常打开会加载出测试垃圾网段。现同步用例执行期间抑制落盘（`Store.suppressPersist`），测试渲染完成即恢复
- [x] **回归**：内建 selftest 80/80；新增合并回归套件 11/11（`%TEMP%\regress_all.js`，覆盖 P7-P11 关键路径）；网段多选 UI 路径 9/9（`%TEMP%\sidepick_test.js`）；零运行时异常
- [x] 测试基建迁移：%TEMP% 旧套件被系统清理后已按 todo 预案重写为合并套件（selftest_run / regress_all / sidepick_test）

### P7 MVP 反馈修复（2026-09-08）

- [x] **面板保存逻辑重做**（用户反馈：空闲格点"保存"无提示且自动变已用）：
  - 空闲格 + 无任何字段 → 保存报"未填写任何信息"错误提示，**不再自动变已分配**、不产生记录
  - 填写字段保存 → 首次登记默认按已分配处理（可先点状态按钮覆盖），保存后 toast "已保存"
  - 已有状态（reserved/conflict 等）的记录保存字段 → 状态保持不变
  - 网络/广播地址面板保存字段 → 保持角色状态（与状态按钮拦截规则一致），新增 `.st-network/.st-broadcast` CSS 类（原 `.st-net` 只覆盖 network 一种）
  - 状态按钮即时保存不再冲掉未保存的字段草稿（`Panel.applyDraft` 回填）
- [x] **CIDR 规范化提示语义化**（用户反馈："主机位非 0"太晦涩）：
  - 新文案："「192.168.22.35/22」不是 /22 网段的网络地址。掩码 /22 表示前 22 位是网络位，网络地址须是网段的首个地址；输入中 192.168.22.35 的低 10 位（主机位）不为 0。将按网络地址 192.168.20.0/22 处理，是否继续？"
- [x] **连带修复：规范化确认框复用 `#dlg` 导致表单被销毁**——原实现在确认回调里 `$('#d-cidr').value = fixed` 会抛异常（元素已被覆盖不存在），即"输入非网络地址 → 确认"路径实际走不通。新增独立 `<dialog id="confirm">` 元素供所有 `Dialog.confirm` 使用（栈式叠加于表单之上）
- [x] **连带修复：`Wizard.confirmAuto` 的"重新映射"按钮无效**（原 todo 中优先级 bug）——取消按钮文案虽为"重新映射"但 onclick 只是关闭对话框。`Dialog.confirm` 扩展 `cancelLabel/onCancel` 参数，取消即进入 `Wizard.renderMapUI()`；同时删除无效的 MutationObserver 死代码

### P8 UI 修复与体验打磨（2026-09-08 第 2 轮）

- [x] **修复 CSS 损坏导致整页布局崩坏**（用户反馈：详情面板变成页面底部的裸表单）：`.cell.st-network/.st-broadcast` 规则在上一轮编辑中产生了重复行 + 未闭合块，从损坏点起后续全部 CSS（#panel、dialog 等 60+ 条规则）解析失败。修复重复规则
- [x] **修复对话框顶部贴边**：全局 `* { margin:0 }` 重置清掉了 `<dialog>` 的 UA 默认 `margin:auto` 居中，对话框贴在视口顶部。在 `dialog {}` 中补回 `margin:auto`
- [x] **UI/UX 丝滑度优化**（frontend-design 技能不可用，人工评审实施，全部为低风险 CSS/微 JS 改动）：
  - 格子：hover/选中/按下过渡（box-shadow/opacity/transform），按下有 scale(.93) 微缩反馈
  - 网段卡片：hover/active 过渡；利用率条宽度 350ms 缓动动画
  - 按钮（hbtn/btn）：统一 hover 变色过渡 + 按下 1px 下沉；primary hover 提亮
  - 输入框：聚焦时 accent 色 3px 柔光圈（box-shadow）；搜索框同样处理
  - 状态分段按钮：非选中项 hover 预览 accent-soft 底色，切换平滑
  - 详情面板：遮罩从 display 硬切改为 220ms 透明度淡入淡出；滑入曲线改 cubic-bezier(.32,.72,.34,1)（更自然的减速感）
  - toast：新增 fadeout 退场动画（原来直接消失），容器 pointer-events 穿透避免挡住底部按钮
  - 图例 chip：hover 反馈
  - 无障碍：`prefers-reduced-motion` 下全部动画/过渡时长归零
- [x] 回归验证：修复测试 19/19、e2e 22/22、selftest 30/30、零运行时异常

### P9 功能核查与图例筛选修复（2026-09-08 第 3 轮）

- [x] **全面功能核查**：44 项代码特征扫描全通过；四套测试（fix 19 + e2e 22 + xlsx 11 + selftest 30）全通过；新增功能级审计（`%TEMP%\audit_final.js`）：网段增删改/越界清理/统计/图例筛选/搜索/键盘导航/backup 回滚/双标签页防护/刷新持久化
- [x] **修复：图例筛选无视觉反馈**（真 bug）——`Render.grid` 中 `dim`/`hit` class 只在搜索词存在时添加，纯状态筛选时不符合的格子不变暗，点图例 chip 看不到任何效果。改为 `(q || filter)` 驱动（index.html Render.grid）
- 审计中其余 4 个 FAIL 均甄别为测试脚本自身问题（旧 chip 元素引用失效/断言计数未含网络广播格），产品代码无问题

### P10 功能补全（2026-09-08 第 4 轮）——不依赖 Excel 的待办全部完成

- [x] **右键快速改状态**：格子上右键弹出四态菜单（含当前 IP 与状态），点选即时保存；网络/广播地址拦截"已分配"（`Batch.menu`）
- [x] **批量操作**：Ctrl/Cmd 点击多选、Shift 点击范围选择，底部浮动条显示已选数 + 四态一键批量设置 + 取消；批量时网络/广播格自动跳过并提示（`Batch` 分区，#batch-bar）
- [x] **「并入备注」落地**：映射步骤可选多列「并入备注」，导入时以「表头: 值；表头: 值」拼接进 note 字段（原为空操作）
- [x] **导入明细报告**：越界/异常/IP 为空的行在导入完成后弹明细框，一键复制全部明细（原仅 console.warn）
- [x] **状态映射规则可编辑**：映射步骤内嵌折叠编辑器，规则（正则关键词 → 状态）可增删改，持久化 LS.keywords（`Data.loadKeywords/saveKeywords`），英文内置关键词始终优先
- [x] **改 CIDR 越界确认**：编辑网段缩小范围时，若有记录将越界，先确认"N 条记录将被删除"再保存（原静默删除）
- [x] **网段排序**：侧栏头部排序下拉（默认/按名称/按网段/按利用率），设置持久化
- [x] **CSP meta 加固**：`default-src 'none'` + 内联白名单，禁一切外部资源加载与远程代码
- 开发期修复：`Data.loadKeywords` 曾误置于 Data 声明前导致 IIFE 中断（页面全挂），已挪入 [4] Data 分区

### P11 localStorage 存储专项审计（2026-09-08 第 5 轮）

- [x] **容量实测**（Edge 152 headless，UTF-16 编码）：单源配额 **约 5.0M 字符 ≈ 9.9MB**（QuotaExceededError 边界）；典型登记记录（9 字段全满 + 50 字备注）约 276 字符/552 字节
- [x] **性能实测**：2k 条/379KB 写 2ms；10k 条/1.9MB 写 14ms 读 1ms 解析 16ms；15k 条/2.8MB 写 22ms——万条级完全无感
- [x] **风险场景验证**：
  - 配额满时增长型写入被拒 → `Data.save` 捕获 QuotaExceededError，toast「存储空间已满」提示，**内存态不丢**（可立即导出 JSON 抢救）✅
  - 主数据 JSON 损坏 → 启动时自动从备份槽恢复并提示 ✅
  - 恶意/畸形 JSON（__proto__ 键等）→ `JSON.parse` 后仅作数据使用，无原型污染崩溃路径 ✅
  - 双标签页并发写入 → storage 事件提示刷新 ✅
  - 全部 LS 访问均包裹 try/catch，存储被禁（隐私模式）不阻塞启动 ✅
- [x] **审计结论**：当前实现（稀疏存储 + 单 key 全量 JSON + 防抖 150ms 落盘 + backup 槽）在 <1 万条记录场景下**无引入性风险**；远期风险与缓解见「已知限制」表
- 实测修正：todo 原记载「~5MB / 2 万条触顶」偏保守，实际约 **9.9MB / 1.5~2 万条**（取决于记录字段充实度）

### P12 剩余非 Excel/IPv6 待办（2026-09-08 第 6 轮）

- [x] **独立主机名/域名字段**：新增 `hostname` 字段，接入详情面板、搜索、JSON 持久化、CSV/XLSX 导入导出和自动列映射
- [x] **状态映射规则全局入口**：顶部「状态规则」可直接编辑并持久化正则关键词，和导入向导共用编辑器
- [x] **旧浏览器导入降级**：缺少 `DecompressionStream` 时导入按钮切换为「导入 CSV」，文件选择器仅允许 CSV；JSON 备份不受影响
- [x] **清理已完成占位项**：同步关闭此前已由 P10 实现但仍显示为未完成的 CIDR 越界确认、批量操作、CSP 加固

### NetBox 第三阶段已完成（2026-09-09）

- [x] **Prefix 元数据**：同步本地 VLAN，并支持按远端目录匹配 VRF、Tenant、Tags 和 Custom Fields 默认值；可选目录缺失时仅告警
- [x] **设备类型映射**：为交换机、路由器、服务器、AP、摄像头、打印机、PC、其他提供显式远端 Device Type 映射
- [x] **远端实例隔离**：持久化归一化 NetBox 地址指纹，避免不同实例复用旧 ID；兼容旧数据的内容匹配回退
- [x] **大批量与重试**：每批最多 100 个对象且约 3.5MB，保持 Prefix → Device → Interface → IP → 主 IPv4 顺序；临时失败自动重试
- [x] **失败报告**：结果页显示对象级失败，可重试失败项并导出 JSON/CSV，报告不包含 Token

### P6 部分打磨
- [x] 搜索高亮（命中格 hit 发亮、未命中 dim 变暗，支持 IP/设备名/用途/MAC 等字段）
- [x] 方向键移动选中
- [x] 状态 chip 筛选
- [x] README.md（含数据安全须知）

---

## 三、验证状态 ✅

| 测试 | 结果 | 方式 |
|---|---|---|
| Calc 层 14 项断言 | 14/14 | Node 提取 IIFE 分区直测 |
| CSV/CRC32/zip/XLSX 写 13 项 | 13/13 | Node vm 沙盒 |
| 浏览器端到端 22 项 | 22/22 | Edge CDP（`%TEMP%\e2e_test.js`） |
| xlsx 写→读闭环 + DEFLATE 解压 11 项 | 11/11 | Edge CDP（`%TEMP%\xlsx_test.js`） |
| **P7/P8 修复验证 19 项** | **19/19** | Edge CDP（`%TEMP%\fix_test.js`，实时重写；空闲保存 5 项 / 字段保存 3 项 / 状态保持 3 项 / 网络 1 项 / CIDR 规范化 6 项 / 零异常） |
| **P9 功能审计 5 项** | **5/5** | Edge CDP（`%TEMP%\audit_final.js`；搜索/图例筛选/叠加/持久化） |
| **P10 新功能验证 12 项** | **12/12** | Edge CDP（`%TEMP%\p10_test.js`；CSP/右键菜单 3 项/批量 3 项/排序 3 项/越界确认/状态规则） |
| 导出 xlsx 兼容性 | 通过 | Python openpyxl 打开验证（zip CRC 全对、中文完好、列结构正确） |
| **华为格式端到端 37 项** | **37/37** | Edge CDP（`tools/cdp-test.js`，真实 xlsx：读取→识别→导入→建目录→模板导出→往返） |
| **UI DOM 断言 47 项** | **47/47** | Edge CDP（`tools/ui-test.js`，多选批量删除/滚动条/目录分组/favicon/390px 无溢出） |
| **边界用例 21 项** | **21/21** | Edge CDP（`tools/edge-test.js`，掩码继承/行序/模板复现/目录归类/幂等） |
| **华为格式导出兼容性** | **通过** | openpyxl（`tools/verify_export.py`：A1:F13、列宽、autoFilter、子网回填、VRRP 还原） |
| **favicon 加载** | **通过** | `tools/verify-favicon.js`（浏览器实载 32×32，无 CSP 拦截）+ `verify_favicon.py`（SVG 合法性） |
| 运行时异常 | 0 | CDP Runtime.exceptionThrown 监听 |
| 内建 selftest | 80/80（含异步 zip 检查） | `index.html?selftest` |

**开发期发现并修复的 bug**：
1. `IO.Xlsx.read()` 把异步 zip 解压当同步用 → 修复为 Promise 链（`parseZip` 返回 Promise，原实现永远报"缺少 workbook.xml"）
2. xlsx 读取器行尾空单元格未补齐（稀疏行丢列）→ 修复为按全表最大列数补齐
3. `?selftest` 页覆盖整个 UI → 改为浮动面板
4. 测试基建：`?selftest` 模式下暴露 `window.__test` 句柄（仅 selftest 时，正常使用无影响）
5. **对话框复用冲突**：`Dialog.confirm` 与 `Dialog.promptSubnet` 共用 `#dlg` 元素，确认框打开即销毁表单 DOM，回调引用 `$('#d-cidr')` 抛异常 → 拆分独立 `#confirm` 对话框（2026-09-08）

---

## 四、待办事项 📋

### 高优先级（等用户输入）

- [x] **真实 Excel 验证**（2026-09-11）：以真实文件「华为设备已配置IP统计.xlsx」端到端验证通过：
  - Mini-XLSX 读取器兼容该文件（共享字符串、A1:F13、空单元格、列宽、autoFilter）
  - 新增**预设格式自动识别**：表头含「设备名称/接口名称/接口IP/掩码」即识别为华为格式，跳过手工映射
  - 新增 `mask` 字段与「接口IP + 掩码 → 网段」推导，该文件推导出 6 个网段
  - 空掩码行（HSRP/VRRP 虚地址）按「同设备+同接口」继承，多掩码且无法判定时报 badMask 不猜测；同一 IP 多设备合并并记入备注
  - 导出新增「华为格式」（含列宽与表头筛选），导出→重导入往返一致
  - 导出**沿用导入文件的表头与列序**（模板持久化于 `ipviewer.template.v1`）；「子网」列回填目录名
- [x] **目录分组 = 表格「子网」列**（2026-09-11）：侧栏新建 `ATD`/`ADR` 等目录收纳多个网段，可折叠、显示汇总、删除目录不删网段；导入按「子网」列自动归类、导出回填目录名（两边同一概念，无需人工维护）；schema 升 v2 并带迁移
- [x] **网段批量删除**（2026-09-11）：侧栏「多选」+ 卡片勾选 + Shift 范围 + 目录头整组全选，确认框写明网段数与记录数
- [x] **侧栏滚动条常隐 + 内联 SVG 标签图标**（2026-09-11）：滚动条隐藏但滚轮照常；favicon 用 data URI 以符合 CSP（`img-src data:`）
- [ ] **日期列支持**：向导缺少计划中的「数值列为日期」勾选（Excel 日期序列 → JS 日期，1899-12-30 历元）。当前参考表无日期列，暂不需要

### 中优先级（功能缺口）

- [x] **状态映射规则编辑器 UI 化验证**：顶部「状态规则」提供不依赖导入向导的全局入口，和向导内编辑器共用持久化逻辑

### 低优先级（打磨/远期）

- [x] subnet-edit 时修改 CIDR 的越界 IP 清理及确认提示（P10）
- [ ] IPv6 支持（schema 已预留版本位，当前不做）
- [x] 批量操作：Ctrl/Shift 多选格子并批量设置状态（P10）
- [x] CSP meta 标签加固（P10）
- [x] 域名/主机名独立字段（P12）

### 逃生舱（备用方案，触发条件明确）

- [ ] 若真实 xlsx 出现 Mini 读取器兼容问题（加密/异形 zip/非常规样式依赖）→ 内联 SheetJS CE（Apache-2.0）替换 `[8] IO` 分区，单文件涨至 ~1.1MB，架构不变
- [x] 启动时检测 `DecompressionStream`；缺失时降级为仅 CSV/JSON 导入

---

## 五、已知限制 ⚠️

| 限制 | 说明 | 缓解 |
|---|---|---|
| localStorage 容量约 9.9MB | 约 1.5~2 万条记录触顶，取决于字段长度 | footer 体积预警；稀疏存储；JSON 备份 |
| **清浏览器数据 = 丢数据** | file:// 无其他持久化手段 | README 常驻提醒；导出 JSON 为官方备份路径 |
| /20 以下网段无格子图 | DOM 渲染上限 4096 格 | 提示改用搜索登记 |
| 自签测试基建在 %TEMP% | `e2e_test.js`/`xlsx_test.js` 可能被系统清理 | 需要时按本文档"验证状态"重写（直连 CDP 协议，依赖 `ws`） |
| Excel 列格式未定 | 导出列序现为 12 列（IP/状态/设备名称/主机名/管理IP/使用接口/掩码/MAC地址/用途/设备类型/备注/网段），另提供华为格式 6 列导出 | 已按真实「华为设备已配置IP统计.xlsx」定型，见 README |
| **P11 实测修正** | 配额实测 **9.9MB**（非 5MB）；万条写入 14ms 无感；2 万条级别才需关注触顶 | footer 预警阈值 3MB 提前量足够；触顶时内存态保留可导出 |
| **远期风险：全量重写** | 单 key 全量 JSON，每次 act 全量序列化；>20k 条后每次保存 >30ms，高频操作可感 | 若出现：改按网段分 key 存储 / 迁移 IndexedDB（schema 已预留版本位，migrate 链就位） |

---

## 六、架构速查（二次开发用）

```
index.html
├─ <style>        CSS 变量主题（--cols/--cell-font 驱动格子布局）
└─ <script> IIFE
   [1] 常量配置    SCHEMA_VERSION(2) / LS key / STATUS_* / IMPORT_TARGETS / TABLE_PROFILES / STATUS_KEYWORDS
   [2] 通用工具    esc / debounce / uid / toast / fmtBytes
   [3] Calc        CIDR 纯函数（无状态，可独立测试）
   [4] Data        load/migrate(v1→v2)/save/backup/restore + settings/colmap/template
   [5] Store       state + ACTIONS + pub-sub（唯一 mutation 入口 Store.act）+ groupedSubnets
   [6] Render      subnetList(目录分组/折叠/多选) / sideBar / grid / stats / legend / footer
   [7] Panel       open/render/collect/save/quickStatus/clear/step + applyDraft/selectedStatus
   [7b] SideSel    侧栏网段多选（切换/范围/整目录/全选/批量删除，paint 局部刷新）
   [7c] Batch      格子图内 IP 多选与批量设状态
   [8] Dialog      confirm / promptSubnet（含目录选择器）/ promptGroup
   [9] IO          JSON / CSV / Xlsx.read(异步!)/write(widths) / Wizard（列映射 + 预设格式识别）
   [9a] TABLE_PROFILES 预设表格格式（华为设备 IP 统计表）
   [10] Events     document 级事件委托
   [11] App        boot() + ?selftest 入口（暴露 window.__test）
```

**关键设计**：
- `ips` 字典按 IP 串索引，稀疏存储（空闲 = 键不存在）
- 格子图只挂载当前激活网段；单 IP 变更走精准更新
- 所有用户数据回填 DOM 必须经 `esc()`
- Excel 读写无第三方库：读靠 `DecompressionStream('deflate-raw')` + `DOMParser`，写靠 STORE zip + 自算 CRC32
- `IO.Xlsx.read()` 返回 **Promise**（异步解压），调用方必须 await
- `IO.Xlsx.write([{name, rows, widths}], filename)` 接收**工作表对象数组**（旧调用 `[[rows]]` 是 bug，已修）
- 导入时若映射了 `mask` 列，则「接口IP + 掩码」优先推导网段；掩码缺失按「同设备+同接口」继承，无法判定时报 badMask
- 导入会在 `Wizard.run` 持久化**模板**（表头+列序），导出沿用它复现格式
- 目录 `groups[]` 与网段 `groupId` 是多对一归属；删目录只解除归属，不删网段；`Data.migrate` 会清理悬空 `groupId`
- 侧栏 `SideSel` 与格子图 `Batch` **刻意独立**：前者按 id 选网段（删除），后者选 IP（设状态），共用状态会互相干扰
- 勾选走 `SideSel.paint()` 局部刷新，**不重建列表**，否则连续点击会因 DOM 重建丢引用并丢滚动位置
- CSP 为 `img-src data: blob:`，故 favicon 只能内联 data URI，不能引外部 `.ico`

**回归测试方法**：
```bash
# 1. 启动调试 Edge
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --remote-debugging-port=9222 --user-data-dir="$TEMP/edge-debug-profile" \
  --no-first-run "file:///D:/Desktop/code/vibe/IPViewer/index.html"

# 2. 重跑测试（需 npm i ws，脚本在 %TEMP% 若被清理需重写）
cd "$TEMP" && node e2e_test.js && node xlsx_test.js

# 3. 或浏览器打开 index.html?selftest 看内建断言
```
