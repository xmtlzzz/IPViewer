# Findings

- The app is a single `index.html` with inline CSS and JavaScript; `README.md` and `todo.md` are the only other project files.
- `FIELDS` currently contains `name`, `mgmtIp`, `iface`, `mac`, `purpose`, `deviceType`, and `note`; there is no standalone hostname field.
- `IMPORT_TARGETS`, table headers, export rows, panel HTML, and panel collection/rendering all need coordinated hostname changes.
- `Wizard.renderKeywordEditor` exists only in the import mapping step. `Data.loadKeywords`/`saveKeywords` already provide the persistence layer.
- `IO.hasDecompress` detects `DecompressionStream`, but the import button always advertises/selects `.xlsx,.csv`; missing support currently fails only after an xlsx is selected.
- `todo.md` marks already-completed P10 work as unchecked with explanatory text and has stale storage wording in the known-limit table; those entries should be synchronized.

## Real Huawei Workbook Analysis (2026-09-11)

- The reference file `华为设备已配置IP统计.xlsx` has one sheet (`华为设备IP地址统计`, `A1:F13`): 1 header row + 12 data rows, shared strings, `<cols>` widths, and an `A1:F1` auto-filter.
- Columns are `子网 / 设备名称 / 接口名称 / 接口IP / 掩码 / 备注`. The 子网 values are short group labels (`ATD`), **not** CIDRs, so the existing wizard could not derive a subnet from them.
- `接口IP + 掩码` is the real subnet source: `192.168.156.9/24 → 192.168.156.0/24`, `192.168.249.145/30 → 192.168.249.144/30`. The data yields 6 subnets.
- Two rows (HSRP/VRRP virtual addresses) have an **empty 掩码** but share a device name with rows that do have one; and the same IP `192.168.156.1` appears under two different device names.
- The `IO.Xlsx.write` call site passed a bare rows array (`write([[headers].concat(rows)], ...)`) while the function reads `sh.rows` — export produced an empty worksheet; unreachable because `sheetXml` threw first.
- Before this change the file was not importable at all: the auto-map rules did not recognize `接口IP` or `掩码`, so `ip` stayed unmapped and the wizard rejected the file with "「IP 地址」为必选映射字段".

## Excel Parse/Export Resolution

- Added a `mask` record field with `Calc.maskToPrefix` / `Calc.prefixToMask` / `Calc.cidrFromIpMask` (accepts `24`, `/24`, `255.255.255.0`, and rejects non-contiguous masks).
- Added `TABLE_PROFILES` with a `huawei` preset; `Wizard.detectProfile` matches on `ip/name/iface/mask` and requires at least one extra column, so ordinary sheets are not mis-detected.
- Reordered `Wizard.autoMap` rules so `接口/端口` (iface) is tested before `名称` (name); previously `接口名称` was swallowed by the `名称` rule.
- Import derives the subnet from the mask column, inherits a missing mask from the same device name, and merges same-IP multi-device rows into one record (extra device kept in `note`) instead of silently overwriting the device name.
- Added a Huawei-format export (6 columns, matching column widths, header auto-filter) that restores merged same-address devices to separate rows; the default 12-column export is unchanged.
- Profile regexes must be case-insensitive: the real header is `接口IP` (uppercase), which a plain `/接口\s*ip/` misses.

## UI Audit

- Desktop screenshots show the grid and detail panel are serviceable, but dialog defaults are visible as a thick black focus outline and modal dimensions/padding are not tokenized.
- The status rules editor uses smaller, separate control metrics than the rest of the app; its rows and delete affordances look improvised.
- The import wizard mapping grid and preview table need the same control height, label rhythm, scroll treatment, and footer treatment as other dialogs.
- The export menu uses a one-off inline style instead of the shared surface vocabulary.
- The app is desktop-first with `body { min-width: 960px; }`; a narrow viewport needs a structural layout fallback so expanded UI remains usable.

## UI Polish Resolution

- All dialogs now share tokenized width, max-height, padding, footer, backdrop, radius, and shadow rules.
- Rules editor, import mapping, export menu, context menu, batch bar, and feedback controls now share the same control rhythm.
- Narrow layouts use a stacked shell and a stable horizontally scrollable grid; dialog controls remain within the viewport.
- Data-driven inline styles remain only for status swatches, utilization width, hidden copy helpers, and selftest/legacy fallback surfaces.

## NetBox Integration Audit

- NetBox `v4.7.0` exposes REST resources under `/api/`, including `ipam/prefixes`, `ipam/ip-addresses`, `ipam/vlans`, `dcim/devices`, `dcim/interfaces`, and `dcim/mac-addresses`.
- Current NetBox supports bulk `POST` creation and bulk `PUT`/`PATCH` updates by sending a JSON list to a list endpoint. Bulk writes are all-or-none; `background=true` is available for bulk operations in v4.7+.
- NetBox v2 tokens use `Authorization: Bearer nbt_<key>.<token>`; legacy v1 tokens use `Authorization: Token <token>` and are deprecated from v4.6.
- IPViewer's `free` cells are implicit and should not become individual NetBox IPAddress records; NetBox Prefix plus available-IP calculation represents that state better.
- IPViewer's `assigned`, `reserved`, and `conflict` statuses do not map one-to-one to NetBox IPAddress statuses. `assigned` can map to `active`, `reserved` to `reserved`; `conflict` needs a custom field/tag or an explicit user-selected fallback.
- IPViewer device name, interface, and MAC fields belong to separate NetBox Device/Interface/MACAddress resources. Direct synchronization therefore requires lookup/create policy and prerequisite selections such as Site, Device Type, Device Role, and Interface Type.
- The current tool remains a single-page app using `localStorage`; the first-stage client uses direct browser HTTP requests and has no backend proxy. Direct browser sync requires NetBox CORS configuration and permitting `connect-src` HTTP(S); storing a write-capable API token in browser storage is a security risk.

### Recommended Mapping

| IPViewer data | NetBox target | Decision |
|---|---|---|
| subnet `cidr` | `POST/PATCH /api/ipam/prefixes/` (`prefix`) | Direct. Resolve VRF/scope/VLAN first; use `description`/`comments` for name/note. |
| assigned IP | `POST/PATCH /api/ipam/ip-addresses/` (`address`, `status`) | Direct. Use `/32` by default for IPv4 host records because IPViewer stores no host mask. |
| hostname | IPAddress `dns_name` | Direct, subject to NetBox DNS validation. |
| reserved | IPAddress `status=reserved` | Direct. |
| free | No object | Do not create thousands of empty IPAddress records; NetBox calculates available addresses from Prefix. |
| conflict | custom field/tag plus base status | No native equivalent. Do not silently convert it to `deprecated`. |
| note | IPAddress `comments` or `description` | Direct after choosing one canonical field. |
| purpose | custom field/tag/description | No native free-text purpose field. |
| device name | Device `name` only if Device sync is enabled | Requires Site, Device Type, Device Role, and grouping policy. |
| interface | Interface `name` and `assigned_object_id` on IPAddress | Requires an existing or creatable interface and an explicit Interface Type. |
| MAC | Interface `mac_address` shortcut / primary MAC | Cannot attach a MAC directly to an IP without an interface. |
| management IP | Separate IPAddress or custom field | Requires a policy for whether it is a second IP record and which interface owns it. |

### Sync Architecture Recommendation

1. Add a NetBox target configuration and a dry-run diff screen. Keep URL and token in memory only; never store the token in `localStorage`.
2. Read prerequisites and lookup maps first: sites, prefixes, VLANs, devices, interfaces, and existing IP addresses. Match by IDs where available, and by normalized names only with an explicit collision warning.
3. Validate the complete plan locally, then send same-resource batches: prefixes first, then devices/interfaces if enabled, then IP addresses. Separate creates from PATCH updates because bulk PATCH requires numeric `id` per item.
4. Persist only remote IDs/URLs and a source key, not credentials. Use a custom field such as `ipviewer_source_key` where the NetBox administrator permits it; retain a user-visible preview before every write.
5. Do not implement cross-resource delete or overwrite by default. NetBox batches are atomic per resource request, not across the whole multi-resource sync; show partial-progress and retry information.

### Direct Browser Boundary

- NetBox must allow the app's actual origin in `CORS_ORIGIN_WHITELIST`; enabling `CORS_ORIGIN_ALLOW_ALL` is not an acceptable production shortcut.
- The page CSP now permits `connect-src` HTTP(S), but the page should still be served from an HTTP origin because a `file://` page has an opaque/browser-dependent origin and will usually fail NetBox CORS checks. A local bridge or same-origin reverse proxy is safer than exposing a write token to a file page.
- NetBox v4.7 supports `background=true` for large bulk list writes, but it defers validation and requires a worker; the client must poll the returned job and report final success, not treat HTTP 202 as completion.

### Scope Boundary

- IPv6 remains excluded because IPViewer currently models IPv4 only.
- Excel import/export is unrelated to NetBox synchronization; the sync should consume the normalized in-memory records after CSV/JSON/XLSX import.
- The implementation now covers Prefix + IPAddress and the optional Device/Interface/MAC scope with in-memory credentials, remote diff preview, non-destructive bulk create/update, explicit conflict handling, and persisted remote IDs. DCIM creation is opt-in; the default policy only associates existing objects.
- DCIM writes are dependency-aware: create Device first, inject its returned ID into Interface creation, inject Interface IDs into IPAddress assignment, and set `primary_ip4` only after the IP response returns. Existing foreign IP assignments and MAC collisions are reported and left unchanged.
- The completed third-stage client reads VLAN/VRF/Tenant/Tag catalogs, maps Prefix metadata and custom fields, supports explicit local-device-type to Device Type mappings, fingerprints persisted links by normalized NetBox base URL, chunks writes at 100 objects/about 3.5 MB, retries transient failures, and exposes object-level retry/export reports without credentials.

### First-Stage Regression

- Browser selftest: `38 / 38` passed in Edge.
- Cross-origin mock NetBox: remote reads, Prefix PATCH, IPAddress POST/PATCH, authentication header, remote-ID persistence, and token non-persistence all passed.
- Responsive dialog check: desktop `720px` modal; 390px viewport `358px` modal with no body or dialog-body horizontal overflow.

### Second-Stage Regression

- Browser selftest: `42 / 42` passed in Chromium/Edge-compatible runtime.
- Cross-origin mock NetBox: DCIM catalog reads, Device POST, Interface POST with returned Device ID, IPAddress POST with returned Interface IDs, Device primary IPv4 PATCH, remote-link persistence, and token non-persistence all passed.
- Responsive DCIM preview: 390px viewport kept the `358px` dialog and page/body widths at `390px`; long preview content remained internally scrollable without horizontal page overflow.

### Third-Stage Regression (2026-09-09)

- Browser selftest: `47 / 47` synchronous assertions plus the asynchronous zip assertion passed in Edge.
- Mock NetBox bulk regression: 205 IP objects were submitted as `100 / 100 / 5`, Prefix VLAN metadata resolved to the remote VLAN ID, 206 objects completed with zero failures, target fingerprints were persisted, and the test Token was absent from local data.
- Mock transient-failure regression: an IP batch returning HTTP 503 was retried automatically, recorded at object level, then all failed objects succeeded through the result-page retry action.
- Worker validation: `npm run typecheck` passed with Wrangler `4.129.1`.
- Responsive configuration/result surfaces: desktop and 390px measurements remained within the viewport with internal table scrolling for long content.

### Huawei Excel Regression (2026-09-11)

- Browser selftest: `67 / 67` (was 47) including the asynchronous zip assertion; new coverage for mask math, profile detection, template reproduction, and Huawei row/export shaping.
- `tools/cdp-test.js` — 34/34 against the real workbook: Mini-XLSX read of the shared-string sheet, profile detection, wizard auto-mapping, full import (12 rows → 11 unique IPs across 6 derived subnets), template-driven Huawei export, and an export→re-import round trip.
- `tools/ui-test.js` — 15/15 DOM assertions: the wizard mask target is populated, the panel mask field renders and round-trips through save, invalid masks warn without blocking, and the export menu exposes both Huawei options.
- `tools/verify_export.py` — openpyxl confirms the exported file is `A1:F13` with matching column widths, an `A1:F1` auto-filter, intact Chinese text, an all-empty 子网 column, no redundant `状态: 已分配`, and restored VRRP rows.
- Zero `Runtime.exceptionThrown` events across the runs.

### Bugs Found And Fixed During Excel Work

- `IO.Xlsx.write` was called with a bare rows array while it reads `sheet.rows`, so every export wrote an empty sheet; also masked by `sheetXml` throwing inside the loop. Both fixed.
- Import overwrote a same-IP sibling's merged note because the merge wrote into `exist.note` before `Object.assign` applied the row's own empty note; the note is now carried on the incoming record.
- `Panel.save` toggled the soft-warning classes and then called `Panel.render()`, which cleared them; validation state is now re-applied after render (this also fixed the pre-existing 管理IP/MAC soft warnings).
- `Wizard.autoMap` let the generic `名称` rule capture `接口名称`, leaving iface unmapped.
- Mask inheritance was originally single-pass and keyed only by device name. A row without a mask can precede the sibling row that carries it (true in the reference file only by luck), and one device can legitimately hold several masks (`/24` and `/30` here), so this could silently place a host in the wrong subnet. Import now pre-scans the sheet to build device+interface and device-level mask maps, prefers an exact device+interface match, uses the device-level fallback only when that device has exactly one distinct mask, and otherwise reports `badMask` instead of guessing.

### Excel Edge Cases Verified

- `tools/edge-test.js` — 17/17: reordered rows (no-mask row before its sibling's mask row) resolve via the pre-scan; a device with multiple masks and an unknown interface is reported rather than guessed; non-contiguous and missing masks land in the `badMask` report; `/31`, `/32` and dotted-decimal masks derive correctly; re-importing the same sheet is idempotent; an empty 子网 column still works; a same-address row for the same device is not treated as a multi-device merge.
- Template round-trip: importing a deliberately shuffled header order (`掩码/接口IP/子网/备注/接口名称/设备名称`) and exporting reproduces that exact order with every field in the right column; fields lacking a template column spill into 备注 rather than being dropped.

### 子网 Column And Export Format

- The 子网 column is a human-maintained site label the tool cannot derive. It is deliberately **left empty on export** rather than echo-ing the auto-created subnet name, so a human owns that column.
- Import stores a template (`ipviewer.template.v1`: headers + mapping + source sheet) at `Wizard.run`, covering both the preset and manual mapping paths. Export reads it to reproduce the imported header order.
- `assigned` is the implicit default; writing `状态: 已分配` into 备注 was redundant and is now suppressed. This was caught by inspecting the openpyxl dump after the template change, not by an assertion.
- The Huawei export gained an indirection (`IO.huaweiView()` / `IO.huaweiTemplateRow`) so the fixed 6-column shape and the template-driven shape share one row builder and one note-summarising rule.
