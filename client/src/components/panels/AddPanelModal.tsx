import { useState } from "react";
import { X } from "lucide-react";
import type { PanelConfig, VizType } from "../../types/dashboard";

interface Props {
  onAdd: (panel: PanelConfig) => void;
  onClose: () => void;
}

const TIME_PRESETS = [
  { label: "Last 15 min", value: "-15m" },
  { label: "Last 1 hour", value: "-1h" },
  { label: "Last 4 hours", value: "-4h" },
  { label: "Last 24 hours", value: "-24h" },
  { label: "Last 7 days", value: "-7d" },
];

const CHART_TYPES: { label: string; value: VizType }[] = [
  { label: "Line Chart", value: "line" },
  { label: "Area Chart", value: "area" },
  { label: "Bar Chart", value: "bar" },
  { label: "Table", value: "table" },
  { label: "KPI Card", value: "kpi" },
];

const SPAN_OPTIONS = [
  { label: "Quarter width", value: 1 },
  { label: "Half width", value: 2 },
  { label: "Three quarters", value: 3 },
  { label: "Full width", value: 4 },
];

export function AddPanelModal({ onAdd, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [spl, setSpl] = useState("index=_internal | timechart span=1m count by host");
  const [vizType, setVizType] = useState<VizType>("line");
  const [earliest, setEarliest] = useState("-1h");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [span, setSpan] = useState(4);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const panel: PanelConfig = {
      id: `custom-${Date.now()}`,
      title: title || "Untitled Panel",
      spl,
      vizType,
      earliest,
      latest: "now",
      refreshInterval,
      span: span as 1 | 2 | 3 | 4,
      height: vizType === "kpi" ? "sm" : "md",
    };
    onAdd(panel);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-surface-border bg-surface-raised p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Add Dashboard Panel</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <label>
            <span className="text-sm font-medium text-gray-300 mb-1.5 block">Panel Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors"
              placeholder="Events by Host"
            />
          </label>

          {/* SPL Query */}
          <label>
            <span className="text-sm font-medium text-gray-300 mb-1.5 block">SPL Query</span>
            <textarea
              value={spl}
              onChange={(e) => setSpl(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 font-mono outline-none focus:border-brand-500 transition-colors resize-none"
              placeholder="index=_internal | timechart span=1m count by host"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-1">
              Use <code className="text-gray-400 font-mono">timechart</code> for time-series charts
            </p>
          </label>

          {/* Chart type + Time range */}
          <div className="flex gap-4">
            <label className="flex-1">
              <span className="text-sm font-medium text-gray-300 mb-1.5 block">Visualization</span>
              <select
                value={vizType}
                onChange={(e) => setVizType(e.target.value as VizType)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500"
              >
                {CHART_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="text-sm font-medium text-gray-300 mb-1.5 block">Time Range</span>
              <select
                value={earliest}
                onChange={(e) => setEarliest(e.target.value)}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500"
              >
                {TIME_PRESETS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Width + Refresh */}
          <div className="flex gap-4">
            <label className="flex-1">
              <span className="text-sm font-medium text-gray-300 mb-1.5 block">Panel Width</span>
              <select
                value={span}
                onChange={(e) => setSpan(Number(e.target.value))}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500"
              >
                {SPAN_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="text-sm font-medium text-gray-300 mb-1.5 block">Refresh (seconds)</span>
              <input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                min={0}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-brand-500 transition-colors"
                placeholder="30"
              />
              <p className="text-xs text-gray-500 mt-1">0 = no auto-refresh</p>
            </label>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-gray-300 hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!spl.trim()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              Add Panel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
