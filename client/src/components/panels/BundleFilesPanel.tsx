import { useState, useEffect, useCallback } from "react";
import { Archive, Loader2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../services/api";
import { ErrorAlert } from "../common/ErrorAlert";

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

export function BundleFilesPanel() {
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

  const summary  = rows.find(r => r.is_summary === "1");
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

  const filtered = allFiles.filter(r =>
    !search || String(r.display ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSearch = (val: string) => { setSearch(val); setFilesExpanded(false); };

  const sorted = [...filtered].sort((a, b) => {
    let av: any = a[sortKey], bv: any = b[sortKey];
    if (sortKey === "bytes") { av = Number(av) || 0; bv = Number(bv) || 0; }
    else { av = String(av ?? ""); bv = String(bv ?? ""); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
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

      {!collapsed && (
        <div className="flex-1 overflow-auto flex flex-col min-h-0">
          {error && <div className="p-3 shrink-0"><ErrorAlert message={error} /></div>}

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

          {/* Summary */}
          {summary && (
            <div className="border-b border-surface-border px-4 py-3 shrink-0">
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
              <div className="px-4 py-2 border-b border-surface-border shrink-0">
                <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors" />
              </div>
              <div className="overflow-x-auto flex-1">
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
              <div className="px-4 py-2 flex items-center justify-between text-[10px] text-gray-600 shrink-0">
                <span>
                  {filesExpanded
                    ? `${sorted.length} files`
                    : `Top ${Math.min(FILE_PREVIEW, sorted.length)} of ${sorted.length} files by size`}
                </span>
                {sorted.length > FILE_PREVIEW && (
                  <button onClick={() => setFilesExpanded(e => !e)}
                    className="text-brand-400 hover:text-brand-200 transition-colors">
                    {filesExpanded ? "Collapse" : `Show all ${sorted.length} files`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
