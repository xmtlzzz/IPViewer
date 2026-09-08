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
