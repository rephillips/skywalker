import { useState, useEffect, useCallback } from "react";
import { Loader2, Play, Search, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, AlertCircle } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import type { SplunkResult } from "../types/splunk";

// ─── Splunk Cloud Status ───────────────────────────────────────────────────────

type Indicator = "none" | "minor" | "major" | "critical";
type ComponentStatus = "operational" | "degraded_performance" | "partial_outage" | "major_outage" | "under_maintenance";

interface CloudStatusData {
  status:   { indicator: Indicator; description: string };
  page:     { name: string; updated_at: string };
  components: { id: string; name: string; status: ComponentStatus; group: boolean; group_id: string | null }[];
  incidents: { id: string; name: string; status: string; impact: string; shortlink: string; updated_at: string }[];
  scheduled_maintenances: { id: string; name: string; status: string; scheduled_for: string; shortlink: string }[];
}

function indicatorColor(ind: Indicator) {
  if (ind === "none")     return { dot: "bg-emerald-400", text: "text-emerald-400", label: "All Systems Operational" };
  if (ind === "minor")    return { dot: "bg-yellow-400",  text: "text-yellow-400",  label: "Minor Issues" };
  if (ind === "major")    return { dot: "bg-orange-400",  text: "text-orange-400",  label: "Major Issues" };
  return                         { dot: "bg-red-500",     text: "text-red-400",     label: "Critical Incident" };
}

function componentStatusBadge(s: ComponentStatus) {
  const map: Record<ComponentStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    operational:          { label: "Operational",         cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle size={10} /> },
    degraded_performance: { label: "Degraded",            cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",   icon: <AlertCircle size={10} /> },
    partial_outage:       { label: "Partial Outage",      cls: "bg-orange-500/15 text-orange-400 border-orange-500/30",   icon: <AlertTriangle size={10} /> },
    major_outage:         { label: "Major Outage",        cls: "bg-red-500/15 text-red-400 border-red-500/30",            icon: <XCircle size={10} /> },
    under_maintenance:    { label: "Maintenance",         cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",         icon: <Clock size={10} /> },
  };
  const m = map[s] ?? { label: s, cls: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function SplunkCloudStatus() {
  const [data, setData]       = useState<CloudStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.cloudStatus();
      setData(res.data as CloudStatusData);
      setLastFetch(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ind     = data ? indicatorColor(data.status.indicator) : null;
  const nonGroups = data?.components.filter(c => !c.group) ?? [];
  const degraded  = nonGroups.filter(c => c.status !== "operational" && c.status !== "under_maintenance");
  const incidents = data?.incidents ?? [];
  const maintenances = data?.scheduled_maintenances ?? [];

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          {ind && <span className={`w-2 h-2 rounded-full ${ind.dot} shrink-0`} />}
          <span className="text-xs font-semibold text-white">Splunk Cloud Status</span>
          {ind && <span className={`text-[11px] font-mono ${ind.text}`}>{data?.status.description}</span>}
        </div>
        <div className="flex items-center gap-3">
          {lastFetch && (
            <span className="text-[10px] text-gray-600">
              checked {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Refresh
          </button>
          <a
            href="https://status.splunkcloud.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors font-mono"
          >
            status.splunkcloud.com ↗
          </a>
        </div>
      </div>

      {error && <div className="p-3"><ErrorAlert message={error} /></div>}

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-gray-500">
          <Loader2 size={14} className="animate-spin text-brand-400" />
          Fetching status…
        </div>
      )}

      {data && (
        <div className="divide-y divide-surface-border">

          {/* Active incidents */}
          {incidents.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                Active Incidents ({incidents.length})
              </div>
              <div className="flex flex-col gap-2">
                {incidents.map(inc => (
                  <div key={inc.id} className="flex items-start justify-between gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
                    <div>
                      <div className="text-[11px] font-medium text-orange-300">{inc.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {inc.status} · updated {new Date(inc.updated_at).toLocaleString()}
                      </div>
                    </div>
                    <a href={inc.shortlink} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400/70 hover:text-emerald-300 whitespace-nowrap shrink-0">
                      details ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled maintenance */}
          {maintenances.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                Scheduled Maintenance ({maintenances.length})
              </div>
              <div className="flex flex-col gap-2">
                {maintenances.map(m => (
                  <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                    <div>
                      <div className="text-[11px] font-medium text-blue-300">{m.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {m.status} · scheduled {new Date(m.scheduled_for).toLocaleString()}
                      </div>
                    </div>
                    <a href={m.shortlink} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400/70 hover:text-emerald-300 whitespace-nowrap shrink-0">
                      details ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Degraded components (highlighted) */}
          {degraded.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                Affected Components ({degraded.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {degraded.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-300 font-mono">{c.name}</span>
                    {componentStatusBadge(c.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All components */}
          <details>
            <summary className="px-4 py-2.5 text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 select-none">
              All components ({nonGroups.length})
            </summary>
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
              {nonGroups.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[10px] text-gray-400 font-mono truncate">{c.name}</span>
                  {componentStatusBadge(c.status)}
                </div>
              ))}
            </div>
          </details>

        </div>
      )}
    </div>
  );
}

const DEFAULT_SPL = "| rest splunk_server=local /services/server/info | table splunk_server guid serverName version os_name os_version numberOfCores numberOfVirtualCores physicalMemoryMB cpu_arch product_type license_state activeLicenseGroup";

export function SystemInfoPage() {
  const [spl, setSpl] = useState(DEFAULT_SPL);
  const [results, setResults] = useState<SplunkResult[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.search(spl);
      setResults(response.results);
      if (response.results && response.results.length > 0) {
        setColumns(Object.keys(response.results[0]));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl]);

  // Fetch full server info via REST proxy
  useEffect(() => {
    api.proxy("server/info").then((res) => {
      if (res.status === "ok" && res.data?.entry?.[0]?.content) {
        setAllFields(res.data.entry[0].content);
      }
    }).catch(() => {});
  }, []);

  // Run default search on mount
  useEffect(() => {
    runSearch();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="System Info" />
      <div className="p-6 max-w-4xl">
        {/* Editable SPL query */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-400">System Info Query</span>
          </div>
          <div className="flex gap-2">
            <textarea
              value={spl}
              onChange={(e) => setSpl(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors resize-none"
              spellCheck={false}
            />
            <button
              onClick={runSearch}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50 self-start"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setSpl(DEFAULT_SPL)}
              className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
            >
              Reset to default
            </button>
            <span className="text-[10px] text-gray-600">Cmd+Enter to run</span>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Search results */}
        {results && results.length > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 mb-4">
            <h2 className="text-sm font-semibold text-white mb-4">Query Results</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              {columns.map((col) => {
                const value = results[0][col];
                if (!value) return null;
                return (
                  <div key={col}>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide block">
                      {col}
                    </span>
                    <span className="text-sm text-gray-200 font-mono">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
            {results.length > 1 && (
              <div className="mt-4 overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border">
                      {columns.map((col) => (
                        <th key={col} className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                        {columns.map((col) => (
                          <td key={col} className="px-3 py-1.5 text-xs font-mono text-gray-300">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Splunk Cloud Status */}
        <div className="mb-4">
          <SplunkCloudStatus />
        </div>

        {/* REST API reference */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4 mb-4">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">
            REST API Endpoint
          </span>
          <pre className="text-xs font-mono text-blue-400/80">
            GET /services/server/info?output_mode=json
          </pre>
        </div>

        {/* Full server properties from REST */}
        {allFields && (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">All Server Properties</h3>
              <span className="text-[10px] text-gray-500">{Object.keys(allFields).length} properties</span>
            </div>
            <div className="overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Property</th>
                    <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(allFields)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                      <tr key={key} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                        <td className="px-3 py-1.5 text-xs font-mono text-gray-400">{key}</td>
                        <td className="px-3 py-1.5 text-xs font-mono text-gray-200 break-all">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
