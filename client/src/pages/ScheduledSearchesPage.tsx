import { useState, useEffect } from "react";
import { RefreshCw, Loader2, CalendarClock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";

interface SavedSearch {
  name: string;
  app: string;
  owner: string;
  search: string;
  cronSchedule: string;
  isScheduled: boolean;
  nextScheduledTime: string;
  disabled: boolean;
  actions: string;
  alertType: string;
  dispatchEarliestTime: string;
  dispatchLatestTime: string;
  qualifiedSearch: string;
}

export function ScheduledSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  async function fetchScheduled() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.proxy("saved/searches?count=0");
      if (res.status === "ok" && res.data?.entry) {
        const parsed: SavedSearch[] = res.data.entry
          .map((entry: any) => ({
            name: entry.name,
            app: entry.acl?.app || "",
            owner: entry.acl?.owner || "",
            search: entry.content?.search || "",
            cronSchedule: entry.content?.cron_schedule || "",
            isScheduled: entry.content?.is_scheduled === "1" || entry.content?.is_scheduled === true,
            nextScheduledTime: entry.content?.next_scheduled_time || "",
            disabled: entry.content?.disabled === "1" || entry.content?.disabled === true,
            actions: entry.content?.actions || "",
            alertType: entry.content?.alert_type || "",
            dispatchEarliestTime: entry.content?.["dispatch.earliest_time"] || "",
            dispatchLatestTime: entry.content?.["dispatch.latest_time"] || "",
            qualifiedSearch: entry.content?.qualifiedSearch || "",
          }))
          .filter((s: SavedSearch) => s.isScheduled);
        setSearches(parsed);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchScheduled(); }, []);

  const lowerFilter = filter.toLowerCase();
  const filtered = searches.filter((s) => {
    if (!showDisabled && s.disabled) return false;
    if (!filter) return true;
    return s.name.toLowerCase().includes(lowerFilter) ||
      s.app.toLowerCase().includes(lowerFilter) ||
      s.search.toLowerCase().includes(lowerFilter) ||
      s.owner.toLowerCase().includes(lowerFilter);
  });

  const enabledCount = searches.filter((s) => !s.disabled).length;
  const disabledCount = searches.filter((s) => s.disabled).length;
  const withActionsCount = searches.filter((s) => s.actions && !s.disabled).length;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Scheduled Searches Audit" />
      <div className="p-6 max-w-6xl">
        {/* Summary cards */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock size={14} className="text-brand-400" />
              <span className="text-2xl font-bold text-white">{searches.length}</span>
            </div>
            <p className="text-xs text-gray-500">Total Scheduled</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">{enabledCount}</span>
            </div>
            <p className="text-xs text-gray-500">Enabled</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={14} className="text-gray-500" />
              <span className="text-2xl font-bold text-gray-400">{disabledCount}</span>
            </div>
            <p className="text-xs text-gray-500">Disabled</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">{withActionsCount}</span>
            </div>
            <p className="text-xs text-gray-500">With Alert Actions</p>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
            placeholder="Filter by name, app, owner, or search..."
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded"
            />
            Show disabled
          </label>
          <button
            onClick={fetchScheduled}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>

        {/* Table */}
        {loading && searches.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Status</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">App</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Owner</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Cron</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Time Range</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Actions</th>
                    <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">Next Run</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={`${s.app}-${s.name}-${i}`} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors group">
                      <td className="px-3 py-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor: s.disabled ? "#6b7280" : "#10b981",
                            boxShadow: s.disabled ? "none" : "0 0 4px #10b98180",
                          }}
                          title={s.disabled ? "Disabled" : "Enabled"}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-gray-200">{s.name}</span>
                        <div className="hidden group-hover:block mt-1">
                          <pre className="text-[10px] font-mono text-gray-500 whitespace-pre-wrap max-w-md">{s.search}</pre>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{s.app}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{s.owner}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-400">{s.cronSchedule}</td>
                      <td className="px-3 py-2 text-[10px] text-gray-500">
                        {s.dispatchEarliestTime && (
                          <span>{s.dispatchEarliestTime} → {s.dispatchLatestTime || "now"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {s.actions ? (
                          <div className="flex flex-wrap gap-1">
                            {s.actions.split(",").map((a) => (
                              <span key={a.trim()} className="rounded px-1.5 py-0.5 text-[10px] bg-brand-500/10 text-brand-400">
                                {a.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-gray-500">{s.nextScheduledTime || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <p className="text-xs text-gray-500 text-center py-8">
            {filter ? `No scheduled searches match "${filter}"` : "No scheduled searches found"}
          </p>
        )}

        {/* REST reference */}
        <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-2">REST Endpoint</span>
          <code className="text-xs font-mono text-blue-400/80">
            GET /services/saved/searches?count=0&output_mode=json
          </code>
        </div>
      </div>
    </div>
  );
}
