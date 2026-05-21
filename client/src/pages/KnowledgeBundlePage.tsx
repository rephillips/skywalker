import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Package, Crown, Server, AlertTriangle, Archive, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import { parseBtoolRows, type BtoolRow } from "../utils/btool";

interface BundleInfo {
  [key: string]: any;
}

const BTOOL_SPL = `| btool distsearch list replicationSettings splunk_server=local`;

const POLICY_DESCRIPTIONS: Record<string, string> = {
  replication:    "Full replication — entire bundle pushed to all SHC members",
  "light-weight": "Light-weight — only changed objects replicated",
  rfs:            "Remote file system — bundle stored on S3/remote, not replicated between SHs",
  none:           "No replication — each SH uses its own local bundle",
};


const PREVIEW_ROWS = 25;

function ReplicationSettingsPanel() {
  const [rawRows, setRawRows]         = useState<any[]>([]);
  const [showRaw, setShowRaw]         = useState(false);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [captain, setCaptain]         = useState<string | null>(null);
  const [currentSh, setCurrentSh]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [btoolRes, shcRes, infoRes] = await Promise.all([
        api.search(BTOOL_SPL),
        api.proxy("shcluster/member/members"),
        api.proxy("server/info"),
      ]);

      setRawRows(btoolRes.results ?? []);

      const entries: any[] = shcRes.data?.entry ?? [];
      const captainEntry = entries.find((e: any) => {
        const v = e.content?.is_captain;
        return v === "1" || v === true || v === 1;
      });
      if (captainEntry) {
        const label: string = captainEntry.content?.label || captainEntry.name || "";
        setCaptain(label.split(".")[0]);
      }

      const serverName = infoRes.data?.entry?.[0]?.content?.serverName;
      if (serverName) setCurrentSh((serverName as string).split(".")[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = parseBtoolRows(rawRows, "replicationSettings");
  const policy = rows.find(r => r.content.startsWith("replicationPolicy ="))
    ?.content.replace("replicationPolicy =", "").trim() ?? null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-brand-400" />
            <h3 className="text-xs font-semibold text-white">
              Replication Policy{policy ? <span className="text-brand-300 font-mono">: {policy}</span> : null}
            </h3>
          </div>
          <code className="text-[10px] font-mono text-emerald-400/60 pl-5">{BTOOL_SPL}</code>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            {currentSh && (
              <span className="flex items-center gap-1">
                <Server size={10} />
                {currentSh}
              </span>
            )}
            {captain && (
              <span className="flex items-center gap-1">
                <Crown size={10} className="text-amber-400" />
                <span className="text-amber-300">{captain}</span>
              </span>
            )}
          </div>
          {rawRows.length > 0 && (
            <button onClick={() => setShowRaw(s => !s)} className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
              {showRaw ? "Hide raw" : "Show raw"}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {loading && !rawRows.length && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Running btool...</p>
        </div>
      )}

      {!loading && !error && rawRows.length === 0 && (
        <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
          <AlertTriangle size={13} />
          No results — Admin&apos;s Little Helper app may not be installed on this SH.
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Stanza groups */}
          {(() => {
            // Split rows into stanza groups
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

            return groups.map(group => {
              const isExpanded = expanded.has(group.stanza);
              const visible = isExpanded ? group.rows : group.rows.slice(0, PREVIEW_ROWS);
              const hidden = group.rows.length - PREVIEW_ROWS;

              return (
                <div key={group.stanza} className="px-6 pt-4 pb-3 overflow-x-auto">
                  <div className="font-mono text-xs leading-5">
                    {visible.map((row, i) => (
                      <div key={i} className="flex whitespace-nowrap">
                        <span className="text-gray-400 shrink-0 w-[520px] pr-8 overflow-hidden" title={row.file}>{row.file}</span>
                        <span className={row.isStanza ? "text-emerald-400/80" : "text-gray-100"}>{row.content}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1">
                    {!isExpanded && hidden > 0 && (
                      <button
                        onClick={() => setExpanded(s => new Set([...s, group.stanza]))}
                        className="text-xs text-brand-400 hover:text-brand-200 transition-colors"
                      >
                        Show {hidden} more
                      </button>
                    )}
                    {isExpanded && (
                      <button
                        onClick={() => setExpanded(s => { const n = new Set(s); n.delete(group.stanza); return n; })}
                        className="text-xs text-brand-400 hover:text-brand-200 transition-colors"
                      >
                        Collapse
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {/* Raw debug table — all fields to help identify path column */}
          {showRaw && (
            <div className="border-t border-surface-border p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">Raw rows — all fields</div>
              <div className="overflow-x-auto rounded border border-surface-border">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface">
                      {rawRows[0] && Object.keys(rawRows[0])
                        .filter(k => !k.startsWith("_") || k === "_raw")
                        .map(col => (
                          <th key={col} className="text-left px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 border-b border-surface-border whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.map((r, i) => (
                      <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20">
                        {Object.keys(rawRows[0])
                          .filter(k => !k.startsWith("_") || k === "_raw")
                          .map(col => (
                          <td key={col} className="px-4 py-1.5 font-mono text-gray-300 align-top whitespace-nowrap">
                            {String(r[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BLACKLIST_SPL = `| btool distsearch list replicationBlacklist splunk_server=local`;

function ReplicationBlacklistPanel() {
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(BLACKLIST_SPL);
      setRawRows(res.results ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = parseBtoolRows(rawRows, "replicationBlacklist");

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-brand-400" />
            <h3 className="text-xs font-semibold text-white">Replication Blacklist</h3>
          </div>
          <code className="text-[10px] font-mono text-emerald-400/60 pl-5">{BLACKLIST_SPL}</code>
        </div>
        <div className="flex items-center gap-3">
          {rawRows.length > 0 && (
            <button onClick={() => setShowRaw(s => !s)} className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
              {showRaw ? "Hide raw" : "Show raw"}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {loading && !rawRows.length && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Running btool...</p>
        </div>
      )}

      {!loading && !error && rawRows.length === 0 && (
        <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
          <AlertTriangle size={13} />
          No results — Admin&apos;s Little Helper app may not be installed on this SH.
        </div>
      )}

      {rows.length > 0 && (
        <>
          {(() => {
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

            return groups.map(group => {
              const isExpanded = expanded.has(group.stanza);
              const visible = isExpanded ? group.rows : group.rows.slice(0, PREVIEW_ROWS);
              const hidden = group.rows.length - PREVIEW_ROWS;

              return (
                <div key={group.stanza} className="px-6 pt-4 pb-3 overflow-x-auto">
                  <div className="font-mono text-xs leading-5">
                    {visible.map((row, i) => (
                      <div key={i} className="flex whitespace-nowrap">
                        <span className="text-gray-400 shrink-0 w-[520px] pr-8 overflow-hidden" title={row.file}>{row.file}</span>
                        <span className={row.isStanza ? "text-emerald-400/80" : "text-gray-100"}>{row.content}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1">
                    {!isExpanded && hidden > 0 && (
                      <button
                        onClick={() => setExpanded(s => new Set([...s, group.stanza]))}
                        className="text-xs text-brand-400 hover:text-brand-200 transition-colors"
                      >
                        Show {hidden} more
                      </button>
                    )}
                    {isExpanded && (
                      <button
                        onClick={() => setExpanded(s => { const n = new Set(s); n.delete(group.stanza); return n; })}
                        className="text-xs text-brand-400 hover:text-brand-200 transition-colors"
                      >
                        Collapse
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {showRaw && (
            <div className="border-t border-surface-border p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">Raw rows — all fields</div>
              <div className="overflow-x-auto rounded border border-surface-border">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface">
                      {rawRows[0] && Object.keys(rawRows[0])
                        .filter(k => !k.startsWith("_") || k === "_raw")
                        .map(col => (
                          <th key={col} className="text-left px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 border-b border-surface-border whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.map((r, i) => (
                      <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20">
                        {Object.keys(rawRows[0])
                          .filter(k => !k.startsWith("_") || k === "_raw")
                          .map(col => (
                            <td key={col} className="px-4 py-1.5 font-mono text-gray-300 align-top whitespace-nowrap">
                              {String(r[col] ?? "")}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BUNDLE_SPL = `| bundlefiles
| eval file=coalesce(kvstore_app . "." . kvstore_collection,path)
| stats max(_time) as _time max(bundle_epoch) as bundle_epoch count values(kvstore_collection) as kvstore sum(bytes) as bytes values(source) AS source by file host
| eval display=if(isnotnull(kvstore), "KV (KVstore collection): " . file . " (" . count . " .csv files)", file), size=tostring(round((bytes/1024/1024),2),"commas"), date_format="%Y-%m-%d %H:%M:%S %Z"
| appendpipe
    [ stats max(_time) as _time max(bundle_epoch) as bundle_epoch count sum(count) as total_count count(kvstore) as kvstore sum(bytes) as bytes values(date_format) as date_format values(source) AS source by host
    | appendcols
        [ btool distsearch list replicationSettings splunk_server=local
        | stats latest(maxBundleSize) AS maxBundleSize values(splunk_server) as splunk_server ]
    | eval timestamp = if(isnull(bundle_epoch), "N/A - Computed", strftime(bundle_epoch, date_format))
    | eval checked_at = strftime(now(), date_format)
    | eval maxBundleSize = tostring(maxBundleSize, "commas") . " MB"
    | eval size = tostring(floor(bytes / 1024 / 1024), "commas") . " MB"
    | eval total_count = tostring(total_count, "commas")
    | eval bundle_file = if(source == "HAL9000", "N/A - Computed", source)
    | eval is_summary="1" ]
| sort 0 - bytes
| eval last_mod=strftime(_time, date_format)
| table host display size bytes last_mod bundle_file timestamp checked_at total_count maxBundleSize is_summary`;

type SortKey = "display" | "bytes" | "last_mod";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <span className="text-gray-600 ml-1">↕</span>;
  return <span className="text-emerald-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function BundleFilesPanel() {
  const [rows, setRows]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState<SortKey>("bytes");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [collapsed, setCollapsed] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(false);

  const FILE_PREVIEW = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(BUNDLE_SPL);
      setRows(res.results ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = rows.find(r => r.is_summary === "1");
  const allFiles = rows.filter(r => r.is_summary !== "1");

  const statCells = summary ? [
    { label: "Host",           value: summary.host },
    { label: "Checked at",    value: summary.checked_at },
    { label: "Built",         value: summary.timestamp },
    { label: "Bundle file",   value: summary.bundle_file },
    { label: "File count",    value: summary.total_count },
    { label: "Total size",    value: summary.size },
    { label: "maxBundleSize", value: summary.maxBundleSize },
  ] : [];

  const toggleSort = (col: SortKey) => {
    if (sortKey === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir(col === "bytes" ? "desc" : "asc"); }
  };

  const handleSearch = (val: string) => { setSearch(val); setFilesExpanded(false); };

  const filtered = allFiles.filter(r =>
    !search || String(r.display ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let av: any = a[sortKey], bv: any = b[sortKey];
    if (sortKey === "bytes") { av = Number(av) || 0; bv = Number(bv) || 0; }
    else { av = String(av ?? ""); bv = String(bv ?? ""); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <button onClick={() => setCollapsed(c => !c)} className="flex flex-col gap-0.5 text-left hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-brand-400" />
            <h3 className="text-xs font-semibold text-white">Knowledge Bundle</h3>
            {collapsed ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronUp size={12} className="text-gray-500" />}
          </div>
          <code className="text-[10px] font-mono text-emerald-400/60 pl-5">| bundlefiles</code>
        </button>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          Refresh
        </button>
      </div>

      {!collapsed && (<>
      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {loading && !rows.length && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Running bundlefiles...</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
          <AlertTriangle size={13} />
          No bundle data returned.
        </div>
      )}

      {/* Summary — vertical label/value table */}
      {summary && (
        <div className="border-b border-surface-border px-4 py-3">
          <table className="text-xs border-collapse">
            <tbody>
              {statCells.map(({ label, value }) => (
                <tr key={label}>
                  <td className="py-0.5 pr-6 text-[10px] uppercase tracking-wide text-gray-500 whitespace-nowrap">{label}</td>
                  <td className="py-0.5 font-mono text-gray-200">{value || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* File list */}
      {allFiles.length > 0 && (
        <>
          {/* Search filter */}
          <div className="px-4 py-2 border-b border-surface-border">
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Filter files..."
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-border text-[9px] uppercase tracking-wide text-gray-500">
                  <th className="text-left px-4 py-2 font-medium cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort("display")}>
                    File / KV store collection <SortIcon col="display" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="text-right px-4 py-2 font-medium w-28 cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort("bytes")}>
                    Size (MB) <SortIcon col="bytes" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="text-right px-4 py-2 font-medium w-48 cursor-pointer hover:text-gray-300 select-none"
                    onClick={() => toggleSort("last_mod")}>
                    Last Modified <SortIcon col="last_mod" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(filesExpanded ? sorted : sorted.slice(0, FILE_PREVIEW)).map((r, i) => (
                  <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20">
                    <td className="px-4 py-1.5 font-mono text-gray-300">{r.display}</td>
                    <td className="px-4 py-1.5 font-mono text-gray-400 text-right">{r.size}</td>
                    <td className="px-4 py-1.5 font-mono text-gray-500 text-right">{r.last_mod}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-3 text-center text-[11px] text-gray-500">No files match filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 flex items-center justify-between text-[10px] text-gray-600">
            <span>{filesExpanded ? sorted.length : Math.min(FILE_PREVIEW, sorted.length)} of {sorted.length} files</span>
            {sorted.length > FILE_PREVIEW && (
              <button
                onClick={() => setFilesExpanded(e => !e)}
                className="text-brand-400 hover:text-brand-200 transition-colors"
              >
                {filesExpanded ? "Collapse" : `Show ${sorted.length - FILE_PREVIEW} more`}
              </button>
            )}
          </div>
        </>
      )}
      </>)}
    </div>
  );
}

export function KnowledgeBundlePage() {
  const [bundleStatus, setBundleStatus] = useState<BundleInfo | null>(null);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, searchesRes, eventTypesRes, lookupsRes] = await Promise.allSettled([
        api.proxy("cluster/manager/info"),
        api.proxy("saved/searches?count=0"),
        api.proxy("saved/eventtypes?count=0"),
        api.proxy("data/transforms/lookups?count=0"),
      ]);

      if (statusRes.status === "fulfilled" && statusRes.value.status === "ok") {
        setBundleStatus(statusRes.value.data?.entry?.[0]?.content || null);
      }
      if (searchesRes.status === "fulfilled" && searchesRes.value.status === "ok") {
        setSavedSearches(searchesRes.value.data?.entry || []);
      }
      if (eventTypesRes.status === "fulfilled" && eventTypesRes.value.status === "ok") {
        setEventTypes(eventTypesRes.value.data?.entry || []);
      }
      if (lookupsRes.status === "fulfilled" && lookupsRes.value.status === "ok") {
        setLookups(lookupsRes.value.data?.entry || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Knowledge Bundle" hideTimePicker />
      <div className="px-6 pt-6">
        <ReplicationSettingsPanel />
        <ReplicationBlacklistPanel />

        {/* Blacklist example */}
        <div className="rounded-xl border border-emerald-500/20 bg-surface-raised mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-brand-400" />
              <h3 className="text-xs font-semibold text-white">How to blacklist files from the knowledge bundle</h3>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 pl-5">
              Apply the following to <code className="font-mono text-emerald-300">distsearch.conf</code> on each search head to exclude lookup files from bundle replication.
            </p>
          </div>
          <div className="px-4 py-3 overflow-x-auto">
            <pre className="font-mono text-[11px] leading-5 text-emerald-300 whitespace-pre">{`[replicationBlacklist]
no_lookup1 = apps/<app1>/lookups/file1.csv
no_lookup2 = apps/<app2>/lookups/file2.csv`}</pre>
          </div>
          <div className="px-4 pb-3 text-[10px] text-gray-500 space-y-1">
            <p>Each key must be unique within the stanza — use a descriptive name (e.g. <code className="font-mono">no_lookup1</code>).</p>
            <p>The value is a regex matched against the bundle-relative file path. Anchoring is not implicit — use <code className="font-mono text-emerald-300">\.csv$</code> to match only at the end.</p>
            <p>Changes take effect after a bundle push. Verify the file no longer appears in the bundle files list above.</p>
          </div>
        </div>

        <BundleFilesPanel />
      </div>
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Knowledge Objects</h2>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Summary cards */}
        <div className="flex gap-4 mb-6">
          {[
            { label: "Saved Searches", count: savedSearches.length, color: "text-emerald-400" },
            { label: "Event Types", count: eventTypes.length, color: "text-cyan-400" },
            { label: "Lookup Definitions", count: lookups.length, color: "text-fuchsia-400" },
          ].map((item) => (
            <div key={item.label} className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
              <span className={`text-2xl font-bold ${item.color}`}>{item.count}</span>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Saved Searches */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            Saved Searches ({savedSearches.length})
          </h3>
          {savedSearches.length > 0 ? (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">App</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Scheduled</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Search</th>
                  </tr>
                </thead>
                <tbody>
                  {savedSearches.map((entry, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-1.5 text-xs text-gray-200">{entry.name}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{entry.acl?.app}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{entry.content?.is_scheduled === "1" ? "Yes" : "No"}</td>
                      <td className="px-3 py-1.5 text-xs font-mono text-gray-500 truncate max-w-xs">{entry.content?.search}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-brand-400" /></div>
          ) : (
            <p className="text-xs text-gray-500">No saved searches found</p>
          )}
        </div>

        {/* Event Types */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            Event Types ({eventTypes.length})
          </h3>
          {eventTypes.length > 0 ? (
            <div className="overflow-auto max-h-48">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">App</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Search</th>
                  </tr>
                </thead>
                <tbody>
                  {eventTypes.map((entry, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-1.5 text-xs text-gray-200">{entry.name}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{entry.acl?.app}</td>
                      <td className="px-3 py-1.5 text-xs font-mono text-gray-500 truncate max-w-xs">{entry.content?.search}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-500">{loading ? "Loading..." : "No event types found"}</p>
          )}
        </div>

        {/* Lookups */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            Lookup Definitions ({lookups.length})
          </h3>
          {lookups.length > 0 ? (
            <div className="overflow-auto max-h-48">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">App</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {lookups.map((entry, i) => (
                    <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-1.5 text-xs text-gray-200">{entry.name}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{entry.acl?.app}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{entry.content?.type || "file"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-500">{loading ? "Loading..." : "No lookups found"}</p>
          )}
        </div>

        {/* REST API reference */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">REST Endpoints Used</span>
          <div className="flex flex-col gap-1 text-xs font-mono text-blue-400/80">
            <span>GET /services/saved/searches?count=0&output_mode=json</span>
            <span>GET /services/saved/eventtypes?count=0&output_mode=json</span>
            <span>GET /services/data/transforms/lookups?count=0&output_mode=json</span>
          </div>
        </div>
      </div>
    </div>
  );
}
