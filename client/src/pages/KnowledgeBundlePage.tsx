import { useState, useEffect } from "react";
import { RefreshCw, Loader2, Package } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";

interface BundleInfo {
  [key: string]: any;
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
