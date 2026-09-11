# Progress Log

## 2026-09-08

- Read repository instructions and relevant skills.
- Confirmed the requested scope: implement non-Excel, non-IPv6 TODOs.
- Inspected the TODO list and the relevant `index.html` sections for data, panel, wizard, IO, and events.
- Added standalone `hostname` support across the record model, panel, search, import mapping, auto-map, CSV/XLSX export, and selftests.
- Added a top-level status keyword rules dialog sharing the existing persistence and editor behavior with the import wizard.
- Added explicit CSV-only UI/file-picker fallback when `DecompressionStream` is unavailable.
- Updated README and TODO status/capacity/column documentation.
- Verified JavaScript syntax and Edge runtime behavior: selftest `32 / 32`, no selftest failures, hostname save/export, auto-map, rules dialog, and legacy fallback checks passed.
- Began a UI consistency pass using Edge screenshots of the grid, detail panel, rules dialog, import wizard, and context menu states.
- Unified dialog, control, popover, menu, batch bar, rules editor, and import wizard styling with shared tokens and semantic classes.
- Removed user-visible layout inline styles from subnet creation, mapping confirmation, sheet selection, import reports, rules actions, and export menus.
- Added responsive fallbacks for 900px/720px layouts and a stable mobile grid width to prevent IP labels from overlapping.
- Re-ran Edge visual regression at desktop, 390px, and dark-theme states; verified `?selftest` at 32 / 32 with no failures.
- Began NetBox integration audit against the current `netbox-community/netbox` main branch and release `v4.7.0`; confirmed REST bulk write support and identified IPAM/DCIM mapping and browser security boundaries.
- Completed the NetBox audit: recommended Prefix + IPAddress as the first sync scope, explicit prerequisite/lookup configuration for Device/DCIM data, dry-run plus non-destructive writes, and a local bridge or same-origin deployment for token safety.
- Implemented first-stage NetBox client in `index.html`: in-memory configuration/token, connection test, paginated Prefix/IPAddress reads, diff preview, explicit conflict policy, and separate bulk create/update requests with local remote-ID links.
- Added NetBox mapping selftests and README guidance for HTTP serving, CORS, and token handling.
- Completed Edge browser selftest at `35 / 35`; verified NetBox dialog at desktop and 390px viewport with no horizontal overflow and no console errors.
- Completed cross-origin mock NetBox regression: remote reads, Prefix PATCH, IPAddress POST/PATCH, Bearer header, remote-ID persistence, and token non-persistence all passed.
- Added optional Cloudflare Worker proxy integration: exact page-origin and NetBox-origin allowlists, `/api/` path restriction, read/write method allowlist, CORS preflight, streamed upstream responses, and no Token persistence.
- Added Worker deployment configuration and README instructions; local Worker security matrix passed and Edge selftest passed at `37 / 37`.
- Fixed NetBox credential input handling so bare tokens and complete `Bearer`/`Token` Authorization values are normalized without duplicate schemes; deployed Worker version `64de4b69-bb40-46b9-85ba-349b765a4d1d`, and Edge selftest now passes at `38 / 38`.

## 2026-09-09

- Implemented optional NetBox DCIM synchronization for Device, Interface, MAC, Interface IP assignment, and Device primary IPv4.
- Added remote DCIM catalog reads, Site/Device Type/Device Role selectors, existing-only versus create-missing policy, management-IP policy, and responsive preview configuration.
- Added dependency-aware execution: Prefix → Device → Interface → IPAddress → Device primary IPv4, with returned IDs injected into dependent payloads.
- Added separate `_netbox.device`, `_netbox.interface`, and `_netbox.management` links while preserving the existing direct IP link; destructive rebinding and MAC conflicts are skipped with warnings.
- Added DCIM preview sections and failure labels for Devices, Interfaces, MAC changes, assignments, primary IPv4, and dependency failures.
- Browser selftest now passes `42 / 42`; desktop and 390px checks pass with no console errors or horizontal page overflow.
- Cross-origin mock NetBox regression passed: catalog reads, Device/Interface/IPAddress creates, assignment IDs, primary IPv4 PATCH, remote-link persistence, and token non-persistence.

## 2026-09-09（NetBox 第三阶段）

- Added Prefix metadata synchronization for local VLAN plus configurable NetBox VRF, Tenant, Tags, and Custom Fields defaults.
- Added remote catalog matching by ID/name/Slug with non-blocking warnings when optional catalog entries are unavailable.
- Added explicit local device-type to NetBox Device Type mapping controls while preserving automatic matching and default fallback.
- Added normalized NetBox target fingerprints to remote links; legacy links without a target are not reused across instances.
- Added dependency-preserving batch writes capped at 100 objects/about 3.5MB, transient-error retries, and object-level failure tracking.
- Added result-page retry for failed objects and credential-free JSON/CSV failure report export.
- Browser selftest passed `47 / 47` plus asynchronous zip; Mock NetBox bulk and retry regressions passed; Worker typecheck passed.

## 2026-09-11（真实 Excel 解析与华为格式导出）

- 分析用户上传的 `华为设备已配置IP统计.xlsx`：单表 `A1:F13`，列 `子网/设备名称/接口名称/接口IP/掩码/备注`，共享字符串 + 列宽 + 表头筛选；用 openpyxl 取得权威值。
- 确认该文件原本**完全无法导入**：自动映射不识别 `接口IP`/`掩码`，IP 必选映射缺失导致向导拒绝；且 `IO.Xlsx.write` 实参形状错误使导出为空表。
- 新增 `mask` 记录字段与 `Calc.maskToPrefix`/`prefixToMask`/`cidrFromIpMask`（支持 `24`、`/24`、`255.255.255.0`，拒绝非连续掩码）。
- 新增 `TABLE_PROFILES` 预设格式与 `Wizard.detectProfile`：表头含 `ip/name/iface/mask` 即识别为华为格式并自动映射，弹确认框可改回手工映射。
- 导入新增「接口IP + 掩码 → 规范化网段」推导；掩码为空的行沿用同设备最近掩码；同一 IP 多设备合并为一条并把对端设备写入备注。
- 「子网」列作为网段名称/分组（自动创建的网段以该值命名）。
- 新增「导出华为格式」（xlsx/csv）6 列，列宽与表头筛选对齐参考表，并把合并的同址设备还原为独立行；原 12 列导出保留。
- 面板新增「掩码」字段（渲染/收集/草稿/软校验），修复保存后软校验标记被 `Panel.render()` 清空的问题。
- 新增 `tools/` 可复跑验证：`extract-check.js`、`cdp-test.js`、`ui-test.js`、`verify_export.py`、`shots.js`。
- 验证结果：内建 selftest `62/62`；真实 xlsx 端到端 `31/31`（含导出→重导入往返）；UI DOM `15/15`；openpyxl 导出校验通过；运行时异常 0。
- 追加边界测试 `tools/edge-test.js` `13/13`，并修掉其中暴露的真实缺陷：掩码继承原为单趟且只按设备名。若「无掩码行」出现在「有掩码行」之前，或同一设备存在多种掩码（本表同时有 /24 与 /30），会把主机**静默归入错误网段**。改为全表预扫描：优先「设备+接口」精确匹配，设备级回退仅在唯一掩码时使用，否则报 badMask 交人工判断，不再猜测。
- 按用户要求调整导出语义：**「子网」列导出留空，供人工在 Excel 维护**；新增导入模板持久化（`ipviewer.template.v1` 记住表头与列序），使**导入什么格式、导出就什么格式**；模板未覆盖的字段汇总进备注列，不丢信息。
- 修复模板改造中自查发现的冗余：`assigned` 为隐含默认值，原会把「状态: 已分配」写进备注；已改为不输出。
- 最终验证：内建 selftest `67/67`；真实 xlsx 端到端 `34/34`（含乱序列序模板复现与往返）；UI DOM `15/15`；边界 `17/17`；openpyxl 导出校验通过。
