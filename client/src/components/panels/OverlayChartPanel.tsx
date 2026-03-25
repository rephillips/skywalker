import { useState, useEffect, useMemo } from "react";
import { LineChart } from "@tremor/react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { api } from "../../services/api";
import { useGlobalTime } from "../../hooks/useGlobalTime";
import type { PanelConfig, OverlaySearch } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
  chartHeight?: number;
  onUpdate?: (updates: Partial<PanelConfig>) => void;
}

const NEON_COLORS = ["emerald", "cyan", "fuchsia", "yellow", "rose", "violet", "blue", "amber"];

interface OverlayData {
  label: string;
  results: SplunkResult[];
  loading: boolean;
}

export function OverlayChartPanel({ config, data, chartHeight = 300, onUpdate }: Props) {
  const overlays = config.chartOptions?.overlaySearches || [];
  const globalTime = useGlobalTime();
  const earliest = config.earliest || globalTime.earliest;
  const latest = config.latest || globalTime.latest;

  const [overlayData, setOverlayData] = useState<OverlayData[]>([]);
  const [editing, setEditing] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSpl, setNewSpl] = useState("");

  // Fetch overlay search results
  useEffect(() => {
    if (overlays.length === 0) {
      setOverlayData([]);
      return;
    }

    setOverlayData(overlays.map((o) => ({ label: o.label, results: [], loading: true })));

    overlays.forEach((overlay, i) => {
      api.search(overlay.spl, earliest, latest).then((res) => {
        setOverlayData((prev) => {
          const next = [...prev];
          if (next[i]) {
            next[i] = { label: overlay.label, results: res.results || [], loading: false };
          }
          return next;
        });
      }).catch(() => {
        setOverlayData((prev) => {
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], loading: false };
          return next;
        });
      });
    });
  }, [overlays.map((o) => o.spl).join("|"), earliest, latest]);

  // Normalize ISO timestamp to minute-level key for merging
  function normalizeTime(t: string): string {
    try {
      const d = new Date(t);
      // Round to nearest minute for reliable matching
      d.setSeconds(0, 0);
      return d.toISOString();
    } catch {
      return t;
    }
  }

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  // Merge primary data with overlay data into one chart dataset
  const { chartData, categories } = useMemo(() => {
    const index = "_time";
    const timeMap = new Map<string, Record<string, string | number>>();

    // Collect all category names first
    const primaryKeys = data.length > 0
      ? Object.keys(data[0]).filter((k) => k !== index && !k.startsWith("_"))
      : [];

    const overlayCategories: string[] = [];
    overlayData.forEach((od) => {
      if (od.results.length === 0) return;
      Object.keys(od.results[0])
        .filter((k) => k !== index && !k.startsWith("_"))
        .forEach((k) => {
          const label = od.label ? `${od.label}: ${k}` : k;
          if (!overlayCategories.includes(label)) overlayCategories.push(label);
        });
    });

    const allCategories = [...primaryKeys, ...overlayCategories];

    // Add primary data
    data.forEach((row) => {
      const key = normalizeTime(row[index]);
      const point: Record<string, string | number> = { [index]: key };
      allCategories.forEach((c) => { point[c] = 0; });
      primaryKeys.forEach((k) => { point[k] = Number(row[k]) || 0; });
      timeMap.set(key, point);
    });

    // Merge overlay data
    overlayData.forEach((od) => {
      if (od.results.length === 0) return;
      const oKeys = Object.keys(od.results[0]).filter((k) => k !== index && !k.startsWith("_"));

      od.results.forEach((row) => {
        const key = normalizeTime(row[index]);
        const existing = timeMap.get(key) || (() => {
          const point: Record<string, string | number> = { [index]: key };
          allCategories.forEach((c) => { point[c] = 0; });
          return point;
        })();
        oKeys.forEach((k) => {
          const label = od.label ? `${od.label}: ${k}` : k;
          existing[label] = Number(row[k]) || 0;
        });
        timeMap.set(key, existing);
      });
    });

    // Sort by time and format display labels
    const sorted = Array.from(timeMap.values())
      .sort((a, b) => String(a[index]).localeCompare(String(b[index])))
      .map((point) => ({
        ...point,
        [index]: formatTime(String(point[index])),
      }));

    return { chartData: sorted, categories: allCategories };
  }, [data, overlayData]);

  const anyLoading = overlayData.some((o) => o.loading);

  console.log("[Overlay] categories:", categories, "rows:", chartData.length, "overlays:", overlayData.map((o) => `${o.label}: ${o.results.length} rows`));

  function addOverlay() {
    if (!newSpl.trim() || !onUpdate) return;
    const next: OverlaySearch[] = [
      ...overlays,
      { id: `overlay-${Date.now()}`, label: newLabel || `Overlay ${overlays.length + 1}`, spl: newSpl },
    ];
    onUpdate({ chartOptions: { ...config.chartOptions, overlaySearches: next } });
    setNewLabel("");
    setNewSpl("");
  }

  function removeOverlay(id: string) {
    if (!onUpdate) return;
    onUpdate({
      chartOptions: {
        ...config.chartOptions,
        overlaySearches: overlays.filter((o) => o.id !== id),
      },
    });
  }

  return (
    <div style={{ height: chartHeight }}>
      {/* Overlay controls */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-gray-500">{categories.length} series</span>
        {anyLoading && <Loader2 size={10} className="animate-spin text-gray-500" />}
        {overlays.length > 0 && (
          <span className="text-[10px] text-brand-400">{overlays.length} overlay{overlays.length !== 1 && "s"}</span>
        )}
        {onUpdate && (
          <button
            onClick={() => setEditing(!editing)}
            className="text-[10px] text-gray-500 hover:text-gray-300 ml-auto transition-colors"
          >
            {editing ? "Done" : "+ Add overlay search"}
          </button>
        )}
      </div>

      {/* Add overlay form */}
      {editing && onUpdate && (
        <div className="flex flex-col gap-1.5 mb-2 p-2 rounded-lg border border-surface-border bg-surface">
          {overlays.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-[10px]">
              <span className="text-gray-300 w-20 truncate">{o.label}</span>
              <span className="text-gray-500 font-mono flex-1 truncate">{o.spl}</span>
              <button onClick={() => removeOverlay(o.id)} className="text-red-400 hover:text-red-300"><Trash2 size={10} /></button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-24 rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 text-[10px] text-gray-300 outline-none"
              placeholder="Label"
            />
            <input
              value={newSpl}
              onChange={(e) => setNewSpl(e.target.value)}
              className="flex-1 rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-gray-300 outline-none"
              placeholder="SPL query for overlay"
              onKeyDown={(e) => e.key === "Enter" && addOverlay()}
            />
            <button
              onClick={addOverlay}
              disabled={!newSpl.trim()}
              className="rounded bg-brand-500 px-2 py-0.5 text-[10px] text-white disabled:opacity-50"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Chart */}
      {categories.length > 0 ? (
        <LineChart
          data={chartData}
          index="_time"
          categories={categories}
          colors={NEON_COLORS.slice(0, categories.length)}
          yAxisWidth={48}
          showAnimation
          showLegend
          style={{ height: chartHeight - (editing ? 100 : 30), width: "100%" }}
        />
      ) : (
        <p className="text-xs text-gray-500 py-4 text-center">No data to display</p>
      )}
    </div>
  );
}
