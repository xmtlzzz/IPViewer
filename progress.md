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
