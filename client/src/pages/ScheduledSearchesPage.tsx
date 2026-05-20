import { useState, useEffect, useMemo, useRef } from "react";
import { AreaChart } from "@tremor/react";
import { RefreshCw, Loader2, CalendarClock, AlertTriangle, CheckCircle, Zap, Wrench, Check, X, Bug, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown, Layers, FileDown, Mail, Play, Activity } from "lucide-react";
import clsx from "clsx";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import type { SplunkResult } from "../types/splunk";
import { CopyButton } from "../components/common/CopyButton";

const ENABLED_SPL = '| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" search="disabled=0" count=0 | table title, cron_schedule, dispatch.earliest_time, dispatch.latest_time, eai:acl.app, eai:acl.owner, eai:acl.sharing, next_scheduled_time, actions, search';
const ALL_SPL = '| rest splunk_server=local "/servicesNS/-/-/saved/searches/" search="is_scheduled=1" count=0 | table title, cron_schedule, dispatch.earliest_time, dispatch.latest_time, eai:acl.app, eai:acl.owner, eai:acl.sharing, next_scheduled_time, actions, disabled, search';

const CONCURRENCY_SPL = `| rest /servicesNS/-/-/saved/searches splunk_server=local timeout=600 search="is_scheduled=1" search="disabled=0" earliest_time=-1h@m latest_time=now
| table title cron_schedule scheduled_times
| mvexpand scheduled_times
| rename scheduled_times as _time
| timechart span=1m count as "Searches Scheduled"
| join splunk_server [| rest splunk_server=local timeout=600 "/services/server/status/limits/search-concurrency?cluster_wide_quota=1"
    | stats max(max_hist_scheduled_searches) as "Max Concurrent Limit"]`;

/** Parse a Splunk relative time string like -1h, -15m, -1d, -7d, -1h@h into offset seconds from now */
function parseRelativeTimeOffsetSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  if (timeStr === "now") return 0;
  // Strip snap-to modifiers like @h, @d
  const clean = timeStr.replace(/@[a-z]+$/i, "");
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

/** Compute the actual scan window in seconds between earliest and latest */
function computeTimeWindowSeconds(earliest: string, latest: string): number | null {
  const e = parseRelativeTimeOffsetSeconds(earliest);
  const l = parseRelativeTimeOffsetSeconds(latest || "now");
  if (e === null || l === null) return null;
  return Math.abs(e - l);
}

/** Parse cron schedule to get the minimum interval in seconds between runs */
function parseCronIntervalSeconds(cron: string): number | null {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [minute, hour, dom, , dow] = parts;

  // Every minute: * * * * *
  if (minute === "*" && hour === "*") return 60;
  // Every N minutes: */N * * * *
  if (minute.startsWith("*/")) return parseInt(minute.slice(2)) * 60;
  // Specific day of month → monthly
  if (dom !== "*" && dom !== "?") return 2592000;
  // Specific day of week → weekly (must check before daily)
  if (dow !== "*" && dow !== "?") return 604800;
  // Specific hour, runs once per day
  if (hour !== "*") return 86400;
  // Specific minute, every hour
  if (minute !== "*") return 3600;
  return 86400;
}

interface Efficiency {
  valueSec: number | null;
  cronIntervalSec: number | null;
  ratio: number | null;
  status: "ok" | "warning" | "critical" | "unknown";
  message: string;
  source: "run_time" | "time_window" | "none";
}

/** Analyze efficiency using time window (earliest→latest) as primary, run_time as fallback */
function analyzeEfficiency(runTimeSec: number | null, timeWindowSec: number | null, cron: string): Efficiency {
  const ci = parseCronIntervalSeconds(cron);

  // Prefer time window (data range scanned) over actual run duration
  const val = timeWindowSec ?? runTimeSec;
  const source = timeWindowSec !== null ? "time_window" as const : runTimeSec !== null ? "run_time" as const : "none" as const;

  if (val === null || ci === null) {
    return { valueSec: val, cronIntervalSec: ci, ratio: null, status: "unknown", message: val === null ? "No data" : "Cannot parse cron", source };
  }

  const ratio = val / ci;
  const label = source === "run_time" ? `${formatSeconds(val)} run` : `${formatSeconds(val)} window`;
  const suffix = `/ ${formatSeconds(ci)} interval`;

  if (ratio <= 1.0) {
    return { valueSec: val, cronIntervalSec: ci, ratio, status: "ok", message: `${label} ${suffix} — Efficient`, source };
  }
  if (ratio <= 2.0) {
    return { valueSec: val, cronIntervalSec: ci, ratio, status: "warning", message: `${label} ${suffix} — Overlap`, source };
  }
  return { valueSec: val, cronIntervalSec: ci, ratio, status: "critical", message: `${label} ${suffix} — Heavy overlap`, source };
}

function isAllTimeSearch(earliest: string, latest: string): boolean {
  const e = (earliest || "").trim();
  const l = (latest || "").trim();
  return (e === "0" || e === "") && (l === "0" || l === "" || l === "now");
}

function isRestApiSearch(spl: string): boolean {
  if (!spl) return false;
  return /^\s*\|\s*(rest|inputlookup)\b/i.test(spl) && !/\bindex\s*=/i.test(spl);
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

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Extract stack name from a SplunkCloud FQDN: sh-i-xxx.STACK.env.splunkcloud.com → STACK */
function extractStackName(fqdn: string): string {
  if (!fqdn) return "";
  const parts = fqdn.split(".");
  // SplunkCloud pattern: <node>.<stack>.<env>.splunkcloud.com
  if (parts.length >= 4 && fqdn.toLowerCase().includes("splunkcloud")) return parts[1];
  // Fallback: return the hostname as-is
  return fqdn;
}

function generatePDFReport(rows: any[], serverName = "", wlmBlocked = false) {
  // rows are already pre-filtered by the caller (honors excludeApps, filterApps, filterUsers)
  // only exclude rest-api/inputlookup searches which are never meaningful for this report
  const reportRows = rows.filter((r) => !r._isNoIndex);
  if (!reportRows.length) return;

  const stackName = extractStackName(serverName);
  const date = new Date().toLocaleString();

  const tableRows = reportRows.map((r) => {
    const eff = r._efficiency;
    const tags = [
      r._isAllTime ? "all-time" : null,
      r._isAllTime && wlmBlocked ? "wlm-blocked" : null,
    ].filter(Boolean);

    const durationCell = r._isAllTime
      ? `<span style="color:#dc2626;font-weight:700">All-Time Search</span>${wlmBlocked ? `<br><span class="wlm-badge">Blocked by WLM Admission Rule</span>` : ""}`
      : `<span style="color:#ea580c;font-weight:700;font-family:monospace">${eff.ratio !== null ? eff.ratio.toFixed(1) + "x" : "?"}</span>
         <br><small style="color:#64748b;font-weight:400">${
           eff.valueSec !== null && eff.cronIntervalSec !== null
             ? `${formatSeconds(eff.valueSec)} window / ${formatSeconds(eff.cronIntervalSec)} interval`
             : eff.message
         }</small>`;

    return `
      <tr class="data-row">
        <td>
          <span class="name">${escapeHtml(r["title"] || "")}</span>
          ${tags.map((t) => `<span class="tag tag-alltime">${t}</span>`).join("")}
        </td>
        <td class="mono">${escapeHtml(r["cron_schedule"] || "—")}<br><small>${escapeHtml(cronToHuman(r["cron_schedule"] || ""))}</small></td>
        <td class="mono">${escapeHtml(r["dispatch.earliest_time"] || "—")}</td>
        <td class="mono">${escapeHtml(r["dispatch.latest_time"] || "—")}</td>
        <td>${escapeHtml(r["eai:acl.app"] || "—")}</td>
        <td>${escapeHtml(r["eai:acl.owner"] || "—")}</td>
        <td>${escapeHtml(r["eai:acl.sharing"] || "—")}</td>
        <td style="white-space:nowrap">${durationCell}</td>
      </tr>
      <tr class="spl-row">
        <td colspan="8"><code>${escapeHtml(r["search"] || "")}</code></td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Inefficient Scheduled Searches — ${date}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    h1 { font-size: 18px; font-weight: 700; margin: 0 0 2px; }
    .stack-name { font-size: 15px; font-weight: 600; color: #0ea5e9; margin: 0 0 3px; letter-spacing: -0.01em; }
    .meta { color: #64748b; font-size: 10px; margin-bottom: 18px; }
    .server { font-family: monospace; font-size: 9.5px; color: #94a3b8; }
    .summary { display: flex; gap: 20px; margin-bottom: 20px; }
    .stat { background: #f1f5f9; border-radius: 8px; padding: 10px 16px; }
    .stat-val { font-size: 22px; font-weight: 700; }
    .stat-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1e293b; color: #e2e8f0; padding: 7px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
    .data-row td { padding: 8px 10px 4px; border-top: 1px solid #e2e8f0; vertical-align: top; }
    .spl-row td { padding: 2px 10px 10px; border-bottom: 2px solid #e2e8f0; }
    code { font-family: "SF Mono", "Fira Code", monospace; font-size: 9.5px; color: #334155; white-space: pre-wrap; word-break: break-all; background: #f8fafc; display: block; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0; }
    .name { font-weight: 600; color: #0f172a; }
    .mono { font-family: monospace; font-size: 11px; }
    small { color: #94a3b8; font-size: 9px; }
    .tag { display: inline-block; margin-left: 5px; padding: 1px 5px; border-radius: 3px; font-size: 8.5px; font-weight: 600; vertical-align: middle; }
    .tag-alltime { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
    .tag-noindex { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
    .tag-wlm-blocked { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
    .wlm-badge { display: inline-block; margin-top: 3px; padding: 1px 6px; border-radius: 3px; font-size: 8.5px; font-weight: 600; background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
    @media print {
      @page { size: A4 landscape; margin: 12mm 15mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>Inefficient Scheduled Searches${stackName ? ` — ${escapeHtml(stackName)}` : ""}</h1>
  ${stackName ? `<div class="stack-name">Splunk Cloud Stack: ${escapeHtml(stackName)}</div>` : ""}
  <div class="meta">
    ${serverName ? `<span class="server">${escapeHtml(serverName)}</span> &nbsp;·&nbsp; ` : ""}
    Generated ${date}
  </div>
  <div class="summary">
    <div class="stat"><div class="stat-val">${reportRows.length}</div><div class="stat-lbl">Inefficient searches</div></div>
    <div class="stat"><div class="stat-val" style="color:#ea580c">${reportRows.filter((r) => !r._isAllTime && (r._efficiency?.ratio ?? 0) > 1.0).length}</div><div class="stat-lbl">Ratio &gt; 1x</div></div>
    <div class="stat"><div class="stat-val" style="color:#dc2626">${reportRows.filter((r) => r._isAllTime).length}</div><div class="stat-lbl">All-Time scans</div></div>
    ${wlmBlocked ? `<div class="stat"><div class="stat-val" style="color:#6d28d9">${reportRows.filter((r) => r._isAllTime).length}</div><div class="stat-lbl">Blocked by WLM Admission Rule</div></div>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Search Name</th><th>Cron</th><th>Earliest</th><th>Latest</th>
        <th>App</th><th>User</th><th>Sharing</th><th>Duration / Freq</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}

function exportCSV(rows: any[], serverName = "", wlmBlocked = false) {
  const exportRows = rows.filter((r) => !r._isNoIndex);
  if (!exportRows.length) return;

  function csvCell(val: string) {
    const s = String(val ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  }

  const stackName = extractStackName(serverName);
  const date = new Date().toISOString().slice(0, 10);
  const metaLines = [
    `"Inefficient Scheduled Searches"`,
    stackName ? `"Splunk Cloud Stack: ${stackName}"` : "",
    serverName ? `"Server: ${serverName}"` : "",
    `"Generated: ${new Date().toLocaleString()}"`,
    "",
  ].filter((l) => l !== undefined);

  const headers = ["Search Name", "Cron", "Earliest", "Latest", "App", "User", "Sharing", "Duration/Freq", "Search SPL"];
  const csvLines = [
    ...metaLines,
    headers.join(","),
    ...exportRows.map((r) => {
      const eff = r._efficiency;
      const duration = r._isAllTime
        ? wlmBlocked ? "All-Time Search — Blocked by WLM Admission Rule" : "All-Time Search"
        : eff.ratio !== null ? `${eff.ratio.toFixed(1)}x` : "?";
      return [
        r["title"] || "",
        r["cron_schedule"] || "",
        r["dispatch.earliest_time"] || "",
        r["dispatch.latest_time"] || "",
        r["eai:acl.app"] || "",
        r["eai:acl.owner"] || "",
        r["eai:acl.sharing"] || "",
        duration,
        r["search"] || "",
      ].map(csvCell).join(",");
    }),
  ];

  const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scheduled-searches-${stackName || "export"}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;
type LogLevel = typeof LOG_LEVELS[number];

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  INFO:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  WARN:  "text-amber-400 bg-amber-500/10 border-amber-500/30",
  ERROR: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  FATAL: "text-rose-600 bg-rose-600/10 border-rose-600/30",
};

const OTHER_LOGGERS = ["ExecProcessor", "SchedulerWindow", "SearchScheduler", "DispatchManager"];
const LOGGER_DEFAULTS: Record<string, LogLevel> = {
  SavedSplunker: "INFO",
  ExecProcessor: "INFO",
  SchedulerWindow: "INFO",
  SearchScheduler: "INFO",
  DispatchManager: "INFO",
};

function LoggerPanel() {
  const [ssLevel, setSsLevel] = useState<LogLevel | null>(null);
  const [ssLoading, setSsLoading] = useState(false);
  const [otherLevels, setOtherLevels] = useState<Record<string, LogLevel | null>>({});
  const [otherLoading, setOtherLoading] = useState<Record<string, boolean>>({});
  const [setting, setSetting] = useState<string | null>(null); // "Name:LEVEL"
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => { fetchLevel("SavedSplunker"); }, []);

  async function fetchLevel(name: string) {
    const isSS = name === "SavedSplunker";
    if (isSS) setSsLoading(true);
    else setOtherLoading((p) => ({ ...p, [name]: true }));
    try {
      const res = await api.proxy(`server/logger/${encodeURIComponent(name)}`);
      if (res.status === "error") throw new Error(res.message || "Logger not found");
      const level = (res.data?.entry?.[0]?.content?.level as LogLevel) ?? null;
      if (isSS) setSsLevel(level);
      else setOtherLevels((p) => ({ ...p, [name]: level }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (isSS) setSsLoading(false);
      else setOtherLoading((p) => ({ ...p, [name]: false }));
    }
  }

  async function setLevel(name: string, level: LogLevel) {
    const key = `${name}:${level}`;
    setSetting(key);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.proxy(`server/logger/${encodeURIComponent(name)}`, "POST", `level=${level}`);
      if (res.status === "error") throw new Error(res.message || "Failed to set log level");
      if (name === "SavedSplunker") setSsLevel(level);
      else setOtherLevels((p) => ({ ...p, [name]: level }));
      setSuccessMsg(`${name} → ${level}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSetting(null);
    }
  }

  const ssIsDebug = ssLevel === "DEBUG";

  return (
    <div className="mb-6 rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
        <Bug size={14} className="text-violet-400 shrink-0" />
        <h3 className="text-xs font-semibold text-white">Scheduler Logger Control</h3>
        <span className="text-[10px] text-gray-500">resets on Splunk restart · check scheduler.log</span>
      </div>

      {/* SavedSplunker primary */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2 min-w-[200px]">
          <span className="text-xs font-semibold text-white font-mono">SavedSplunker</span>
          {ssLoading && <Loader2 size={11} className="animate-spin text-gray-500" />}
          {!ssLoading && ssLevel && (
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-mono font-bold ${LEVEL_COLORS[ssLevel]}`}>
              {ssLevel}
            </span>
          )}
          {!ssLoading && !ssLevel && !error && <span className="text-[10px] text-gray-600">—</span>}
        </div>
        <button
          onClick={() => setLevel("SavedSplunker", "DEBUG")}
          disabled={!!setting || ssIsDebug}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            ssIsDebug ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 cursor-default" : "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
          }`}
        >
          {setting === "SavedSplunker:DEBUG" ? <Loader2 size={11} className="animate-spin" /> : ssIsDebug ? <Check size={11} /> : <Bug size={11} />}
          Enable DEBUG
        </button>
        <button
          onClick={() => setLevel("SavedSplunker", "INFO")}
          disabled={!!setting || ssLevel === "INFO"}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            ssLevel === "INFO" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default" : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          {setting === "SavedSplunker:INFO" ? <Loader2 size={11} className="animate-spin" /> : ssLevel === "INFO" ? <Check size={11} /> : <RefreshCw size={11} />}
          Reset to INFO
        </button>
      </div>

      {/* Other components */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-wide text-gray-500">Other Components</span>
          <button
            onClick={() => OTHER_LOGGERS.forEach(fetchLevel)}
            className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
          >
            <RefreshCw size={10} /> Fetch All
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-[9px] text-gray-600 font-medium pb-1.5 w-40">Component</th>
              <th className="text-left text-[9px] text-gray-600 font-medium pb-1.5 w-20">Default</th>
              <th className="text-left text-[9px] text-gray-600 font-medium pb-1.5 w-24">Current</th>
              <th className="text-right text-[9px] text-gray-600 font-medium pb-1.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/30">
            {OTHER_LOGGERS.map((name) => {
              const level = otherLevels[name] ?? null;
              const isLoadingRow = otherLoading[name];
              const defaultLevel = LOGGER_DEFAULTS[name] as LogLevel;
              const isDebug = level === "DEBUG";
              return (
                <tr key={name}>
                  <td className="py-1.5 pr-3">
                    <span className="text-[11px] font-mono text-gray-300">{name}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className={`text-[10px] font-mono ${LEVEL_COLORS[defaultLevel].split(" ")[0]}`}>{defaultLevel}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    {isLoadingRow ? (
                      <Loader2 size={11} className="animate-spin text-gray-500" />
                    ) : level ? (
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-bold ${LEVEL_COLORS[level]}`}>
                        {level}
                      </span>
                    ) : (
                      <button onClick={() => fetchLevel(name)} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2">
                        fetch
                      </button>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setLevel(name, "DEBUG")}
                        disabled={!!setting || isDebug}
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border transition-colors disabled:opacity-40 ${
                          isDebug ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 cursor-default" : "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        }`}
                      >
                        {setting === `${name}:DEBUG` ? <Loader2 size={9} className="animate-spin" /> : <Bug size={9} />}
                        DEBUG
                      </button>
                      <button
                        onClick={() => setLevel(name, defaultLevel)}
                        disabled={!!setting || level === defaultLevel}
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border border-surface-border text-gray-400 hover:text-gray-200 hover:bg-surface-hover transition-colors disabled:opacity-40"
                      >
                        {setting === `${name}:${defaultLevel}` ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                        {defaultLevel}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(error || successMsg) && (
        <div className="px-5 pb-3 border-t border-surface-border pt-2">
          {error && <ErrorAlert message={error} />}
          {successMsg && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle size={12} /> {successMsg} — check $SPLUNK_HOME/var/log/splunk/scheduler.log
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScheduledSearchesPage() {
  const [results, setResults] = useState<SplunkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [showEfficiency, setShowEfficiency] = useState(true);
  const [showEmailCard, setShowEmailCard] = useState(false);
  const [spl, setSpl] = useState(ENABLED_SPL);
  const [editSpl, setEditSpl] = useState(false);
  const [showSpl, setShowSpl] = useState(false);
  const [customSpl, setCustomSpl] = useState(ENABLED_SPL);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [fixingRow, setFixingRow] = useState<number | null>(null);
  const [fixCron, setFixCron] = useState("");
  const [fixEarliest, setFixEarliest] = useState("");
  const [fixLatest, setFixLatest] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: string; text: string } | null>(null);
  const [runTimes, setRunTimes] = useState<Record<string, number>>({});
  const [runTimesLoading, setRunTimesLoading] = useState(false);
  const [splunkServerName, setSplunkServerName] = useState("");
  const [wlmAllTimeRule, setWlmAllTimeRule] = useState<string | null>(null);
  // Concurrency timechart
  const [showConcurrency, setShowConcurrency] = useState(false);
  const [concurrencySpl, setConcurrencySpl] = useState(CONCURRENCY_SPL);
  const [editConcurrencySpl, setEditConcurrencySpl] = useState(false);
  const [concurrencyData, setConcurrencyData] = useState<any[]>([]);
  const [concurrencyLoading, setConcurrencyLoading] = useState(false);
  const [concurrencyError, setConcurrencyError] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<string>("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filterApps, setFilterApps] = useState<Set<string>>(new Set());
  const [filterUsers, setFilterUsers] = useState<Set<string>>(new Set());
  const [excludeApps, setExcludeApps] = useState<Set<string>>(new Set(["data_manager"]));
  const [appDropdownOpen, setAppDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [excludeDropdownOpen, setExcludeDropdownOpen] = useState(false);
  const appDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const excludeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (appDropdownRef.current && !appDropdownRef.current.contains(e.target as Node)) setAppDropdownOpen(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) setUserDropdownOpen(false);
      if (excludeDropdownRef.current && !excludeDropdownRef.current.contains(e.target as Node)) setExcludeDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchRunTimes() {
    setRunTimesLoading(true);
    try {
      const spl = `index=_internal source=*scheduler.log status=success
| stats latest(run_time) as run_time by savedsearch_name
| fields savedsearch_name run_time`;
      const res = await api.search(spl, "-24h", "now");
      const map: Record<string, number> = {};
      for (const row of res.results || []) {
        const name = row["savedsearch_name"] || "";
        const rt = parseFloat(row["run_time"] || "0");
        if (name && !isNaN(rt)) map[name] = rt;
      }
      setRunTimes(map);
    } catch {
      // Silently fail — efficiency will show "No run data"
      setRunTimes({});
    } finally {
      setRunTimesLoading(false);
    }
  }

  async function fetchConcurrency(spl = concurrencySpl) {
    setConcurrencyLoading(true);
    setConcurrencyError(null);
    try {
      const res = await api.search(spl, "-1h@m", "now");
      const rows = res.results || [];
      const chartRows = rows.map((r: any) => {
        const point: Record<string, string | number> = {};
        const t = r["_time"];
        if (t) {
          const d = new Date(t);
          point["Time"] = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        const scheduled = Number(r["Searches Scheduled"]);
        const limit = Number(r["Max Concurrent Limit"]);
        if (!isNaN(scheduled)) point["Searches Scheduled"] = scheduled;
        if (!isNaN(limit) && limit > 0) point["Max Concurrent Limit"] = limit;
        return point;
      });
      setConcurrencyData(chartRows);
    } catch (err) {
      setConcurrencyError((err as Error).message);
    } finally {
      setConcurrencyLoading(false);
    }
  }

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
          fetchRunTimes();
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

  useEffect(() => {
    api.proxy("server/info")
      .then((res) => {
        if (res.status === "ok") {
          const name = res.data?.entry?.[0]?.content?.serverName
            || res.data?.entry?.[0]?.content?.host
            || "";
          setSplunkServerName(name);
        }
      })
      .catch(() => {});

    // Use admission-control-status via workloads/status — the AllTime field is the authoritative signal
    api.search(
      `| rest /services/workloads/status splunk_server=local | search title=admission-control-status | table title search-filter-rules.AllTime.action search-filter-rules.AllTime.predicate`
    ).then((res) => {
      const row = res.results?.[0] as any;
      const action: string = row?.["search-filter-rules.AllTime.action"] ?? "";
      const predicate: string = row?.["search-filter-rules.AllTime.predicate"] ?? "";
      const ruleName = action ? (predicate || action) : null;
      setWlmAllTimeRule(ruleName);
    }).catch(() => {});
  }, []);

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
        // Immediately patch local row so the table reflects the fix
        setResults((prev) =>
          prev.map((r) =>
            r["title"] === row["title"]
              ? { ...r, cron_schedule: fixCron, "dispatch.earliest_time": fixEarliest, "dispatch.latest_time": fixLatest }
              : r
          )
        );
        // Also refetch from Splunk in the background to pick up any server-side changes
        setTimeout(() => { fetchScheduled(); setFixingRow(null); setSaveMsg(null); }, 2000);
      } else {
        setSaveMsg({ type: "error", text: res.message });
      }
    } catch (err) {
      setSaveMsg({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  // Compute efficiency for all rows using run_time (preferred) or time window (fallback)
  const rowsWithEfficiency = useMemo(() => {
    return results.map((r) => {
      const inlineOverrides = detectInlineTimeOverrides(r["search"] || "");
      const effectiveEarliest = inlineOverrides?.earliest || r["dispatch.earliest_time"] || "";
      const effectiveLatest = inlineOverrides?.latest || r["dispatch.latest_time"] || "now";
      const title = r["title"] || "";
      const rt = runTimes[title] ?? null;
      const tw = computeTimeWindowSeconds(effectiveEarliest, effectiveLatest);
      const dispatchEarliest = r["dispatch.earliest_time"] || "";
      const dispatchLatest = r["dispatch.latest_time"] || "";
      const spl = r["search"] || "";
      return {
        ...r,
        _inlineOverrides: inlineOverrides,
        _effectiveEarliest: effectiveEarliest,
        _efficiency: analyzeEfficiency(rt, tw, r["cron_schedule"] || ""),
        _isAllTime: isAllTimeSearch(r["dispatch.earliest_time"] || "", r["dispatch.latest_time"] || ""),
        _isNoIndex: isRestApiSearch(r["search"] || ""),
      };
    });
  }, [results, runTimes]);

  const availableApps = useMemo(() => [...new Set(rowsWithEfficiency.map((r) => r["eai:acl.app"] || "").filter(Boolean))].sort(), [rowsWithEfficiency]);
  const availableUsers = useMemo(() => [...new Set(rowsWithEfficiency.map((r) => r["eai:acl.owner"] || "").filter(Boolean))].sort(), [rowsWithEfficiency]);

  const filtered = useMemo(() => rowsWithEfficiency.filter((r) => {
    const matchesText = !filter || Object.values(r).some((v) => typeof v === "string" && v.toLowerCase().includes(filter.toLowerCase()));
    if (!matchesText) return false;
    if (filterApps.size > 0 && !filterApps.has(r["eai:acl.app"] || "")) return false;
    if (filterUsers.size > 0 && !filterUsers.has(r["eai:acl.owner"] || "")) return false;
    if (excludeApps.size > 0 && excludeApps.has(r["eai:acl.app"] || "")) return false;
    if (showEfficiency) {
      if (r._isNoIndex) return false;
      if (r._isAllTime) return true;
      return (r._efficiency.ratio ?? 0) > 1.0;
    }
    return true;
  }), [rowsWithEfficiency, filter, filterApps, filterUsers, excludeApps, showEfficiency]);

  function handleSort(key: string) {
    if (sortCol === key) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortCol(null); setSortDir("asc"); }
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
    setExpandedRow(null);
    setFixingRow(null);
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Apply efficiency sort first (all-time floats to top), then column sort on top
  const sorted = useMemo(() => {
    let base = showEfficiency && !sortCol
      ? [...filtered].sort((a, b) => {
          if (a._isAllTime && !b._isAllTime) return -1;
          if (!a._isAllTime && b._isAllTime) return 1;
          return (b._efficiency.ratio ?? 0) - (a._efficiency.ratio ?? 0);
        })
      : [...filtered];
    if (sortCol) {
      base.sort((a, b) => {
        const av = String((a as any)[sortCol] ?? "").toLowerCase();
        const bv = String((b as any)[sortCol] ?? "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return base;
  }, [filtered, showEfficiency, sortCol, sortDir]);

  type EnrichedRow = (typeof rowsWithEfficiency)[0];
  type DisplayItem =
    | { kind: "group"; groupKey: string; count: number }
    | { kind: "row"; row: EnrichedRow; rowIdx: number; groupKey: string };

  const displayItems = useMemo((): DisplayItem[] => {
    if (!groupBy) {
      return sorted.map((row, rowIdx) => ({ kind: "row", row, rowIdx, groupKey: "" }));
    }
    const groups = new Map<string, EnrichedRow[]>();
    for (const row of sorted) {
      const key = String((row as any)[groupBy] || "(none)");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const items: DisplayItem[] = [];
    let rowIdx = 0;
    for (const [groupKey, rows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      items.push({ kind: "group", groupKey, count: rows.length });
      for (const row of rows) {
        items.push({ kind: "row", row, rowIdx: rowIdx++, groupKey });
      }
    }
    return items;
  }, [sorted, groupBy]);

  const inefficientCount = rowsWithEfficiency.filter((r) => !r._isNoIndex && (r._isAllTime || (r._efficiency.ratio ?? 0) > 1.0)).length;

  const columns = [
    { key: "title", label: "Search Name" },
    { key: "cron_schedule", label: "Cron" },
    { key: "dispatch.earliest_time", label: "Earliest" },
    { key: "dispatch.latest_time", label: "Latest" },
    { key: "eai:acl.app", label: "App" },
    { key: "eai:acl.owner", label: "User" },
    { key: "eai:acl.sharing", label: "Sharing" },
    { key: "next_scheduled_time", label: "Next Run" },
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
              <CalendarClock size={14} className="text-blue-400" />
              <span className="text-2xl font-bold text-blue-400">{results.length}</span>
            </div>
            <p className="text-xs text-gray-500">{showDisabled ? "Total Scheduled" : "Enabled Scheduled Searches"}</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">
                {rowsWithEfficiency.filter((r) => !r._isAllTime && !r._isNoIndex && (r._efficiency.ratio ?? 1) <= 1.0 && r._efficiency.status !== "unknown").length}
              </span>
            </div>
            <p className="text-xs text-gray-500">Efficient</p>
          </div>
          <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-2xl font-bold text-amber-400">{inefficientCount}</span>
            </div>
            <p className="text-xs text-gray-500">Inefficient</p>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-[160px] rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-brand-500"
            placeholder="Filter results..."
          />
          {/* App filter */}
          <div className="relative" ref={appDropdownRef}>
            <button
              onClick={() => { setAppDropdownOpen((o) => !o); setUserDropdownOpen(false); setExcludeDropdownOpen(false); }}
              className={clsx("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", filterApps.size > 0 ? "border-brand-500/50 bg-brand-500/10 text-brand-400" : "border-surface-border text-gray-400 hover:text-gray-200")}
            >
              App {filterApps.size > 0 ? `(${filterApps.size})` : "▾"}
            </button>
            {appDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-surface-border bg-surface-raised shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Filter by App</span>
                  {filterApps.size > 0 && <button onClick={() => setFilterApps(new Set())} className="text-[10px] text-brand-400 hover:text-brand-200">Clear</button>}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {availableApps.map((app) => (
                    <button
                      key={app}
                      onClick={() => setFilterApps((prev) => { const next = new Set(prev); next.has(app) ? next.delete(app) : next.add(app); return next; })}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <div className={clsx("w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0", filterApps.has(app) ? "bg-brand-500 border-brand-500" : "border-gray-600")}>
                        {filterApps.has(app) && <Check size={9} className="text-white" />}
                      </div>
                      <span className={filterApps.has(app) ? "text-gray-100" : "text-gray-400"}>{app}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* User filter */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => { setUserDropdownOpen((o) => !o); setAppDropdownOpen(false); setExcludeDropdownOpen(false); }}
              className={clsx("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", filterUsers.size > 0 ? "border-brand-500/50 bg-brand-500/10 text-brand-400" : "border-surface-border text-gray-400 hover:text-gray-200")}
            >
              User {filterUsers.size > 0 ? `(${filterUsers.size})` : "▾"}
            </button>
            {userDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-surface-border bg-surface-raised shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Filter by User</span>
                  {filterUsers.size > 0 && <button onClick={() => setFilterUsers(new Set())} className="text-[10px] text-brand-400 hover:text-brand-200">Clear</button>}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {availableUsers.map((user) => (
                    <button
                      key={user}
                      onClick={() => setFilterUsers((prev) => { const next = new Set(prev); next.has(user) ? next.delete(user) : next.add(user); return next; })}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <div className={clsx("w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0", filterUsers.has(user) ? "bg-brand-500 border-brand-500" : "border-gray-600")}>
                        {filterUsers.has(user) && <Check size={9} className="text-white" />}
                      </div>
                      <span className={filterUsers.has(user) ? "text-gray-100" : "text-gray-400"}>{user}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Exclude App */}
          <div className="relative" ref={excludeDropdownRef}>
            <button
              onClick={() => { setExcludeDropdownOpen((o) => !o); setAppDropdownOpen(false); setUserDropdownOpen(false); }}
              className={clsx("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", excludeApps.size > 0 ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-surface-border text-gray-400 hover:text-gray-200")}
            >
              Exclude App {excludeApps.size > 0 ? `(${excludeApps.size})` : "▾"}
            </button>
            {excludeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-surface-border bg-surface-raised shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Exclude Apps</span>
                  {excludeApps.size > 0 && <button onClick={() => setExcludeApps(new Set())} className="text-[10px] text-rose-400 hover:text-rose-200">Clear all</button>}
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {availableApps.map((app) => (
                    <button
                      key={app}
                      onClick={() => setExcludeApps((prev) => { const next = new Set(prev); next.has(app) ? next.delete(app) : next.add(app); return next; })}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-hover transition-colors"
                    >
                      <div className={clsx("w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0", excludeApps.has(app) ? "bg-rose-500 border-rose-500" : "border-gray-600")}>
                        {excludeApps.has(app) && <X size={9} className="text-white" />}
                      </div>
                      <span className={excludeApps.has(app) ? "text-rose-300" : "text-gray-400"}>{app}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Layers size={11} className="text-gray-500" />
            <span className="text-[10px] text-gray-500">Group:</span>
            {[{ key: "", label: "None" }, { key: "eai:acl.app", label: "App" }, { key: "eai:acl.owner", label: "User" }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setGroupBy(key); setCollapsedGroups(new Set()); }}
                className={clsx("rounded px-2 py-1 text-[10px] border transition-colors", groupBy === key
                  ? "border-brand-500/50 bg-brand-500/10 text-brand-400"
                  : "border-surface-border text-gray-500 hover:text-gray-300 hover:bg-surface-hover"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            <button
              onClick={() => setShowEfficiency(false)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                !showEfficiency
                  ? "bg-brand-500/15 text-brand-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-surface-hover"
              )}
            >
              Show All
            </button>
            <div className="w-px bg-surface-border" />
            <button
              onClick={() => setShowEfficiency(true)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                showEfficiency
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-surface-hover"
              )}
            >
              <Zap size={12} />
              Show Inefficient
            </button>
          </div>
          {showEfficiency && inefficientCount > 0 && (
            <>
              <button
                onClick={() => generatePDFReport(filtered, splunkServerName, !!wlmAllTimeRule)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-brand-500/40 text-brand-400 hover:bg-brand-500/10 transition-colors"
              >
                <FileDown size={12} />
                PDF
              </button>
              <button
                onClick={() => exportCSV(filtered, splunkServerName, !!wlmAllTimeRule)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-brand-500/40 text-brand-400 hover:bg-brand-500/10 transition-colors"
              >
                <FileDown size={12} />
                CSV
              </button>
            </>
          )}
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

        {/* Efficiency legend — above table */}
        {showEfficiency && (
          <div className="mb-3 rounded-xl border border-surface-border bg-surface-raised p-3">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold text-white">Efficiency Analysis</h3>
              {runTimesLoading && <span className="text-[10px] text-brand-400">Loading run times…</span>}
            </div>
            <p className="text-[10px] text-gray-500 mb-2">
              Compares the latest run duration (from scheduler.log) or the scan window (earliest→latest) against the cron interval.
              A ratio &gt;1x means the search scans more time than the interval allows, causing overlap or skipping.
            </p>
            <div className="flex gap-6 text-[10px]">
              <span className="text-gray-400">≤ 1x — Efficient (window fits in interval)</span>
              <span className="text-orange-400">&gt; 1x — Overlap</span>
              <span className="text-red-400">All-Time Search — no time bound</span>
              <span className="text-gray-500">? — No data</span>
            </div>
          </div>
        )}

        {/* Results table */}
        {loading && results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            {/* SPL query — collapsed by default, top-right of table */}
            <div className="flex items-center justify-end border-b border-surface-border/50 px-3 py-1.5 bg-surface-raised">
              <button
                onClick={() => setShowSpl((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] text-emerald-500/70 hover:text-emerald-400 transition-colors font-mono"
              >
                <span>SPL</span>
                {showSpl ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            </div>
            {showSpl && (
              <div className="border-b border-surface-border/50 px-3 py-2 bg-surface flex items-start gap-2">
                <pre className="flex-1 text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all leading-relaxed">{spl}</pre>
                <CopyButton text={spl} />
              </div>
            )}
            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised z-10">
                  <tr className="border-b border-surface-border">
                    {showEfficiency && (
                      <th className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
                        Duration / Freq
                      </th>
                    )}
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="text-left px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap cursor-pointer hover:text-gray-300 select-none"
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortCol === col.key
                            ? sortDir === "asc" ? <ChevronUp size={10} className="text-brand-400" /> : <ChevronDown size={10} className="text-brand-400" />
                            : <ChevronsUpDown size={10} className="opacity-25" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((item) => {
                    if (item.kind === "group") {
                      const isCollapsed = collapsedGroups.has(item.groupKey);
                      const totalCols = columns.length + (showEfficiency ? 1 : 0);
                      return (
                        <tr key={`group-${item.groupKey}`} className="bg-surface/60 border-b border-surface-border">
                          <td colSpan={totalCols} className="px-3 py-1.5">
                            <button
                              onClick={() => toggleGroup(item.groupKey)}
                              className="flex items-center gap-2 text-[11px] font-semibold text-gray-300 hover:text-white transition-colors"
                            >
                              {isCollapsed ? <ChevronRight size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                              <span>{item.groupKey}</span>
                              <span className="rounded-full bg-surface border border-surface-border px-1.5 py-0.5 text-[9px] text-gray-500 font-normal">{item.count}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    const { row, rowIdx: i, groupKey } = item;
                    if (groupBy && collapsedGroups.has(groupKey)) return null;

                    const eff = row._efficiency;
                    const rowHighlight = showEfficiency && row._isAllTime
                      ? "bg-red-500/5"
                      : showEfficiency && (eff.status === "critical" || eff.status === "warning")
                      ? "bg-orange-500/5"
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
                              {row._isAllTime ? (
                                <>
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: "#ef4444", boxShadow: "0 0 6px #ef444480" }} />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-medium text-red-400">All-Time Search</span>
                                    {wlmAllTimeRule && (
                                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/25 whitespace-nowrap" title={`WLM Admission Rule: ${wlmAllTimeRule}`}>
                                        Blocked by WLM Admission Rule
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: eff.status === "ok" ? "#10b981"
                                        : (eff.status === "warning" || eff.status === "critical") ? "#f97316"
                                        : "#6b7280",
                                      boxShadow: eff.status === "critical" ? "0 0 6px #f9731680" : undefined,
                                    }}
                                  />
                                  <div className="flex flex-col">
                                    <span className={clsx("text-[10px] font-medium", {
                                      "text-emerald-400": eff.status === "ok",
                                      "text-orange-400": eff.status === "warning" || eff.status === "critical",
                                      "text-gray-500": eff.status === "unknown",
                                    })}>
                                      {eff.ratio !== null ? `${eff.ratio.toFixed(1)}x` : "?"}
                                    </span>
                                    <span className="text-[9px] text-gray-500">
                                      {eff.valueSec !== null && eff.cronIntervalSec !== null
                                        ? `${formatSeconds(eff.valueSec)} ${eff.source === "run_time" ? "run" : "window"} / ${formatSeconds(eff.cronIntervalSec)} interval`
                                        : eff.message}
                                    </span>
                                  </div>
                                </>
                              )}
                              {(row._isAllTime || eff.status === "warning" || eff.status === "critical") && fixingRow !== i && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); startFix(i, row); }}
                                  className="ml-1 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
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

                          // Title column — show all-time / no-index badges
                          if (col.key === "title") {
                            return (
                              <td key={col.key} className="px-3 py-2 max-w-xs">
                                <div className="text-xs font-mono text-gray-300 truncate" title={val}>{val || "—"}</div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {row._isAllTime && (
                                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/25">
                                      all-time
                                    </span>
                                  )}
                                  {row._isNoIndex && (
                                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/25">
                                      rest api search
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          }

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
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
                              <CopyButton text={row.search} />
                            </div>
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
                                  const preview = analyzeEfficiency(null, computeTimeWindowSeconds(fixEarliest, fixLatest || "now"), fixCron);
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

        {filtered.length === 0 && !loading && (
          <p className="text-xs text-gray-500 text-center py-8">
            {filter ? `No results match "${filter}"` : "No scheduled searches found"}
          </p>
        )}


        {/* Scheduler Concurrency Timechart */}
        <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden mb-4">
          <button
            onClick={() => {
              const next = !showConcurrency;
              setShowConcurrency(next);
              if (next && concurrencyData.length === 0 && !concurrencyLoading) fetchConcurrency();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
          >
            <Activity size={14} className="text-cyan-400 shrink-0" />
            <span className="text-sm font-semibold text-white flex-1">Scheduler Concurrency</span>
            <span className="text-[10px] text-gray-500 mr-2">Scheduled searches per minute vs. concurrency limit (last 1h)</span>
            {showConcurrency ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-500 shrink-0" />}
          </button>
          {showConcurrency && (
            <div className="border-t border-surface-border px-4 pb-4 pt-3">
              {/* SPL editor */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">SPL Query</span>
                  <div className="flex items-center gap-2">
                    <CopyButton text={concurrencySpl} />
                    <button
                      onClick={() => setEditConcurrencySpl((v) => !v)}
                      className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors"
                    >
                      {editConcurrencySpl ? "Cancel" : "Edit"}
                    </button>
                  </div>
                </div>
                {editConcurrencySpl ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={concurrencySpl}
                      onChange={(e) => setConcurrencySpl(e.target.value)}
                      rows={7}
                      className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y"
                      spellCheck={false}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { fetchConcurrency(concurrencySpl); setEditConcurrencySpl(false); }}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-brand-600 transition-colors"
                      >
                        <Play size={10} /> Run
                      </button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all">{concurrencySpl}</pre>
                )}
              </div>

              {/* Run button */}
              {!editConcurrencySpl && (
                <button
                  onClick={() => fetchConcurrency(concurrencySpl)}
                  disabled={concurrencyLoading}
                  className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {concurrencyLoading ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                  {concurrencyLoading ? "Running…" : "Run"}
                </button>
              )}

              {concurrencyError && <div className="mb-3"><ErrorAlert message={concurrencyError} /></div>}

              {concurrencyData.length > 0 && (() => {
                const categories = ["Searches Scheduled", "Max Concurrent Limit"].filter(
                  (k) => concurrencyData.some((r) => r[k] !== undefined)
                );
                return (
                  <div className="rounded-lg border border-surface-border bg-surface p-3">
                    <AreaChart
                      data={concurrencyData}
                      index="Time"
                      categories={categories}
                      colors={["cyan", "rose"]}
                      yAxisWidth={40}
                      showAnimation
                      showLegend
                      showGridLines
                      style={{ height: 260 }}
                    />
                  </div>
                );
              })()}

              {!concurrencyLoading && concurrencyData.length === 0 && !concurrencyError && (
                <p className="text-xs text-gray-500 text-center py-6">Click Run to load the concurrency chart</p>
              )}
            </div>
          )}
        </div>

        {/* Email card */}
        {showEfficiency && inefficientCount > 0 && (
          <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
            <button
              onClick={() => setShowEmailCard((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
            >
              <Mail size={14} className="text-brand-400 shrink-0" />
              <span className="text-sm font-semibold text-white flex-1">Email Template</span>
              <span className="text-[10px] text-gray-500 mr-2">Pre-canned customer communication for inefficient searches</span>
              {showEmailCard ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-500 shrink-0" />}
            </button>

            {showEmailCard && (() => {
              const stackShort = extractStackName(splunkServerName);
              const subject = stackShort
                ? `Splunk Scheduled Search Efficiency Review — Stack: ${stackShort}`
                : `Splunk Scheduled Search Efficiency Review`;
              const body = `Hello,

As part of our review of your Splunk Cloud environment, we have identified a number of scheduled searches that are operating inefficiently. Please find attached both a PDF report and CSV export of all searches identified.

What are inefficient scheduled searches?

A scheduled search is considered inefficient when its configured time window — the span between the Earliest and Latest time settings — is greater than the frequency at which the search runs (Cron Schedule). This results in each execution re-scanning data already covered by the previous run, creating unnecessary overlap and consuming additional search resources.

Why does this matter?

Inefficient searches can:
  - Increase CPU and memory load on your Search Heads and Indexers
  - Cause longer runtimes that delay other concurrent work
  - Lead to searches being skipped when concurrency limits are reached
  - Contribute to degraded search performance across the platform

Recommendation

We recommend updating the Earliest and Latest time of each affected search so the scan window aligns with the run interval, unless a broader window is specifically required by the search logic.

Example:
A search scheduled to run every 5 minutes (cron: */5 * * * *) should be configured as:
  Earliest: -5m
  Latest:   now

If that same search is currently set to Earliest: -1h / Latest: now, it is scanning 60 minutes of data on every 5-minute run — a 12x overlap — which is unnecessary and puts undue load on the platform.

We have included both a PDF report and CSV export identifying all scheduled searches flagged as inefficient based on their Frequency (Cron Schedule) and Duration (span between Earliest and Latest time). Please review the attached files and update the search configurations accordingly.
${wlmAllTimeRule ? `
Note Regarding All-Time Searches

We have also identified that a Workload Management (WLM) Admission Rule is currently active on your Search Heads that targets all-time searches (predicate: ${wlmAllTimeRule}). All-time searches identified in the attached report are being blocked or throttled by this rule. While this rule helps protect your environment from unbounded searches, we still recommend updating the time range of these searches to align with their cron interval as a permanent resolution.` : ""}
If you have any questions or need assistance making these changes, please don't hesitate to reach out.

Kindly,
Splunk Support`;

              return (
                <div className="border-t border-surface-border px-4 pb-4 pt-3 flex flex-col gap-3">
                  {/* Subject */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Subject</span>
                    <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2">
                      <span className="text-xs text-gray-200 flex-1 font-mono">{subject}</span>
                      <CopyButton text={subject} />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Body</span>
                      <CopyButton text={body} />
                    </div>
                    <pre className="rounded-lg border border-surface-border bg-surface px-4 py-3 text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed overflow-auto max-h-96 select-all">
                      {body}
                    </pre>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Scheduled Search Inefficiency Audit */}
        <LoggerPanel />
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
    | eval c_min_div=if(match(c_min, "/"), replace(c_min, "^.*/(\\d+)$", "\\1"), null())
    | eval c_mins=if(match(c_min, ","), split(c_min, ","), null())
    | eval c_min_div=if(isnotnull(c_mins), abs(tonumber(mvindex(c_mins, 1)) - tonumber(mvindex(c_mins, 0))), c_min_div)
    | eval c_hs=if(match(c_h, ","), split(c_h, ","), null())
    | eval c_h_div=case(match(c_h, "/"), replace(c_h, "^.*/(\\d+)$", "\\1"), isnotnull(c_hs), abs(tonumber(mvindex(c_hs, 1)) - tonumber(mvindex(c_hs, 0))), 1=1, null())
    | eval c_wdays=if(match(c_wday, ","), split(c_wday, ","), null())
    | eval c_wday_div=case(match(c_wday, "/"), replace(c_wday, "^.*/(\\d+)$", "\\1"), isnotnull(c_wdays), abs(tonumber(mvindex(c_wdays, 1)) - tonumber(mvindex(c_wdays, 0))), 1=1, null())
    | eval i_m=case(c_d < 29, 86400 * 28, c_d = 31, 86400 * 31, 1=1, null())
    | eval i_h=case(isnotnull(c_h_div), c_h_div * 3600, c_h = "*", null(), match(c_h, "^\\d+$"), 86400)
    | eval i_min=case(isnotnull(c_min_div), c_min_div * 60, c_min = "*", 60, match(c_min, "^\\d+$"), 3600)
    | eval i_wk=case(isnotnull(c_wday_div), c_wday_div * 86400, c_wday = "*", null(), match(c_wday, "^\\d+$"), 604800)
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
            <div className="flex items-start gap-2">
              <pre className="flex-1 text-[10px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all max-h-60 overflow-auto">{customSpl}</pre>
              <CopyButton text={customSpl} />
            </div>
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
                      <td key={col} className="px-3 py-2 text-xs font-mono text-gray-300 whitespace-nowrap" title={row[col]}>
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
