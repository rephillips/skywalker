import { useState, useCallback } from "react";
import { Stethoscope, Play, Loader2, Copy, Download, ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";

interface DiagScript {
  id: string;
  label: string;
  description: string;
  timeout: number; // ms
  buildSpl: (args: Record<string, string>) => string;
  args?: { key: string; label: string; placeholder: string; default: string }[];
}

const SCRIPTS: DiagScript[] = [
  {
    id: "pstacks",
    label: "Collect pstacks",
    description: "Runs pstack/gstack/eu-stack on every splunkd PID. Captures full thread stack traces — essential for diagnosing hangs, high CPU, and scheduler stalls.",
    timeout: 120_000,
    args: [
      { key: "process", label: "Process name", placeholder: "splunkd", default: "splunkd" },
    ],
    buildSpl: (args) => {
      const proc = args.process || "splunkd";
      return `| makeresults | eval _raw="pstacks" | script bash "PIDS=$(pgrep -d ' ' ${proc} 2>/dev/null); if [ -z \\"$PIDS\\" ]; then echo 'No ${proc} processes found'; exit 0; fi; for pid in $PIDS; do echo \\"=== PID $pid ===\\"; pstack $pid 2>/dev/null || gstack $pid 2>/dev/null || eu-stack -p $pid 2>/dev/null || echo \\"pstack/gstack/eu-stack not available on this host\\"; echo; done"`;
    },
  },
  {
    id: "thread-count",
    label: "Thread counts",
    description: "Reports the number of threads per splunkd PID and total open file descriptors. Quick check for thread exhaustion.",
    timeout: 30_000,
    buildSpl: () =>
      `| makeresults | eval _raw="threads" | script bash "echo \\"=== splunkd thread counts ===\\"; ps -eLf 2>/dev/null | grep splunkd | grep -v grep | awk '{print $2}' | sort | uniq -c | sort -rn | head -20; echo; echo \\"=== open file descriptors (main pid) ===\\"; MAINPID=$(pgrep -o splunkd 2>/dev/null); if [ -n \\"$MAINPID\\" ]; then ls /proc/$MAINPID/fd 2>/dev/null | wc -l || lsof -p $MAINPID 2>/dev/null | wc -l; fi"`,
  },
  {
    id: "disk-usage",
    label: "Splunk disk usage",
    description: "Shows disk usage for key Splunk directories: SPLUNK_HOME, var/log, var/run/splunk/dispatch.",
    timeout: 30_000,
    buildSpl: () =>
      `| makeresults | eval _raw="disk" | script bash "echo \\"=== Splunk directory sizes ===\\"; du -sh $SPLUNK_HOME 2>/dev/null; echo; du -sh $SPLUNK_HOME/var/log/splunk 2>/dev/null && echo '(log dir)'; du -sh $SPLUNK_HOME/var/run/splunk/dispatch 2>/dev/null && echo '(dispatch dir)'; echo; echo \\"=== Filesystem usage ===\\"; df -h $SPLUNK_HOME 2>/dev/null"`,
  },
  {
    id: "ulimits",
    label: "ulimits",
    description: "Shows the effective ulimits (open files, max processes, core size) for the splunkd process.",
    timeout: 15_000,
    buildSpl: () =>
      `| makeresults | eval _raw="ulimits" | script bash "MAINPID=$(pgrep -o splunkd 2>/dev/null); echo \\"=== ulimits for splunkd (PID: $MAINPID) ===\\"; if [ -n \\"$MAINPID\\" ]; then cat /proc/$MAINPID/limits 2>/dev/null || su -s /bin/sh splunk -c 'ulimit -a' 2>/dev/null || ulimit -a; fi"`,
  },
  {
    id: "scheduler-log-tail",
    label: "Tail scheduler.log",
    description: "Returns the last 200 lines of scheduler.log. Useful immediately after enabling DEBUG on SavedSplunker.",
    timeout: 20_000,
    buildSpl: () =>
      `| makeresults | eval _raw="log" | script bash "tail -200 $SPLUNK_HOME/var/log/splunk/scheduler.log 2>/dev/null || echo 'scheduler.log not found'"`,
  },
];

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScriptCard({ script }: { script: DiagScript }) {
  const [argValues, setArgValues] = useState<Record<string, string>>(
    Object.fromEntries((script.args || []).map((a) => [a.key, a.default]))
  );
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const spl = script.buildSpl(argValues);
      const res = await api.search(spl, undefined, undefined, script.timeout);
      // Script output comes back as _raw on each result row
      const lines: string[] = (res.results ?? []).map((r: any) => r._raw || "").filter(Boolean);
      setOutput(lines.join("\n") || "(no output)");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [script, argValues]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? <ChevronDown size={13} className="text-gray-500 shrink-0" /> : <ChevronRight size={13} className="text-gray-500 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{script.label}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{script.description}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-gray-600 font-mono">{script.timeout / 1000}s timeout</span>
          {loading && <Loader2 size={13} className="animate-spin text-brand-400" />}
          {!loading && output && <span className="text-[9px] text-emerald-500">✓ done</span>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-border px-4 py-3 flex flex-col gap-3">
          {/* Args */}
          {(script.args || []).length > 0 && (
            <div className="flex flex-wrap gap-3">
              {(script.args || []).map((arg) => (
                <div key={arg.key} className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-500 shrink-0">{arg.label}</label>
                  <input
                    value={argValues[arg.key] ?? arg.default}
                    onChange={(e) => setArgValues((v) => ({ ...v, [arg.key]: e.target.value }))}
                    className="w-36 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-brand-500"
                    placeholder={arg.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Run button */}
          <div>
            <button
              onClick={run}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {loading ? "Running…" : "Run"}
            </button>
          </div>

          {error && <ErrorAlert message={error} />}

          {/* Output */}
          {output && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wide text-gray-500">Output</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(output)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Copy size={11} /> Copy
                  </button>
                  <button
                    onClick={() => downloadText(output, `${script.id}-${timestamp}.txt`)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    <Download size={11} /> Download
                  </button>
                </div>
              </div>
              <pre className="text-[10px] font-mono text-gray-300 bg-surface rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all border border-surface-border leading-relaxed">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomScriptRunner() {
  const [spl, setSpl] = useState(`| makeresults | eval _raw="hello" | script bash "echo hello from $(hostname)"`);
  const [timeout, setTimeout_] = useState(60);
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await api.search(spl.trim(), undefined, undefined, timeout * 1000);
      const lines: string[] = (res.results ?? []).map((r: any) => r._raw || "").filter(Boolean);
      setOutput(lines.join("\n") || "(no output)");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl, timeout]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
        <Terminal size={14} className="text-brand-400" />
        <h3 className="text-xs font-semibold text-white">Custom SPL / Script</h3>
        <span className="text-[10px] text-gray-500">runs via POST /api/search — script bash "..." to execute shell commands</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <textarea
          value={spl}
          onChange={(e) => setSpl(e.target.value)}
          rows={5}
          spellCheck={false}
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-[11px] text-gray-100 font-mono outline-none focus:border-brand-500 resize-y"
        />
        <div className="flex items-center gap-3">
          <label className="text-[10px] text-gray-500 shrink-0">Timeout (seconds)</label>
          <input
            type="number"
            value={timeout}
            onChange={(e) => setTimeout_(Number(e.target.value))}
            min={5}
            max={300}
            className="w-20 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-gray-100 font-mono outline-none focus:border-brand-500"
          />
          <button
            onClick={run}
            disabled={loading || !spl.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {loading ? "Running…" : "Run"}
          </button>
        </div>

        {error && <ErrorAlert message={error} />}

        {output && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wide text-gray-500">Output</span>
              <div className="flex items-center gap-2">
                <button onClick={() => copyText(output)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors">
                  <Copy size={11} /> Copy
                </button>
                <button onClick={() => downloadText(output, `custom-${timestamp}.txt`)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors">
                  <Download size={11} /> Download
                </button>
              </div>
            </div>
            <pre className="text-[10px] font-mono text-gray-300 bg-surface rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all border border-surface-border leading-relaxed">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function DiagnosticsPage() {
  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Diagnostics" />
      <div className="p-6 flex flex-col gap-4 max-w-5xl">
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope size={16} className="text-brand-400" />
          <p className="text-xs text-gray-500">
            Scripts run via Splunk search jobs using <code className="font-mono text-gray-400">| script bash "..."</code>.
            Output is captured from <code className="font-mono text-gray-400">_raw</code> and streamed back.
            Changes are not persistent across Splunk restarts.
          </p>
        </div>

        {SCRIPTS.map((s) => <ScriptCard key={s.id} script={s} />)}
        <CustomScriptRunner />
      </div>
    </div>
  );
}
