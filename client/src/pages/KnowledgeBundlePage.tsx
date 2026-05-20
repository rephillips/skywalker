import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Package, Crown, Server, AlertTriangle } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";

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

interface BtoolRow {
  file: string;
  content: string;   // "[stanza]" or "key = value"
  isStanza: boolean;
  stanza: string;    // current stanza name (no brackets)
  rawObj: any;
}

function parseBtoolRows(results: any[]): BtoolRow[] {
  if (!results.length) return [];

  // Prefer _raw parsing — gives us the full file path directly.
  // Each result's _raw may contain multiple btool lines concatenated:
  //   "/opt/splunk/.../file.conf    [stanzaName]/opt/splunk/.../file.conf    key = value..."
  // Split on each new absolute path that follows non-whitespace content.
  const hasRawPaths = results.some(r => /^\//.test(String(r._raw ?? "").trim()));
  if (hasRawPaths) {
    const out: BtoolRow[] = [];
    let currentStanza = "";
    for (const row of results) {
      const rawStr = String(row._raw ?? "").trim();
      if (!rawStr.startsWith("/")) continue;
      // Insert a newline before each new absolute path that follows non-whitespace
      const lines = rawStr
        .replace(/([^\s])(\/[a-z])/g, "$1\n$2")
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.startsWith("/"));
      for (const line of lines) {
        const m = line.match(/^(\S+)\s+(.*)/);
        if (!m) continue;
        const file    = m[1];
        const content = m[2].trim();
        const isStanza = /^\[.+\]$/.test(content);
        if (isStanza) currentStanza = content.slice(1, -1);
        if (currentStanza !== "replicationSettings") continue;
        out.push({ file, content, isStanza, stanza: currentStanza, rawObj: row });
      }
    }
    if (out.length > 0) return out;
  }

  const allFields = Object.keys(results[0]).filter(k => !k.startsWith("_"));

  // Detect Admin's Little Helper BTOOL.* format
  const isBtoolFormat = allFields.some(k => /^btool\./i.test(k));

  if (isBtoolFormat) {
    const prefixField = allFields.find(k => /^btool\.cmd\.prefix$/i.test(k));
    const confField   = allFields.find(k => /^btool\.cmd\.conf$/i.test(k));
    const keysField   = allFields.find(k => /^btool\.keys$/i.test(k));
    // File path: check ALL fields including _ prefixed (e.g. _raw) for a path value
    const allFieldsIncRaw = Object.keys(results[0]);
    const fileField = allFieldsIncRaw.find(k =>
      results.some(r => /^\/opt\/splunk/.test(String(r[k] ?? "")))
    ) ?? allFieldsIncRaw.find(k =>
      results.some(r => /^\//.test(String(r[k] ?? "")))
    );
    // Setting columns: everything that isn't a BTOOL.* meta field
    const settingCols = allFields.filter(k => !/^btool\./i.test(k));

    const out: BtoolRow[] = [];
    let addedStanza = false;

    for (const row of results) {
      const stanza = prefixField ? String(row[prefixField] ?? "").trim() : "";
      // Exact match only — exclude replicationSettings:refineConf and any sub-stanzas
      if (stanza && stanza !== "replicationSettings") continue;

      const file = fileField
        ? String(row[fileField] ?? "")
        : confField ? String(row[confField] ?? "") : "";

      if (!addedStanza) {
        out.push({ file, content: `[${stanza || "replicationSettings"}]`, isStanza: true, stanza: stanza || "replicationSettings", rawObj: row });
        addedStanza = true;
      }

      // BTOOL.KEYS is a comma-separated list of all keys in this row
      const btoolKeysRaw = keysField ? String(row[keysField] ?? "").trim() : "";
      const keys = btoolKeysRaw
        ? btoolKeysRaw.split(",").map(k => k.trim()).filter(Boolean)
        : [];

      if (keys.length > 0) {
        for (const key of keys) {
          // Match key to column: dots/underscores stripped, case-insensitive
          const normalise = (s: string) => s.toUpperCase().replace(/[\._]/g, "");
          const matchCol = settingCols.find(c => normalise(c) === normalise(key));
          const val = matchCol ? String(row[matchCol] ?? "").trim() : "";
          if (!val) continue; // skip attributes with no value (refineConf rows)
          out.push({ file, content: `${key} = ${val}`, isStanza: false, stanza: stanza || "replicationSettings", rawObj: row });
        }
      } else {
        // Fallback: one row per non-empty setting column
        for (const col of settingCols) {
          const val = String(row[col] ?? "").trim();
          if (!val) continue;
          out.push({ file, content: `${col} = ${val}`, isStanza: false, stanza: stanza || "replicationSettings", rawObj: row });
        }
      }
    }

    // Deduplicate by key name — keep first occurrence (highest precedence in merge chain)
    const seenKeys = new Set<string>();
    return out.filter(row => {
      if (row.isStanza) return true;
      const key = row.content.split(" = ")[0].trim();
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }

  // Classic format: one field has a file path, others have key/value
  const fileField = allFields.find(k => String(results[0][k]).startsWith("/")) ?? allFields[0];
  const otherFields = allFields.filter(k => k !== fileField);

  const getContent = (row: any): string => {
    if (otherFields.length === 0) return "";
    if (otherFields.length === 1) return String(row[otherFields[0]] ?? "");
    const attrField = otherFields.find(k => k === "attribute" || k === "key") ?? otherFields[0];
    const valField  = otherFields.find(k => k === "value") ?? otherFields[1];
    const attr = String(row[attrField] ?? "").trim();
    const val  = String(row[valField]  ?? "").trim();
    if (!attr) return val;
    if (!val || attr.startsWith("[")) return attr;
    return `${attr} = ${val}`;
  };

  const out: BtoolRow[] = [];
  let currentStanza = "";
  for (const row of results) {
    const file    = String(row[fileField] ?? "");
    const content = getContent(row).trim();
    const isStanza = /^\[.+\]$/.test(content);
    if (isStanza) currentStanza = content.replace(/^\[/, "").replace(/\]$/, "");
    if (currentStanza !== "replicationSettings") continue;
    out.push({ file, content, isStanza, stanza: currentStanza, rawObj: row });
  }
  return out.length > 0 ? out : results.map(row => ({
    file: String(row[fileField] ?? ""),
    content: getContent(row),
    isStanza: false,
    stanza: "",
    rawObj: row,
  }));
}

const PREVIEW_ROWS = 20;

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

  const rows = parseBtoolRows(rawRows);
  const policy = rows.find(r => r.content.startsWith("replicationPolicy ="))
    ?.content.replace("replicationPolicy =", "").trim() ?? null;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-brand-400" />
          <h3 className="text-xs font-semibold text-white">Knowledge Bundle Replication Settings</h3>
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
          {/* replicationPolicy hero */}
          {policy && (
            <div className="px-6 py-4 border-b border-surface-border bg-surface/40">
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1">replicationPolicy</div>
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-bold font-mono text-brand-300">{policy}</span>
                {POLICY_DESCRIPTIONS[policy] && (
                  <span className="text-xs text-gray-400">{POLICY_DESCRIPTIONS[policy]}</span>
                )}
              </div>
            </div>
          )}

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
                <div key={group.stanza} className="px-6 pt-4 pb-3">
                  <div className="font-mono text-xs leading-5">
                    {visible.map((row, i) => (
                      <div key={i} className="flex">
                        <span className="text-gray-400 shrink-0 w-[420px] pr-8">{row.file}</span>
                        <span className="text-gray-100">{row.content}</span>
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

          {/* SPL reference */}
          <div className="px-6 py-3 border-t border-surface-border bg-surface/30">
            <code className="text-[10px] font-mono text-blue-400/70">{BTOOL_SPL}</code>
          </div>

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
      <TopBar title="Knowledge Bundle" />
      <div className="px-6 pt-6">
        <ReplicationSettingsPanel />
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
