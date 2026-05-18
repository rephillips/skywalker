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
2. Add a route in `client/src/App.tsx`
3. Add a nav entry in `client/src/config/navigation.ts`

### Adding a new backend route

Add to an existing router in `server/src/routes/` or create a new one and register it in `server/src/index.ts` under `/api`.

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
