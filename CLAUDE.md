# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs both server + client, kills ports first)
npm run dev

# Run individually
npm run dev:server   # Express on :3001
npm run dev:client   # Vite on :5173

# Kill dev servers
npm run stop

# Build
cd client && npm run build
cd server && npm run build

# Lint (client only)
cd client && npm run lint

# Encrypt a credential for .env storage
cd server && npx tsx src/encrypt-value.ts <KEY> <VALUE>
```

There are no automated tests in this project.

## Architecture

This is a monorepo with two packages: `client/` (React SPA) and `server/` (Express API). The server proxies all Splunk REST API calls so the browser never touches Splunk directly.

**Request flow:**
```
Browser → Vite proxy (/api/*) → Express :3001 → Splunk REST API (:8089)
```

### Server

- **`server/src/config.ts`** — Loads `.env` from the repo root. On startup, if any env var is prefixed with `enc:`, it prompts for a master key and decrypts in memory (never stored). Config is mutable at runtime via `updateSplunkConfig()` (called from the Settings page).
- **`server/src/services/splunkService.ts`** — All Splunk REST calls go through here. Uses `undici` with TLS verification disabled (self-signed certs). Supports Bearer token or Basic auth; token takes precedence if set.
- **Routes:**
  - `POST /api/search` — synchronous: creates job, polls until done, returns results
  - `POST /api/search/async` — returns SID immediately for long-running jobs
  - `GET /api/search/:sid/status|results|log|dispatch|dispatch-tar` — job introspection
  - `GET /api/config`, `PUT /api/config`, `POST /api/config/test` — runtime config management
  - `POST /api/proxy` — generic pass-through to any Splunk REST endpoint
  - `POST /api/saved-search/update` — update saved search properties

### Client

- **`client/src/services/api.ts`** — Single `api` object wrapping all backend calls. Always hits `/api/*` (proxied by Vite in dev). All requests disable browser caching via headers.
- **`client/src/hooks/useSplunkSearch.ts`** — Primary data-fetching hook. Accepts an SPL string and options; automatically uses `GlobalTimeContext` for time range unless overridden. Supports optional `refreshInterval` (seconds).
- **`client/src/hooks/useGlobalTime.ts`** — React context for the global time picker. The context is provided in `App.tsx` and consumed by `useSplunkSearch` and the TopBar component. Time values are Splunk relative-time strings (`-1h`, `now`, etc.).
- **`client/src/hooks/useCustomPanels.ts`** — Manages the Dashboard page's drag-and-drop panel state (persisted to localStorage).
- **Pages** in `client/src/pages/` map 1:1 to sidebar nav items. Most pages run one or more `useSplunkSearch` calls with hardcoded SPL queries for that page's purpose (slow searches, skipped searches, SHC status, etc.).
- **Panels** in `client/src/components/panels/` are visualization wrappers around Tremor charts. They accept raw `SplunkResult[]` data and render it.

### Adding a new page

1. Create `client/src/pages/MyPage.tsx` — call `useSplunkSearch(spl)` for data
2. Add a route in `client/src/main.tsx`
3. Add a nav entry in `client/src/config/navigation.ts`

### Data fetching rules

**All Splunk API calls must live inside the page component that needs them — never in `App.tsx`, layout components, or any parent that is mounted for the lifetime of the app.**

React Router mounts and unmounts page components as the user navigates. A `useEffect` or `useSplunkSearch` call inside a page component therefore only fires when the user is on that page. If a search is hoisted to a parent, it fires on every page load regardless of which route is active and can't be cancelled when the user navigates away.

- Put `useSplunkSearch` / `api.search` / `api.proxy` calls directly in the page-level component (or in hooks called from it).
- Never put Splunk calls in `App.tsx`, `TopBar`, sidebar, or any wrapper that renders across all routes.
- For data that two sibling pages genuinely need to share, prefer re-fetching on each page over a shared parent fetch.

### Adding a new backend route

Add to an existing router in `server/src/routes/` or create a new one and register it in `server/src/index.ts` under `/api`.

## Btool panels

When asked to display btool output for a `<file>` and `<stanza>`, build a self-contained panel component using this established pattern (see `ReplicationSettingsPanel` in `client/src/pages/KnowledgeBundlePage.tsx`).

### SPL

```
| btool <confname> list <stanza> splunk_server=local
```

Example: `| btool distsearch list replicationSettings splunk_server=local`

### Result count

Always use `count=0` when fetching results — this tells the Splunk API to return all rows with no cap. The default is 1000, which silently truncates btool output for large stanzas or deep merge chains. `count=0` is already set in `server/src/services/splunkService.ts` (`executeSearch` → `getJobResults(sid, 0)`). Do not revert this to a fixed number.

### `_raw` format and parsing

Admin's Little Helper returns btool output in `_raw`. Each logical line is:

```
/opt/splunk/etc/apps/myapp/local/file.conf    [stanzaName]
/opt/splunk/etc/system/default/file.conf      key = value
```

**Critical**: `_raw` per Splunk result row contains ALL lines for that stanza concatenated — there may be no newline characters (the HTML table collapses them visually). Parse with `splitRaw()`:

1. **Try `\n` splitting first** — split `_raw` on `\r?\n`, filter lines matching `/^\S+\.conf\s/`. If you get more than one line this way, parse each as `path + 2+spaces + content`. No ambiguity with path-valued attributes.
2. **Detect the Splunk base path** from the first absolute path found (e.g. `/opt/splunk`, `/home/splunk`) — use `rawStr.match(/^(\/[^/]+\/[^/]+)\//)`.
3. **Concatenated fallback** — use regex `(\S+\.conf)\s{2,}(.*?)(?=<escapedBase>\/|$)` with `gs` flags. Anchoring on the detected base path prevents false splits inside S3 URLs (`path = s3://bucket/prefix/`) or other path-valued attributes.

Track `currentStanza` sequentially across lines so sub-stanzas like `[replicationSettings:refineConf]` are automatically excluded when you only want `[replicationSettings]`.

### Display

- **Card header**: two lines — (1) label + key value (`Replication Policy: rfs`), (2) the btool SPL command in `text-[10px] font-mono text-blue-400/60` directly below the title. Always show the command in the header so engineers know exactly what ran.
- **Body**: full-width, two-column monospace layout — left column is the file path (fixed width, `shrink-0`), right column is `attribute = value` or `[stanza]`. Use `whitespace-nowrap` on each row and `overflow-x-auto` on the container.
- **Stanza name row** (`[stanzaName]`): render in `text-emerald-400/80` to distinguish it from attribute rows.
- **Card border**: use `border-emerald-500/20` (thin green piping) to visually identify btool panels.
- **Stanza header rows** (`[stanzaName]`) appear in the results and are rendered inline with their source file path.
- **Expand/collapse**: show the first 25 rows (`PREVIEW_ROWS = 25`) per stanza group; add a "Show N more / Collapse" toggle.
- **SPL reference**: show the raw SPL string at the bottom of the card in a monospace dimmed style.
- **Show raw toggle**: optional debug table showing all fields including `_raw` — useful when diagnosing parse issues.

### Key attributes to highlight

For any new btool panel, identify the single most important attribute and show it in the card header. For example:
- `distsearch list replicationSettings` → header key: `replicationPolicy`
- Add a `DESCRIPTIONS` map for known values (e.g. `rfs: "Remote file system — S3-based"`)

## Environment Variables

The `.env` file lives at the repo root and is loaded by the server.

| Variable | Purpose |
|---|---|
| `SPLUNK_BASE_URL` | Splunk management port URL (default: `https://127.0.0.1:8089`) |
| `SPLUNK_WEB_URL` | Optional Splunk web UI URL (used for deep links) |
| `SPLUNK_USERNAME` | Basic auth username |
| `SPLUNK_PASSWORD` | Basic auth password (can be `enc:...` encrypted) |
| `SPLUNK_TOKEN` | Bearer token — takes precedence over basic auth (can be `enc:...`) |
| `PORT` | Server port (default: `3001`) |
