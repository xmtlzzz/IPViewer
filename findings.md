# Findings

- The app is a single `index.html` with inline CSS and JavaScript; `README.md` and `todo.md` are the only other project files.
- `FIELDS` currently contains `name`, `mgmtIp`, `iface`, `mac`, `purpose`, `deviceType`, and `note`; there is no standalone hostname field.
- `IMPORT_TARGETS`, table headers, export rows, panel HTML, and panel collection/rendering all need coordinated hostname changes.
- `Wizard.renderKeywordEditor` exists only in the import mapping step. `Data.loadKeywords`/`saveKeywords` already provide the persistence layer.
- `IO.hasDecompress` detects `DecompressionStream`, but the import button always advertises/selects `.xlsx,.csv`; missing support currently fails only after an xlsx is selected.
- `todo.md` marks already-completed P10 work as unchecked with explanatory text and has stale storage wording in the known-limit table; those entries should be synchronized.

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
- The first implementation now covers the recommended Prefix + IPAddress scope with in-memory credentials, remote diff preview, non-destructive bulk create/update, explicit conflict handling, and persisted remote IDs. Device/Interface/MAC synchronization remains outside this phase.

### First-Stage Regression

- Browser selftest: `35 / 35` passed in Edge.
- Cross-origin mock NetBox: remote reads, Prefix PATCH, IPAddress POST/PATCH, authentication header, remote-ID persistence, and token non-persistence all passed.
- Responsive dialog check: desktop `720px` modal; 390px viewport `358px` modal with no body or dialog-body horizontal overflow.
