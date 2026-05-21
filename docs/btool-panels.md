# Btool Panel Spec

Read this file in full before building or modifying any btool panel.

---

## SPL query

```
| btool <confname> list <stanza> splunk_server=local
```

Example: `| btool distsearch list replicationSettings splunk_server=local`

`count=0` is already applied globally in `server/src/services/splunkService.ts` — never override it. Without it, large stanzas or deep merge chains are silently truncated at 1000 rows.

---

## Parser — always use the shared utility

**Do not write inline parsing logic.** The parser lives in `client/src/utils/btool.ts`:

```ts
import { parseBtoolRows, type BtoolRow } from "../utils/btool";

const rows = parseBtoolRows(rawRows, "replicationBlacklist");
```

`parseBtoolRows(results, targetStanza)` returns `BtoolRow[]`:
```ts
interface BtoolRow {
  file: string;      // source conf file path
  content: string;   // "[stanza]" or "key = value"
  isStanza: boolean;
  stanza: string;
  rawObj: any;
}
```

If you need to add or fix parsing logic, edit `btool.ts` — do not duplicate it per-panel.

---

## Result formats (for understanding btool.ts only)

Admin's Little Helper returns one of two formats. The parser handles both — you do not need to detect them in the component.

### Format A — BTOOL.\* named fields (newer ALH)

Detected by: any field matching `/^btool\./i`.

- `_raw` = just the source file path (not a full btool line)
- `BTOOL.STANZA` = stanza name for this row — **use this for filtering, not `BTOOL.CMD.PREFIX`**
- `BTOOL.KEYS` = comma-separated attribute names in this row
- Each key in `BTOOL.KEYS` has a matching column; match via `key.toUpperCase().replace(/[._]/g, "")` normalisation

### Format B — `_raw` full btool lines (older ALH / standard)

Detected by: `_raw` starts with a path and matches `/^\S+\.conf\s{2,}/`.

Each logical line: `/path/to/file.conf    key = value` (2+ spaces as separator).

`_raw` may concatenate multiple lines with no newlines — `splitRaw()` in btool.ts handles this by:
1. Trying `\n` splitting first (if >1 line found, use them)
2. Falling back to a regex anchored on the detected Splunk base path to avoid false splits on path-valued attributes

### Detection order

Check Format A (BTOOL.\* fields) first, then Format B (`_raw` lines). This is the order in `btool.ts` — do not change it.

---

## Component structure

Model every btool panel on `ReplicationSettingsPanel` in `client/src/pages/KnowledgeBundlePage.tsx`. Key points:

### State
```ts
const [rawRows, setRawRows] = useState<any[]>([]);
const [showRaw, setShowRaw] = useState(false);
const [expanded, setExpanded] = useState<Set<string>>(new Set());
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Data fetch
```ts
const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await api.search(SPL);
    setRawRows(res.results ?? []);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setLoading(false);
  }
}, []);
useEffect(() => { load(); }, [load]);
```

### Card border
Always use `border-emerald-500/20` — thin green piping identifies btool panels:
```tsx
<div className="rounded-xl border border-emerald-500/20 bg-surface-raised mb-6 overflow-hidden">
```

### Card header
Two lines: title (with key highlight if applicable) + SPL command.
```tsx
<div className="flex flex-col gap-0.5">
  <div className="flex items-center gap-2">
    <Icon size={14} className="text-brand-400" />
    <h3 className="text-xs font-semibold text-white">Panel Title</h3>
  </div>
  <code className="text-[10px] font-mono text-emerald-400/60 pl-5">{SPL}</code>
</div>
```
Do **not** repeat the SPL command at the bottom of the card.

### Row rendering — CRITICAL layout rules

```tsx
<div className="px-6 pt-4 pb-3 overflow-x-auto">
  <div className="font-mono text-xs leading-5">
    {visible.map((row, i) => (
      <div key={i} className="flex whitespace-nowrap">
        <span
          className="text-gray-400 shrink-0 w-[520px] pr-8 overflow-hidden"
          title={row.file}
        >
          {row.file}
        </span>
        <span className={row.isStanza ? "text-emerald-400/80" : "text-gray-100"}>
          {row.content}
        </span>
      </div>
    ))}
  </div>
</div>
```

**`overflow-hidden` on the left column is mandatory.** Without it, long app paths (e.g. `python_upgrade_readiness_app`) overflow the 520px box and visually bleed into the content column. Always pair it with `title={row.file}` so the full path is accessible on hover.

### Stanza groups + expand/collapse

Group rows by stanza header, show first `PREVIEW_ROWS = 25`, add "Show N more / Collapse" toggle:

```tsx
const groups: { stanza: string; rows: BtoolRow[] }[] = [];
let current: { stanza: string; rows: BtoolRow[] } | null = null;
for (const row of rows) {
  if (row.isStanza) {
    current = { stanza: row.stanza, rows: [row] };
    groups.push(current);
  } else if (current) {
    current.rows.push(row);
  }
}
```

Use a `Set<string>` keyed by stanza name for expand state (not a boolean) so multiple stanza groups work independently.

### Empty / error states

```tsx
{/* No results from Splunk at all */}
{!loading && !error && rawRows.length === 0 && (
  <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
    <AlertTriangle size={13} />
    No results — Admin's Little Helper app may not be installed on this SH.
  </div>
)}

{/* Results came back but stanza was not found */}
{!loading && !error && rawRows.length > 0 && rows.length === 0 && (
  <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
    <AlertTriangle size={13} />
    Stanza <code className="font-mono mx-1">[targetStanza]</code> not found — it may not be configured on this SH.
  </div>
)}
```

### Show raw toggle

Always include a "Show raw" debug table so engineers can diagnose parse issues without touching code. Only show the button when `rawRows.length > 0`. The table should show all fields including `_raw`, filtering out fields starting with `_` except `_raw` itself.

---

## Key attribute in header

For any new btool panel, identify the single most important attribute and show it inline in the card title:

```tsx
<h3 className="text-xs font-semibold text-white">
  Panel Title{keyValue ? <span className="text-brand-300 font-mono">: {keyValue}</span> : null}
</h3>
```

Examples:
- `distsearch list replicationSettings` → highlight `replicationPolicy`
- Add a `DESCRIPTIONS` map for known values where helpful
