import { useState, useEffect } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { api } from "../../services/api";

interface Props {
  sid: string;
}

interface ExecCost {
  component: string;
  duration: number;
  invocations: number;
  inputCount: number;
  outputCount: number;
}

export function JobInspector({ sid }: Props) {
  const [job, setJob] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllProps, setShowAllProps] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.proxy(`search/v2/jobs/${encodeURIComponent(sid)}`).then((res) => {
      if (res.status === "ok" && res.data?.entry?.[0]?.content) {
        setJob(res.data.entry[0].content);
      } else {
        setError(res.message || "Failed to load job");
      }
    }).catch((err) => {
      setError((err as Error).message);
    }).finally(() => setLoading(false));
  }, [sid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-brand-400" />
      </div>
    );
  }

  if (error || !job) {
    return <p className="text-xs text-red-400 py-4">{error || "No job data"}</p>;
  }

  // Parse execution costs from performance field
  const execCosts: ExecCost[] = [];
  if (job.performance) {
    const perf = typeof job.performance === "string" ? {} : job.performance;
    // performance.command.search, performance.command.timechart, etc.
    function walkPerf(obj: any, prefix: string) {
      if (!obj || typeof obj !== "object") return;
      Object.entries(obj).forEach(([key, val]: [string, any]) => {
        if (val && typeof val === "object" && "duration_secs" in val) {
          execCosts.push({
            component: prefix ? `${prefix}.${key}` : key,
            duration: Number(val.duration_secs) || 0,
            invocations: Number(val.invocations) || 0,
            inputCount: Number(val.input_count) || 0,
            outputCount: Number(val.output_count) || 0,
          });
        }
        if (val && typeof val === "object" && !("duration_secs" in val)) {
          walkPerf(val, prefix ? `${prefix}.${key}` : key);
        }
      });
    }
    walkPerf(perf, "");
  }
  execCosts.sort((a, b) => b.duration - a.duration);

  const statusColor = job.dispatchState === "DONE" ? "text-emerald-400"
    : job.dispatchState === "FAILED" ? "text-red-400"
    : "text-yellow-400";

  const scanRate = job.runDuration > 0
    ? Math.round(job.scanCount / job.runDuration)
    : 0;

  // Key properties
  const keyProps = [
    { label: "SID", value: sid },
    { label: "Status", value: job.dispatchState, color: statusColor },
    { label: "Run Duration", value: job.runDuration ? `${Number(job.runDuration).toFixed(3)}s` : "—" },
    { label: "Scan Count", value: job.scanCount?.toLocaleString() },
    { label: "Event Count", value: job.eventCount?.toLocaleString() },
    { label: "Result Count", value: job.resultCount?.toLocaleString() },
    { label: "Scan Rate", value: `${scanRate.toLocaleString()} events/sec`, color: scanRate > 10000 ? "text-emerald-400" : scanRate > 1000 ? "text-yellow-400" : "text-red-400" },
    { label: "Disk Usage", value: job.diskUsage ? `${(job.diskUsage / 1024).toFixed(1)} KB` : "—" },
    { label: "Priority", value: job.priority },
    { label: "TTL", value: job.ttl ? `${job.ttl}s` : "—" },
    { label: "Is Saved", value: job.isSaved ? "Yes" : "No" },
    { label: "Is Zombie", value: job.isZombie ? "Yes" : "No" },
    { label: "Is Finalized", value: job.isFinalized ? "Yes" : "No" },
    { label: "Earliest", value: job.earliestTime || "—" },
    { label: "Latest", value: job.latestTime || "—" },
    { label: "Search Mode", value: job.reportSearch ? "Report" : "Event" },
    { label: "Events Truncated", value: job.eventIsTruncated ? "Yes" : "No" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        <span className={`font-semibold ${statusColor}`}>{job.dispatchState}</span>
        <span className="text-gray-400">{Number(job.runDuration).toFixed(3)}s</span>
        <span className="text-gray-400">{job.resultCount?.toLocaleString()} results</span>
        <span className="text-gray-400">{scanRate.toLocaleString()} events/sec</span>
      </div>

      {/* Search string */}
      <div>
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">Search Query</span>
        <pre className="text-[11px] font-mono text-emerald-400/80 bg-surface rounded-lg border border-surface-border p-2.5 whitespace-pre-wrap break-all">
          {job.search || job.eventSearch || "—"}
        </pre>
      </div>

      {/* Optimized search (if different) */}
      {job.optimizedSearch && job.optimizedSearch !== job.search && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">Optimized Search</span>
          <pre className="text-[11px] font-mono text-cyan-400/80 bg-surface rounded-lg border border-surface-border p-2.5 whitespace-pre-wrap break-all">
            {job.optimizedSearch}
          </pre>
        </div>
      )}

      {/* Execution Costs */}
      {execCosts.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">
            Execution Costs ({execCosts.length} components)
          </span>
          <div className="rounded-lg border border-surface-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-surface border-b border-surface-border">
                  <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase">Duration</th>
                  <th className="text-left px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase">Component</th>
                  <th className="text-right px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase">Invocations</th>
                  <th className="text-right px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase">Input</th>
                  <th className="text-right px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase">Output</th>
                </tr>
              </thead>
              <tbody>
                {execCosts.map((cost) => {
                  const maxDuration = execCosts[0]?.duration || 1;
                  const pct = (cost.duration / maxDuration) * 100;
                  return (
                    <tr key={cost.component} className="border-b border-surface-border/30 hover:bg-surface-hover/50">
                      <td className="px-3 py-1 font-mono text-gray-300 relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-brand-500/10"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative">{cost.duration.toFixed(4)}s</span>
                      </td>
                      <td className="px-3 py-1 font-mono text-gray-200">{cost.component}</td>
                      <td className="px-3 py-1 font-mono text-gray-400 text-right">{cost.invocations}</td>
                      <td className="px-3 py-1 font-mono text-gray-400 text-right">{cost.inputCount.toLocaleString()}</td>
                      <td className="px-3 py-1 font-mono text-gray-400 text-right">{cost.outputCount.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search Job Properties */}
      <div>
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">Search Job Properties</span>
        <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 rounded-lg border border-surface-border bg-surface p-3">
          {keyProps.map((p) => (
            <div key={p.label}>
              <span className="text-[9px] text-gray-500 uppercase tracking-wide">{p.label}</span>
              <div className={`text-[11px] font-mono ${p.color || "text-gray-300"} truncate`} title={String(p.value)}>
                {p.value ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Properties (expandable) */}
      <button
        onClick={() => setShowAllProps(!showAllProps)}
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ChevronDown size={12} className={clsx("transition-transform", showAllProps && "rotate-180")} />
        {showAllProps ? "Hide" : "Show"} all {Object.keys(job).length} properties
      </button>
      {showAllProps && (
        <div className="rounded-lg border border-surface-border bg-surface p-2 max-h-60 overflow-auto">
          <table className="w-full text-[10px]">
            <tbody>
              {Object.entries(job)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <tr key={key} className="border-b border-surface-border/20">
                    <td className="px-2 py-0.5 font-mono text-gray-500 whitespace-nowrap align-top">{key}</td>
                    <td className="px-2 py-0.5 font-mono text-gray-300 break-all">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
