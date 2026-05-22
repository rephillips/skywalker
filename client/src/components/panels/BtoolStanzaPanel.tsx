import { useState, useEffect, useCallback } from "react";
import { FileText, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { api } from "../../services/api";
import { ErrorAlert } from "../common/ErrorAlert";
import { parseBtoolRows, type BtoolRow } from "../../utils/btool";

const PREVIEW_ROWS = 25;

interface Props {
  conf: string;
  stanza: string;
  headerLabel: string;
  headerKey?: string;
  descriptions?: Record<string, string>;
}

export function BtoolStanzaPanel({ conf, stanza, headerLabel, headerKey, descriptions }: Props) {
  const spl = `| btool ${conf} list ${stanza} splunk_server=local`;

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showRaw, setShowRaw]   = useState(false);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.search(spl);
      setRawRows(res.results ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl]);

  useEffect(() => { load(); }, [load]);

  const rows = parseBtoolRows(rawRows, stanza);
  const headerValue = headerKey
    ? rows.find(r => r.content.startsWith(`${headerKey} =`))
        ?.content.replace(`${headerKey} =`, "").trim() ?? null
    : null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-surface-raised mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-brand-400" />
            <h3 className="text-xs font-semibold text-white">
              {headerLabel}
              {headerValue && <span className="text-brand-300 font-mono">: {headerValue}</span>}
            </h3>
          </div>
          <code className="text-[10px] font-mono text-emerald-400/60 pl-5">{spl}</code>
        </div>
        <div className="flex items-center gap-3">
          {rawRows.length > 0 && (
            <button onClick={() => setShowRaw(s => !s)}
              className="text-[10px] text-brand-400 hover:text-brand-50 transition-colors">
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
          {(() => {
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
                <div key={group.stanza} className="px-6 pt-4 pb-3 overflow-x-auto">
                  <div className="font-mono text-xs leading-5">
                    {visible.map((row, i) => (
                      <div key={i} className="flex whitespace-nowrap gap-6">
                        <span className="text-gray-400 shrink-0 min-w-[480px]">{row.file}</span>
                        <span className={
                          row.isStanza ? "text-emerald-400/80"
                          : headerKey && row.content.startsWith(`${headerKey} =`) ? "text-brand-300"
                          : "text-gray-100"
                        }>
                          {row.content}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1">
                    {!isExpanded && hidden > 0 && (
                      <button
                        onClick={() => setExpanded(s => new Set([...s, group.stanza]))}
                        className="text-xs text-brand-400 hover:text-brand-200 transition-colors">
                        Show {hidden} more
                      </button>
                    )}
                    {isExpanded && (
                      <button
                        onClick={() => setExpanded(s => { const n = new Set(s); n.delete(group.stanza); return n; })}
                        className="text-xs text-brand-400 hover:text-brand-200 transition-colors">
                        Collapse
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {headerValue && descriptions?.[headerValue] && (
            <div className="px-6 pb-3 text-[11px] text-gray-500">
              {descriptions[headerValue]}
            </div>
          )}
        </>
      )}

      {showRaw && rawRows.length > 0 && (
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
    </div>
  );
}
