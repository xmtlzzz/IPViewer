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

## Scope decisions

- Keep real Excel validation, Excel date-column support, and SheetJS fallback in the TODO list.
- Keep IPv6 explicitly deferred.
- Implement the standalone hostname field because it is not inherently Excel-specific and the current model only conflates it with device name.
- Keep the existing offline, dependency-free, single-HTML architecture.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| None | 0 | — |

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
