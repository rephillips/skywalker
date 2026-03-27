import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Loader2, CalendarClock, AlertTriangle, CheckCircle, Zap, Wrench, Check, X } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import type { SplunkResult } from "../types/splunk";

const ENABLED_SPL = '| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" search="disabled=0" count=0 | table title, cron_schedule, dispatch.earliest_time, dispatch.latest_time, eai:acl.app, eai:acl.owner, eai:acl.sharing, next_scheduled_time, actions, search';
const ALL_SPL = '| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" count=0 | table title, cron_schedule, dispatch.earliest_time, dispatch.latest_time, eai:acl.app, eai:acl.owner, eai:acl.sharing, next_scheduled_time, actions, disabled, search';

/** Parse a Splunk relative time string like -1h, -15m, -1d, -7d, -1h@h into seconds */
function parseTimeRangeSeconds(earliest: string): number | null {
  if (!earliest) return null;
  // Strip snap-to modifiers like @h, @d
  const clean = earliest.replace(/@[a-z]+$/i, "");
  const m = clean.match(/^-(\d+)(s|m|h|d|w|mon)$/);
  if (!m) return null;
  const val = parseInt(m[1]);
  switch (m[2]) {
    case "s": return val;
    case "m": return val * 60;
    case "h": return val * 3600;
    case "d": return val * 86400;
    case "w": return val * 604800;
    case "mon": return val * 2592000;
    default: return null;
  }
}

/** Parse cron schedule to get the minimum interval in seconds between runs */
function parseCronIntervalSeconds(cron: string): number | null {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minute, hour, dom, month, dow] = parts;

  // */N minute = every N minutes
  if (minute.startsWith("*/")) {
    return parseInt(minute.slice(2)) * 60;
  }
  // Specific minute, check hour
  if (hour === "*" && minute !== "*") {
    // Runs every hour at specific minute
    return 3600;
  }
  if (minute === "*" && hour === "*") {
    // Every minute
    return 60;
  }
  if (minute === "*") {
    // Every minute of specific hour — treat as hourly
    return 3600;
  }
  // Specific hour and minute
  if (hour !== "*" && dom === "*" && month === "*") {
    // Daily
    return 86400;
  }
  // Specific day of week
  if (dow !== "*" && dom === "*") {
    return 604800; // Weekly
  }
  // Specific day of month
  if (dom !== "*") {
    return 2592000; // ~Monthly
  }
  // Default: assume daily
  return 86400;
}

interface Efficiency {
  timeWindowSec: number | null;
  cronIntervalSec: number | null;
  ratio: number | null;
  status: "ok" | "warning" | "critical" | "unknown";
  message: string;
}

function analyzeEfficiency(earliest: string, cron: string): Efficiency {
  const tw = parseTimeRangeSeconds(earliest);
  const ci = parseCronIntervalSeconds(cron);

  if (tw === null && ci !== null) {
    return { timeWindowSec: null, cronIntervalSec: ci, ratio: null, status: "warning", message: `No earliest set — cron runs every ${formatSeconds(ci)}` };
  }
  if (tw === null || ci === null) {
    return { timeWindowSec: tw, cronIntervalSec: ci, ratio: null, status: "unknown", message: tw === null ? "No earliest time" : "Cannot parse cron" };
  }

  const ratio = tw / ci;

  if (ratio <= 1.1) {
    return { timeWindowSec: tw, cronIntervalSec: ci, ratio, status: "ok", message: `${ratio.toFixed(1)}x — Efficient` };
  }
  if (ratio <= 2) {
    return { timeWindowSec: tw, cronIntervalSec: ci, ratio, status: "warning", message: `${ratio.toFixed(1)}x — Overlap: scanning ${(ratio - 1).toFixed(0)}x extra data` };
  }
  return { timeWindowSec: tw, cronIntervalSec: ci, ratio, status: "critical", message: `${ratio.toFixed(1)}x — Heavy overlap: scanning ${(ratio - 1).toFixed(0)}x extra data` };
}

/** Detect inline earliest=/latest= in SPL that override dispatch times */
function detectInlineTimeOverrides(spl: string): { earliest?: string; latest?: string } | null {
  if (!spl) return null;
  const overrides: { earliest?: string; latest?: string } = {};
  const earliestMatch = spl.match(/\bearliest\s*=\s*("[^"]*"|'[^']*'|\S+)/i);
  const latestMatch = spl.match(/\blatest\s*=\s*("[^"]*"|'[^']*'|\S+)/i);
  if (earliestMatch) overrides.earliest = earliestMatch[1].replace(/["']/g, "");
  if (latestMatch) overrides.latest = latestMatch[1].replace(/["']/g, "");
  if (Object.keys(overrides).length === 0) return null;
  return overrides;
}

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Convert cron to human-readable description */
function cronToHuman(cron: string): string {
  if (!cron) return "";
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [minute, hour, dom, month, dow] = parts;

  const pieces: string[] = [];

  // Minute
  if (minute === "*") pieces.push("Every minute");
  else if (minute.startsWith("*/")) pieces.push(`Every ${minute.slice(2)} minutes`);
  else pieces.push(`At minute ${minute}`);

  // Hour
  if (hour === "*" && !minute.startsWith("*/") && minute !== "*") {
    pieces.push("of every hour");
  } else if (hour.startsWith("*/")) {
    pieces.push(`every ${hour.slice(2)} hours`);
  } else if (hour !== "*") {
    const h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const min = minute === "*" || minute.startsWith("*/") ? "" : `:${minute.padStart(2, "0")}`;
    pieces.length = 0; // reset
    pieces.push(`At ${h12}${min} ${ampm}`);
  }

  // Day of month
  if (dom !== "*" && dom !== "?") {
    pieces.push(`on day ${dom} of the month`);
  }

  // Month
  if (month !== "*") {
    const m = parseInt(month);
    if (m >= 1 && m <= 12) pieces.push(`in ${MONTH_NAMES[m]}`);
    else pieces.push(`in month ${month}`);
  }

  // Day of week
  if (dow !== "*" && dow !== "?") {
    const days = dow.split(",").map((d) => {
      const n = parseInt(d);
      return n >= 0 && n <= 6 ? DOW_NAMES[n] : d;
    });
    pieces.push(`on ${days.join(", ")}`);
  }

  return pieces.join(" ");
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

export function ScheduledSearchesPage() {
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [showEfficiency, setShowEfficiency] = useState(false);
  const [spl, setSpl] = useState(ENABLED_SPL);
  const [editSpl, setEditSpl] = useState(false);
  const [customSpl, setCustomSpl] = useState(ENABLED_SPL);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [fixingRow, setFixingRow] = useState<number | null>(null);
  const [fixCron, setFixCron] = useState("");
  const [fixEarliest, setFixEarliest] = useState("");
  const [fixLatest, setFixLatest] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: string; text: string } | null>(null);

  async function fetchScheduled(query?: string) {
    setLoading(true);
    setError(null);
    try {
      if (!query && !editSpl) {
        // Use direct REST proxy to avoid | rest caching
        // NS/ prefix tells proxy to use /servicesNS/ for all users/apps
        const res = await api.proxy("NS/-/-/saved/searches?count=0");
        if (res.status === "ok" && res.data?.entry) {
          const parsed: SplunkResult[] = res.data.entry
            .filter((entry: any) => {
              const c = entry.content || {};
              const isScheduled = c.is_scheduled === "1" || c.is_scheduled === true;
              const isDisabled = c.disabled === "1" || c.disabled === true;
              if (!isScheduled) return false;
              if (!showDisabled && isDisabled) return false;
              return true;
            })
            .map((entry: any) => ({
              title: entry.name || "",
              cron_schedule: entry.content?.cron_schedule || "",
              "dispatch.earliest_time": entry.content?.["dispatch.earliest_time"] || "",
              "dispatch.latest_time": entry.content?.["dispatch.latest_time"] || "",
              "eai:acl.app": entry.acl?.app || "",
              "eai:acl.owner": entry.acl?.owner || "",
              "eai:acl.sharing": entry.acl?.sharing || "",
              next_scheduled_time: entry.content?.next_scheduled_time || "",
              actions: entry.content?.actions || "",
              disabled: String(entry.content?.disabled || "0"),
              search: entry.content?.search || "",
            }));
          setResults(parsed);
        }
      } else {
        // Custom SPL query
        const uniqueSpl = `${query || spl} | eval _t=${Date.now()} | fields - _t`;
        const res = await api.search(uniqueSpl);
        setResults(res.results || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchScheduled(); }, [spl, showDisabled]);

  function toggleDisabled() {
    setShowDisabled((prev) => !prev);
    // SPL change triggers useEffect refetch, but REST path filters client-side
    // so we just need to toggle the state — the filter in fetchScheduled reads it
  }

  function startFix(index: number, row: SplunkResult) {
    setFixingRow(index);
    setFixCron(row["cron_schedule"] || "");
    setFixEarliest(row["dispatch.earliest_time"] || "");
    setFixLatest(row["dispatch.latest_time"] || "");
    setSaveMsg(null);
  }

  async function applyFix(row: SplunkResult) {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Always send all fields to ensure the update takes effect
      const updates: Record<string, string> = {
        "cron_schedule": fixCron,
        "dispatch.earliest_time": fixEarliest,
        "dispatch.latest_time": fixLatest,
      };

      console.log("[Fix] Pushing update:", JSON.stringify(updates), "for:", row["title"]);

      const res = await api.updateSavedSearch(
        row["title"] || "",
        row["eai:acl.app"] || "-",
        row["eai:acl.owner"] || "-",
        updates
      );

      if (res.status === "ok") {
        setSaveMsg({ type: "ok", text: `Updated: ${Object.keys(updates).join(", ")}` });
        // Refresh the table after a short delay
        setTimeout(() => { fetchScheduled(); setFixingRow(null); setSaveMsg(null); }, 1500);
      } else {
        setSaveMsg({ type: "error", text: res.message });
      }
    } catch (err) {
      setSaveMsg({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const lowerFilter = filter.toLowerCase();

  // Compute efficiency for all rows
  const rowsWithEfficiency = useMemo(() => {
    return results.map((r) => {
      const inlineOverrides = detectInlineTimeOverrides(r["search"] || "");
      // Use inline earliest if it exists (it overrides dispatch.earliest_time)
      const effectiveEarliest = inlineOverrides?.earliest || r["dispatch.earliest_time"] || "";
      return {
        ...r,
        _inlineOverrides: inlineOverrides,
        _effectiveEarliest: effectiveEarliest,
        _efficiency: analyzeEfficiency(effectiveEarliest, r["cron_schedule"] || ""),
      };
    });
  }, [results]);

  const filtered = rowsWithEfficiency.filter((r) => {
    if (!filter) return true;
    return Object.values(r).some((v) => typeof v === "string" && v.toLowerCase().includes(lowerFilter));
  });

  // Sort inefficient to top when efficiency mode is on
  const sorted = showEfficiency
    ? [...filtered].sort((a, b) => (b._efficiency.ratio ?? 0) - (a._efficiency.ratio ?? 0))
    : filtered;

  const inefficientCount = rowsWithEfficiency.filter((r) => r._efficiency.status === "warning" || r._efficiency.status === "critical").length;
  const criticalCount = rowsWithEfficiency.filter((r) => r._efficiency.status === "critical").length;

  const columns = [
    { key: "title", label: "Search Name" },
    { key: "cron_schedule", label: "Cron" },
    { key: "dispatch.earliest_time", label: "Earliest" },
    { key: "dispatch.latest_time", label: "Latest" },
    { key: "eai:acl.app", label: "App" },
    { key: "eai:acl.owner", label: "User" },
    { key: "eai:acl.sharing", label: "Sharing" },
    { key: "next_scheduled_time", label: "Next Run" },
    { key: "actions", label: "Actions" },
  ];

  if (showDisabled) {
    columns.push({ key: "disabled", label: "Disabled" });
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Scheduled Searches Audit" />
      <div className="p-6">
        {/* Summary */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock size={14} className="text-brand-400" />
              <span className="text-2xl font-bold text-white">{results.length}</span>
            </div>
            <p className="text-xs text-gray-500">{showDisabled ? "Total Scheduled" : "Enabled Scheduled"}</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">
                {rowsWithEfficiency.filter((r) => r._efficiency.status === "ok").length}
              </span>
            </div>
            <p className="text-xs text-gray-500">Efficient</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">{inefficientCount}</span>
            </div>
            <p className="text-xs text-gray-500">Overlapping</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-red-400" />
              <span className="text-2xl font-bold text-red-400">{criticalCount}</span>
            </div>
            <p className="text-xs text-gray-500">Heavy overlap (&gt;2x)</p>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* SPL query display */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
            <button
              onClick={() => setEditSpl(!editSpl)}
              className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
            >
              {editSpl ? "Cancel" : "Edit"}
            </button>
          </div>
          {editSpl ? (
            <div className="flex gap-2">
              <textarea
                value={customSpl}
                onChange={(e) => setCustomSpl(e.target.value)}
                rows={3}
                className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-none"
                spellCheck={false}
              />
              <button
                onClick={() => { setSpl(customSpl); setEditSpl(false); }}
                className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors"
              >
                Run
              </button>
            </div>
          ) : (
            <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{spl}</pre>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
            placeholder="Filter results..."
          />
          <button
            onClick={() => setShowEfficiency(!showEfficiency)}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              showEfficiency
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : "bg-surface border border-surface-border text-gray-400 hover:text-gray-200"
            )}
          >
            <Zap size={12} />
            {showEfficiency ? "Efficiency On" : "Find Inefficiency"}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={toggleDisabled}
              className="rounded"
            />
            Include disabled
          </label>
          <button
            onClick={() => fetchScheduled()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>

        {/* Results table */}
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    {showEfficiency && (
                      <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                        Efficiency
                      </th>
                    )}
                    {columns.map((col) => (
                      <th key={col.key} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => {
                    const eff = row._efficiency;
                    const rowHighlight = showEfficiency && eff.status === "critical"
                      ? "bg-red-500/5"
                      : showEfficiency && eff.status === "warning"
                      ? "bg-amber-500/5"
                      : "";

                    return (<>
                      <tr
                        key={i}
                        className={clsx("border-b border-surface-border/50 hover:bg-surface-hover transition-colors group cursor-pointer", rowHighlight)}
                        onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      >
                        {showEfficiency && (
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: eff.status === "ok" ? "#10b981"
                                    : eff.status === "warning" ? "#eab308"
                                    : eff.status === "critical" ? "#ef4444"
                                    : "#6b7280",
                                  boxShadow: eff.status === "critical" ? "0 0 6px #ef444480" : undefined,
                                }}
                              />
                              <div className="flex flex-col">
                                <span className={clsx("text-[10px] font-medium", {
                                  "text-emerald-400": eff.status === "ok",
                                  "text-amber-400": eff.status === "warning",
                                  "text-red-400": eff.status === "critical",
                                  "text-gray-500": eff.status === "unknown",
                                })}>
                                  {eff.ratio !== null ? `${eff.ratio.toFixed(1)}x` : "?"}
                                </span>
                                <span className="text-[9px] text-gray-500">
                                  {eff.timeWindowSec !== null && eff.cronIntervalSec !== null
                                    ? `${formatSeconds(eff.timeWindowSec)} / ${formatSeconds(eff.cronIntervalSec)}`
                                    : eff.message}
                                </span>
                              </div>
                              {(eff.status === "warning" || eff.status === "critical") && fixingRow !== i && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); startFix(i, row); }}
                                  className="ml-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                                >
                                  <Wrench size={9} /> Fix
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        {columns.map((col) => {
                          const val = row[col.key] || "";
                          const overrides = row._inlineOverrides;

                          // Earliest column — show inline override warning
                          if (col.key === "dispatch.earliest_time") {
                            return (
                              <td key={col.key} className="px-3 py-2">
                                <div className="text-xs font-mono text-gray-300">{val || "—"}</div>
                                {overrides?.earliest && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <AlertTriangle size={9} className="text-amber-400" />
                                    <span className="text-[9px] text-amber-400">
                                      Inline: earliest={overrides.earliest}
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          }
                          // Latest column — show inline override warning
                          if (col.key === "dispatch.latest_time") {
                            return (
                              <td key={col.key} className="px-3 py-2">
                                <div className="text-xs font-mono text-gray-300">{val || "—"}</div>
                                {overrides?.latest && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <AlertTriangle size={9} className="text-amber-400" />
                                    <span className="text-[9px] text-amber-400">
                                      Inline: latest={overrides.latest}
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          }
                          if (col.key === "actions" && val) {
                            return (
                              <td key={col.key} className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {val.split(",").map((a: string) => (
                                    <span key={a.trim()} className="rounded px-1.5 py-0.5 text-[10px] bg-brand-500/10 text-brand-400">
                                      {a.trim()}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            );
                          }
                          if (col.key === "disabled") {
                            return (
                              <td key={col.key} className="px-3 py-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{
                                    backgroundColor: val === "1" || val === "true" ? "#ef4444" : "#10b981",
                                  }}
                                />
                              </td>
                            );
                          }
                          if (col.key === "cron_schedule" && val) {
                            return (
                              <td key={col.key} className="px-3 py-2">
                                <div className="text-xs font-mono text-gray-300">{val}</div>
                                <div className="text-[9px] text-gray-500">{cronToHuman(val)}</div>
                              </td>
                            );
                          }
                          return (
                            <td key={col.key} className="px-3 py-2 text-xs font-mono text-gray-300 max-w-xs truncate" title={val}>
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                      {expandedRow === i && row.search && (
                        <tr className="bg-surface/50">
                          <td colSpan={columns.length + (showEfficiency ? 1 : 0)} className="px-4 py-2">
                            <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide block mb-1">SPL Query</span>
                            <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{row.search}</pre>
                          </td>
                        </tr>
                      )}
                      {fixingRow === i && showEfficiency && (
                        <tr className="bg-surface">
                          <td colSpan={columns.length + 1} className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1 text-[10px] font-medium text-white">
                                <Wrench size={10} /> Fix: {row.title}
                              </div>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-500">Cron:</span>
                                  <input
                                    value={fixCron}
                                    onChange={(e) => setFixCron(e.target.value)}
                                    className="w-32 rounded border border-surface-border bg-surface-raised px-2 py-1 text-[11px] font-mono text-gray-200 outline-none focus:border-brand-500"
                                  />
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-500">Earliest:</span>
                                  <input
                                    value={fixEarliest}
                                    onChange={(e) => setFixEarliest(e.target.value)}
                                    className="w-20 rounded border border-surface-border bg-surface-raised px-2 py-1 text-[11px] font-mono text-gray-200 outline-none focus:border-brand-500"
                                  />
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-500">Latest:</span>
                                  <input
                                    value={fixLatest}
                                    onChange={(e) => setFixLatest(e.target.value)}
                                    className="w-20 rounded border border-surface-border bg-surface-raised px-2 py-1 text-[11px] font-mono text-gray-200 outline-none focus:border-brand-500"
                                  />
                                </label>
                                {/* Preview new efficiency */}
                                {(() => {
                                  const preview = analyzeEfficiency(fixEarliest, fixCron);
                                  return (
                                    <span className={clsx("text-[10px] font-mono", {
                                      "text-emerald-400": preview.status === "ok",
                                      "text-amber-400": preview.status === "warning",
                                      "text-red-400": preview.status === "critical",
                                      "text-gray-500": preview.status === "unknown",
                                    })}>
                                      → {preview.ratio !== null ? `${preview.ratio.toFixed(1)}x` : "?"}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => applyFix(row)}
                                  disabled={saving}
                                  className="flex items-center gap-1 rounded bg-brand-500 px-3 py-1 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
                                >
                                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                  Push Update to Splunk
                                </button>
                                <button
                                  onClick={() => { setFixingRow(null); setSaveMsg(null); }}
                                  className="flex items-center gap-1 rounded border border-surface-border px-3 py-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                                >
                                  <X size={10} /> Cancel
                                </button>
                                {saveMsg && (
                                  <span className={clsx("text-[10px]", {
                                    "text-emerald-400": saveMsg.type === "ok",
                                    "text-amber-400": saveMsg.type === "warning",
                                    "text-red-400": saveMsg.type === "error",
                                  })}>
                                    {saveMsg.text}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sorted.length === 0 && !loading && (
          <p className="text-xs text-gray-500 text-center py-8">
            {filter ? `No results match "${filter}"` : "No scheduled searches found"}
          </p>
        )}

        {/* Efficiency legend */}
        {showEfficiency && (
          <div className="mt-4 rounded-xl border border-surface-border bg-surface-raised p-4">
            <h3 className="text-xs font-semibold text-white mb-2">Efficiency Analysis</h3>
            <p className="text-[10px] text-gray-500 mb-3">
              Compares the search time window (earliest to latest) against the cron schedule interval.
              If the window is wider than the interval, the search scans overlapping data on each run.
            </p>
            <div className="flex gap-6 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-gray-400">≤ 1.1x — Efficient</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-gray-400">1.1x–2x — Some overlap</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-gray-400">&gt; 2x — Heavy overlap</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                <span className="text-gray-400">Cannot determine</span>
              </div>
            </div>
          </div>
        )}

        {/* Scheduled Search Inefficiency Audit */}
        <AuditInefficiency />
      </div>
    </div>
  );
}

// ─── Audit: Scheduled Search Inefficiency via _audit ──────────────
const AUDIT_SPL = `index=_audit sourcetype=audittrail source=audittrail
| fields _time, host, savedsearch_name, action, info, search_et, search_lt, search, search_id, user, total_run_time
| search savedsearch_name!="" TERM(action=search) ( TERM(info=completed) OR ( TERM(info=granted) search_et=* "search='search")) NOT "search_id='rsa_*"
| eval timesearched = round((search_lt-search_et),0)
| fields savedsearch_name, timesearched, user
| join savedsearch_name
    [| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" search="disabled=0"
    | fields title, cron_schedule, eai:acl.app
    | rename title as savedsearch_name
    | eval pieces=split(cron_schedule, " ")
    | eval c_min=mvindex(pieces, 0), c_h=mvindex(pieces, 1), c_d=mvindex(pieces, 2), c_mday=mvindex(pieces, 3), c_wday=mvindex(pieces, 4)
    | eval c_min_div=if(match(c_min, "/"), replace(c_min, "^.*/(\\\d+)$", "\\\1"), null())
    | eval c_mins=if(match(c_min, ","), split(c_min, ","), null())
    | eval c_min_div=if(isnotnull(c_mins), abs(tonumber(mvindex(c_mins, 1)) - tonumber(mvindex(c_mins, 0))), c_min_div)
    | eval c_hs=if(match(c_h, ","), split(c_h, ","), null())
    | eval c_h_div=case(match(c_h, "/"), replace(c_h, "^.*/(\\\d+)$", "\\\1"), isnotnull(c_hs), abs(tonumber(mvindex(c_hs, 1)) - tonumber(mvindex(c_hs, 0))), 1=1, null())
    | eval c_wdays=if(match(c_wday, ","), split(c_wday, ","), null())
    | eval c_wday_div=case(match(c_wday, "/"), replace(c_wday, "^.*/(\\\d+)$", "\\\1"), isnotnull(c_wdays), abs(tonumber(mvindex(c_wdays, 1)) - tonumber(mvindex(c_wdays, 0))), 1=1, null())
    | eval i_m=case(c_d < 29, 86400 * 28, c_d = 31, 86400 * 31, 1=1, null())
    | eval i_h=case(isnotnull(c_h_div), c_h_div * 3600, c_h = "*", null(), match(c_h, "^\\\d+$"), 86400)
    | eval i_min=case(isnotnull(c_min_div), c_min_div * 60, c_min = "*", 60, match(c_min, "^\\\d+$"), 3600)
    | eval i_wk=case(isnotnull(c_wday_div), c_wday_div * 86400, c_wday = "*", null(), match(c_wday, "^\\\d+$"), 604800)
    | eval cron_minimum_freq=case(isnotnull(i_m), i_m, isnotnull(i_wk) AND isnotnull(c_min_div), i_min, isnotnull(i_wk) AND isnull(c_min_div), i_wk, isnotnull(i_h), i_h, 1=1, min(i_min))
    | fields - c_d c_h c_hs c_h_div c_mday c_min c_min_div c_mins c_wday c_wdays c_wday_div pieces i_m i_min i_h i_wk
    | fields savedsearch_name cron_minimum_freq cron_schedule eai:acl.app]
| eval magic=cron_minimum_freq*3
| where timesearched>magic
| eval ratio=round(timesearched/cron_minimum_freq,0) . ":" . 1, timesearched=round(timesearched/60,0), cron_minimum_freq=cron_minimum_freq/60
| dedup savedsearch_name
| table savedsearch_name, eai:acl.app, user, timesearched, cron_minimum_freq, cron_schedule, ratio
| rename savedsearch_name AS "Saved Search Name", eai:acl.app AS "App", user AS "User", timesearched AS "Time Searched (Minutes)", cron_minimum_freq AS "Minimum Frequency (Minutes)", cron_schedule AS "Cron Schedule", ratio AS Ratio
| sort -Ratio`;

function AuditInefficiency() {
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpl, setShowSpl] = useState(false);
  const [customSpl, setCustomSpl] = useState(AUDIT_SPL);
  const [editingSpl, setEditingSpl] = useState(false);

  async function runAudit(spl?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(spl || customSpl, "-24h", "now");
      setResults(res.results || []);
      if (res.results?.length > 0) {
        setColumns(Object.keys(res.results[0]).filter((k) => !k.startsWith("_")));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            Scheduled Search Inefficiency Audit
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Finds searches where the actual time scanned is &gt;3x the cron frequency (from _audit index)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSpl(true); setEditingSpl(true); }}
            className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors"
          >
            <Wrench size={11} />
            Edit Search
          </button>
          <button
            onClick={() => setShowSpl(!showSpl)}
            className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
          >
            {showSpl ? "Hide SPL" : "View SPL"}
          </button>
          <button
            onClick={() => runAudit()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Run Audit
          </button>
        </div>
      </div>

      {/* SPL display */}
      {showSpl && (
        <div className="rounded-xl border border-surface-border bg-surface-raised p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Audit SPL Query</span>
            <button
              onClick={() => setEditingSpl(!editingSpl)}
              className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
            >
              {editingSpl ? "Cancel" : "Edit"}
            </button>
          </div>
          {editingSpl ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={customSpl}
                onChange={(e) => setCustomSpl(e.target.value)}
                rows={15}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[10px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y"
                spellCheck={false}
              />
              <button
                onClick={() => { runAudit(); setEditingSpl(false); }}
                className="self-start rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors"
              >
                Run
              </button>
            </div>
          ) : (
            <pre className="text-[10px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all max-h-60 overflow-auto">{customSpl}</pre>
          )}
        </div>
      )}

      {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-raised z-10">
                <tr className="border-b border-surface-border">
                  {columns.map((col) => (
                    <th key={col} className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 text-xs font-mono text-gray-300 max-w-xs truncate" title={row[col]}>
                        {col === "Ratio" ? (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-400">
                            {row[col]}
                          </span>
                        ) : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-raised p-6 text-center">
          <p className="text-xs text-gray-500">Click "Run Audit" to find inefficient scheduled searches from the _audit index</p>
        </div>
      )}
    </div>
  );
}
