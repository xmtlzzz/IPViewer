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
