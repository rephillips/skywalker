import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Play, Search } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { api } from "../services/api";
import { ErrorAlert } from "../components/common/ErrorAlert";
import type { SplunkResult } from "../types/splunk";

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
