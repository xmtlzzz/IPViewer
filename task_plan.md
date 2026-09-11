# IPViewer remaining TODO implementation

## Goal

Implement every remaining TODO item that is not Excel-specific or IPv6, while preserving the existing single-file offline architecture.

## Phases

- [complete] Inspect current data model, UI, import/export paths, and self-tests
- [complete] Add hostname field, persistence, panel editing, import/export mapping, and rendering support
- [complete] Add a global status-keyword rules editor outside the import wizard
- [complete] Add clear legacy-browser CSV/JSON fallback UI for missing DecompressionStream
- [complete] Synchronize TODO/README documentation and add focused regression tests
- [complete] Run selftest and static/runtime checks; review diff for scope
- [complete] Add NetBox metadata mappings, target isolation, chunked writes, retries, and failure report export

## Scope decisions

- Keep real Excel validation, Excel date-column support, and SheetJS fallback in the TODO list.
- Keep IPv6 explicitly deferred.
- Implement the standalone hostname field because it is not inherently Excel-specific and the current model only conflates it with device name.
- Keep the existing offline, dependency-free, single-HTML architecture.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `IO.Xlsx.write` call passed a bare rows array | 1 | Function reads `sh.rows`; switched call sites to `[{name, rows, widths}]` |
| Huawei profile regex missed `接口IP` | 1 | Real header is uppercase; profile regexes forced case-insensitive |
| `名称` rule captured `接口名称` | 1 | Reordered `autoMap` so `接口/端口` is tested before `名称` |
| Merged same-IP note lost on import | 1 | Merge wrote `exist.note` before `Object.assign` overwrote it; carry the note on `rec` |
| Soft-warning flags cleared after save | 1 | `Panel.render()` reset the classes; re-apply validation after render |

## Excel Parsing & Huawei Format (2026-09-11)

- [complete] Analyze the real uploaded workbook and capture authoritative cell values with openpyxl
- [complete] Add a `mask` field plus prefix/mask conversion helpers in the Calc layer
- [complete] Add preset table-profile detection and fix auto-map keyword precedence
- [complete] Derive subnets from 接口IP + 掩码, inherit missing masks, merge same-IP multi-device rows
- [complete] Add Huawei-format export (6 columns, widths, auto-filter) alongside the existing 12-column export
- [complete] Surface 掩码 in the IP detail panel with soft validation
- [complete] Build reusable `tools/` browser + openpyxl verification and run it against the real file
- [complete] Synchronize README / todo / findings / progress documentation

## Excel Scope Decisions

- The default 12-column export is preserved; the Huawei 6-column format is an additional menu option.
- `掩码` is stored on the record and used for subnet derivation; it is not merged into the subnet model.
- Same-address multi-device rows are represented losslessly (merged in the grid, split again on Huawei export).
- Date-column support remains deferred; the reference workbook has no date column.
- The single-file, dependency-free architecture is unchanged (`tools/` scripts are development-only and never loaded by `index.html`).

## Directory Grouping (2026-09-11)

- [complete] Add first-class `groups[]` entity with schema v2 migration and dangling-reference cleanup
- [complete] Add group CRUD + subnet assignment actions to the Store layer with persistence
- [complete] Render a collapsible grouped sidebar with per-group counts and an 未分组 section
- [complete] Add group create/edit/delete dialogs and a directory selector in the subnet dialog
- [complete] Auto-create and assign directories from the imported 子网 column, protecting manual overrides
- [complete] Backfill the directory name into the 子网 export column and add a 目录 column to the default export
- [complete] Extend selftest, integration, UI (incl. 390px), and edge-case suites; update docs

## Grouping Scope Decisions

- A directory is an entity (id/name/note), not a text label on the subnet, so it can be renamed, sorted, and exist while empty — and it maps onto the NetBox Site concept later.
- Deleting a directory never deletes subnets; they return to 未分组.
- Import assigns by group name but never overrides a subnet that already has a group.
- Collapse state is persisted per directory; groups default to expanded.

## UI Polish Pass (2026-09-08)

- [complete] Audit all visible surfaces and expanded UI states with Edge screenshots
- [complete] Consolidate shared control, surface, dialog, menu, and feedback styles
- [complete] Improve wizard/rules editor spacing and responsive behavior
- [complete] Re-run desktop/mobile screenshots and regression checks

## UI Polish Scope

- Kept dynamic inline styles only for data-driven color/width indicators and non-visible utility/test elements.
- Added semantic classes for dialogs, import reports, subnet controls, rules actions, and export menus.
- Preserved the existing offline single-file architecture, theme colors, and business behavior.

## NetBox Integration Audit (2026-09-08)

- [complete] Verify current NetBox REST API, authentication, and bulk write semantics
- [complete] Map IPViewer fields and workflows to NetBox IPAM/DCIM resources
- [complete] Assess browser/CORS/token/security constraints of direct sync
- [complete] Produce an implementation recommendation and integration boundary

## NetBox Decision

- Recommended first implementation: a previewable IPAM sync for Prefix + IPAddress, with no destructive deletes.
- Keep Device/Interface/MAC synchronization behind explicit target configuration and lookup/create policies.
- Prefer a local bridge or same-origin deployment for write operations; do not persist a write-capable token in localStorage.

## NetBox 第一阶段实现 (2026-09-08)

- [complete] Add in-memory NetBox URL/token configuration and connection test
- [complete] Build Prefix + IPAddress dry-run diff from local records and remote state
- [complete] Add non-destructive bulk create/update with explicit confirmation
- [complete] Add conflict/free mappings, unsupported-field warnings, remote ID links, and failure report
- [complete] Run browser/API simulation regression, update docs, and commit

## NetBox 第二阶段实现 (2026-09-09)

- [complete] Add optional DCIM scope and in-memory Site/Device Type/Device Role configuration
- [complete] Match or create Devices and Interfaces, including normalized MAC synchronization
- [complete] Link IPAddress objects to Interfaces and optionally set Device primary IPv4
- [complete] Enforce Prefix → Device → Interface → IPAddress → primary IPv4 dependency order
- [complete] Preserve separate IP, Device, Interface, and management-IP remote links without destructive rebinding
- [complete] Add DCIM preview tables, warnings, dependency failures, and mobile layout coverage
- [complete] Run 42 browser selftests, 390px/desktop UI checks, and cross-origin mock NetBox write regression

## NetBox 第三阶段实现（2026-09-09）

- [complete] Read VLAN/VRF/Tenant/Tags catalogs and map optional Prefix metadata plus Custom Fields
- [complete] Add explicit local device-type to remote Device Type mappings
- [complete] Isolate persisted remote links by normalized NetBox target URL
- [complete] Chunk bulk writes, retry transient errors, and preserve dependency order
- [complete] Add object-level failure details, retry action, and JSON/CSV export without Token
- [complete] Run 47 browser selftests, desktop/390px checks, Mock NetBox bulk/retry regression, and Worker typecheck
