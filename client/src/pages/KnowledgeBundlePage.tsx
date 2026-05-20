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
  none:           "No replication — each SH uses its own local bundle",
};

function ReplicationSettingsPanel() {
  const [settings, setSettings] = useState<{ key: string; value: string; _raw: any }[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [captain, setCaptain] = useState<string | null>(null);
  const [currentSh, setCurrentSh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [btoolRes, shcRes, infoRes] = await Promise.all([
        api.search(BTOOL_SPL),
        api.proxy("shcluster/member/members"),
        api.proxy("server/info"),
      ]);

      if (btoolRes.results?.length > 0) {
        const raw = btoolRes.results;
        // Try common field name patterns for btool output
        const firstRow = raw[0];
        const keyField   = "key"       in firstRow ? "key"       : "attribute" in firstRow ? "attribute" : Object.keys(firstRow).find(k => !k.startsWith("_")) ?? "key";
        const valueField = "value"     in firstRow ? "value"     : Object.keys(firstRow).find(k => k !== keyField && !k.startsWith("_")) ?? "value";
        const stanzaField = "stanza"   in firstRow ? "stanza"    : null;

        // Filter to [replicationSettings] only — try both with and without brackets
        const filtered = stanzaField
          ? raw.filter((r: any) => {
              const s = String(r[stanzaField] ?? "");
              return s === "replicationSettings" || s === "[replicationSettings]";
            })
          : raw;

        const rows = (filtered.length > 0 ? filtered : raw).map((r: any) => ({
          key:   String(r[keyField]   ?? ""),
          value: String(r[valueField] ?? ""),
          _raw:  r,
        }));

        rows.sort((a: any, b: any) => {
          if (a.key === "replicationPolicy") return -1;
          if (b.key === "replicationPolicy") return 1;
          return a.key.localeCompare(b.key);
        });
        setSettings(rows);
      } else {
        setSettings([]);
      }

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

  const policy = settings.find(s => s.key === "replicationPolicy")?.value ?? null;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-brand-400" />
          <h3 className="text-xs font-semibold text-white">Knowledge Bundle Replication Settings</h3>
          <span className="text-[10px] text-gray-500">distsearch.conf [replicationSettings]</span>
        </div>
        <div className="flex items-center gap-3">
          {/* SH context */}
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
          {settings.length > 0 && (
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

      {loading && !settings.length && (
        <div className="p-6 text-center">
          <Loader2 size={20} className="mx-auto mb-2 text-brand-400 animate-spin" />
          <p className="text-[11px] text-gray-500">Running btool...</p>
        </div>
      )}

      {!loading && !error && settings.length === 0 && (
        <div className="p-4 flex items-center gap-2 text-[11px] text-amber-400">
          <AlertTriangle size={13} />
          No results — Admin&apos;s Little Helper app may not be installed on this SH.
        </div>
      )}

      {settings.length > 0 && (
        <>
          {/* replicationPolicy hero */}
          {policy && (
            <div className="px-4 py-3 border-b border-surface-border bg-surface/40">
              <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1">replicationPolicy</div>
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold font-mono text-brand-300">{policy}</span>
                {POLICY_DESCRIPTIONS[policy] && (
                  <span className="text-[11px] text-gray-400">{POLICY_DESCRIPTIONS[policy]}</span>
                )}
              </div>
            </div>
          )}

          {/* Remaining settings */}
          <div className="divide-y divide-surface-border/50">
            {settings
              .filter(s => s.key !== "replicationPolicy")
              .map(({ key, value }) => (
                <div key={key} className="flex items-center px-4 py-2 hover:bg-surface-hover/30 transition-colors">
                  <span className="w-64 shrink-0 text-[11px] font-mono text-gray-400">{key}</span>
                  <span className="text-[11px] font-mono text-gray-200">{value}</span>
                </div>
              ))}
          </div>

          {/* Raw output for debugging */}
          {showRaw && (
            <div className="border-t border-surface-border p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">Raw result rows — all fields</div>
              <div className="overflow-auto rounded border border-surface-border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface sticky top-0">
                      {settings[0] && Object.keys(settings[0]._raw)
                        .filter(k => !k.startsWith("_") || k === "_raw")
                        .map(col => (
                          <th key={col} className="text-left px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 border-b border-surface-border whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settings.map((s, i) => (
                      <tr key={i} className="border-b border-surface-border/40 hover:bg-surface-hover/20">
                        {Object.keys(s._raw)
                          .filter(k => !k.startsWith("_") || k === "_raw")
                          .map(col => (
                            <td key={col} className="px-4 py-2 text-xs font-mono text-gray-300 align-top">
                              {String(s._raw[col] ?? "")}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SPL reference */}
          <div className="px-4 py-2 border-t border-surface-border bg-surface/30">
            <code className="text-[10px] font-mono text-blue-400/70">{BTOOL_SPL}</code>
          </div>
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
      <div className="p-6 max-w-4xl">
        <ReplicationSettingsPanel />
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
