import { useState, useCallback, useRef } from "react";
import { RefreshCw, Trash2, GripVertical, Pencil, Check, X, LineChart as LineIcon, BarChart3, AreaChart as AreaIcon, Table2, Hash, Rows3 } from "lucide-react";
import type { PanelConfig } from "../../types/dashboard";
import { useSplunkSearch } from "../../hooks/useSplunkSearch";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ErrorAlert } from "../common/ErrorAlert";
import { LineChartPanel } from "./LineChartPanel";
import { BarChartPanel } from "./BarChartPanel";
import { KpiCard } from "./KpiCard";
import { TablePanel } from "./TablePanel";
import { SwimLanePanel } from "./SwimLanePanel";
import { StatusDotsPanel } from "./StatusDotsPanel";

interface Props {
  config: PanelConfig;
  onRemove?: () => void;
  onUpdate?: (updates: Partial<PanelConfig>) => void;
  dragHandleProps?: Record<string, any>;
}

const DEFAULT_HEIGHT = 400;

export function DashboardPanel({ config, onRemove, onUpdate, dragHandleProps }: Props) {
  const [editing, setEditing] = useState(false);
  const [editSpl, setEditSpl] = useState(config.spl);
  const [editTitle, setEditTitle] = useState(config.title);
  const [editVizType, setEditVizType] = useState(config.vizType);
  const [editEarliest, setEditEarliest] = useState(config.earliest || "-1h");
  const [editRefresh, setEditRefresh] = useState(config.refreshInterval || 0);

  const { data, loading, error, sid, refetch } = useSplunkSearch(config.spl, {
    earliest: config.earliest,
    latest: config.latest,
    refreshInterval: config.refreshInterval,
  });

  const [height, setHeight] = useState(config.pixelHeight || DEFAULT_HEIGHT);
  const [width, setWidth] = useState<number | null>(config.pixelWidth || null);
  const containerRef = useRef<HTMLDivElement>(null);

  const saveSize = useCallback((h: number, w: number | null) => {
    if (onUpdate) {
      onUpdate({ pixelHeight: h, pixelWidth: w || undefined });
    }
  }, [onUpdate]);

  const onResizeYStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;

    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(200, startH + (ev.clientY - startY)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setHeight((h) => { saveSize(h, width); return h; });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height, width, saveSize]);

  const onResizeXStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = containerRef.current?.offsetWidth || 600;

    const onMove = (ev: MouseEvent) => {
      setWidth(Math.max(300, startW + (ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setWidth((w) => { saveSize(height, w); return w; });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height, saveSize]);

  const onResizeCornerStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = height;
    const startW = containerRef.current?.offsetWidth || 600;

    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(200, startH + (ev.clientY - startY)));
      setWidth(Math.max(300, startW + (ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setHeight((h) => {
        setWidth((w) => { saveSize(h, w); return w; });
        return h;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height, saveSize]);

  const chartHeight = height - (editing ? 170 : 90);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col"
      style={{ height, width: width ?? "100%" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition-colors"
            >
              <GripVertical size={14} />
            </div>
          )}
          {editing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-sm font-medium text-gray-100 bg-surface border border-surface-border rounded px-2 py-0.5 outline-none focus:border-brand-500"
              autoFocus
            />
          ) : (
            <h3 className="text-sm font-medium text-gray-300">{config.title}</h3>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={() => {
                  if (onUpdate) {
                    onUpdate({
                      spl: editSpl,
                      title: editTitle,
                      vizType: editVizType,
                      earliest: editEarliest,
                      refreshInterval: editRefresh,
                    });
                  }
                  setEditing(false);
                }}
                className="rounded-md p-1 text-emerald-400 hover:bg-surface-hover transition-colors"
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => {
                  setEditSpl(config.spl);
                  setEditTitle(config.title);
                  setEditVizType(config.vizType);
                  setEditEarliest(config.earliest || "-1h");
                  setEditRefresh(config.refreshInterval || 0);
                  setEditing(false);
                }}
                className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              {onUpdate && (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
                  title="Edit panel"
                >
                  <Pencil size={14} />
                </button>
              )}
              <button
                onClick={refetch}
                className="rounded-md p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              {onRemove && (
                <button
                  onClick={onRemove}
                  className="rounded-md p-1 text-gray-500 hover:text-red-400 hover:bg-surface-hover transition-colors"
                  title="Remove panel"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="mb-2 shrink-0 flex flex-col gap-2">
          <textarea
            value={editSpl}
            onChange={(e) => setEditSpl(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-gray-100 font-mono outline-none focus:border-brand-500 resize-none"
            spellCheck={false}
            placeholder="index=_internal | timechart span=1m count by host"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 mr-1">Chart:</span>
              {([
                { type: "line", icon: LineIcon },
                { type: "area", icon: AreaIcon },
                { type: "bar", icon: BarChart3 },
                { type: "swimlane", icon: Rows3 },
                { type: "table", icon: Table2 },
                { type: "kpi", icon: Hash },
              ] as const).map(({ type, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setEditVizType(type)}
                  className={`rounded p-1 transition-colors ${
                    editVizType === type
                      ? "bg-brand-500/15 text-brand-400"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                  title={type}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Time:</span>
              <select
                value={editEarliest}
                onChange={(e) => setEditEarliest(e.target.value)}
                className="rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[10px] text-gray-300 outline-none"
              >
                <option value="-15m">15m</option>
                <option value="-1h">1h</option>
                <option value="-4h">4h</option>
                <option value="-24h">24h</option>
                <option value="-7d">7d</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Refresh:</span>
              <input
                type="number"
                value={editRefresh}
                onChange={(e) => setEditRefresh(Number(e.target.value))}
                min={0}
                className="w-12 rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[10px] text-gray-300 outline-none"
              />
              <span className="text-[10px] text-gray-600">sec</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ height: chartHeight }}>
        {config.vizType === "donut" ? (
          <StatusDotsPanel
            dots={config.chartOptions?.statusDots || [
              { id: "default", label: "Status", spl: config.spl, thresholds: { green: 100, yellow: 500, orange: 1000 } },
            ]}
            onUpdateDots={onUpdate ? (dots) => onUpdate({
              chartOptions: { ...config.chartOptions, statusDots: dots },
            }) : undefined}
          />
        ) : loading && !data ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : data && data.length > 0 ? (
          <VizSwitch config={config} data={data} chartHeight={chartHeight} />
        ) : data && data.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No results returned</p>
        ) : null}
      </div>

      {/* SID footer */}
      {sid && (
        <div className="shrink-0 pt-1">
          <span className="text-[10px] font-mono text-gray-600">SID: {sid}</span>
        </div>
      )}

      {/* Bottom resize handle */}
      <div
        onMouseDown={onResizeYStart}
        className="absolute bottom-0 left-0 right-4 h-2 cursor-ns-resize flex items-center justify-center group"
      >
        <div className="w-16 h-1 rounded-full bg-surface-border group-hover:bg-gray-500 transition-colors" />
      </div>

      {/* Right resize handle */}
      <div
        onMouseDown={onResizeXStart}
        className="absolute top-0 right-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center group"
      >
        <div className="h-20 w-1.5 rounded-full bg-surface-border group-hover:bg-brand-400 transition-colors" />
      </div>

      {/* Corner resize handle */}
      <div
        onMouseDown={onResizeCornerStart}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize group z-10"
      >
        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-surface-border group-hover:border-brand-400 transition-colors rounded-br-sm" />
      </div>
    </div>
  );
}

function VizSwitch({
  config,
  data,
  chartHeight,
}: {
  config: PanelConfig;
  data: NonNullable<ReturnType<typeof useSplunkSearch>["data"]>;
  chartHeight: number;
}) {
  switch (config.vizType) {
    case "line":
    case "area":
      return <LineChartPanel config={config} data={data} chartHeight={chartHeight} />;
    case "bar":
      return <BarChartPanel config={config} data={data} chartHeight={chartHeight} />;
    case "swimlane":
      return <SwimLanePanel config={config} data={data} chartHeight={chartHeight} />;
    case "donut":
      return null; // Status dots rendered separately
    case "kpi":
      return <KpiCard config={config} data={data} />;
    case "table":
      return <TablePanel config={config} data={data} />;
    default:
      return <p className="text-sm text-gray-500">Unknown viz type: {config.vizType}</p>;
  }
}
