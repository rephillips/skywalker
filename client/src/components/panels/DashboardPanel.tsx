import { useState, useCallback, useRef } from "react";
import { RefreshCw, Trash2, GripVertical } from "lucide-react";
import type { PanelConfig } from "../../types/dashboard";
import { useSplunkSearch } from "../../hooks/useSplunkSearch";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ErrorAlert } from "../common/ErrorAlert";
import { LineChartPanel } from "./LineChartPanel";
import { BarChartPanel } from "./BarChartPanel";
import { KpiCard } from "./KpiCard";
import { TablePanel } from "./TablePanel";

interface Props {
  config: PanelConfig;
  onRemove?: () => void;
  dragHandleProps?: Record<string, any>;
}

export function DashboardPanel({ config, onRemove, dragHandleProps }: Props) {
  const { data, loading, error, refetch } = useSplunkSearch(config.spl, {
    earliest: config.earliest,
    latest: config.latest,
    refreshInterval: config.refreshInterval,
  });

  const [height, setHeight] = useState(
    config.height === "sm" ? 250 : config.height === "lg" ? 550 : 400
  );
  const [widthPct, setWidthPct] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizingY = useRef(false);
  const resizingX = useRef(false);
  const startPos = useRef(0);
  const startVal = useRef(0);

  const onResizeYStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingY.current = true;
    startPos.current = e.clientY;
    startVal.current = height;

    const onMove = (ev: MouseEvent) => {
      if (!resizingY.current) return;
      setHeight(Math.max(200, startVal.current + (ev.clientY - startPos.current)));
    };
    const onUp = () => {
      resizingY.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height]);

  const onResizeXStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingX.current = true;
    startPos.current = e.clientX;
    startVal.current = widthPct;
    const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;

    const onMove = (ev: MouseEvent) => {
      if (!resizingX.current) return;
      const deltaX = ev.clientX - startPos.current;
      const deltaPct = (deltaX / parentWidth) * 100;
      setWidthPct(Math.max(25, Math.min(100, startVal.current + deltaPct)));
    };
    const onUp = () => {
      resizingX.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [widthPct]);

  const onResizeCornerStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startYPos = e.clientY;
    const startH = height;
    const startW = widthPct;
    const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;

    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(200, startH + (ev.clientY - startYPos)));
      const deltaPct = ((ev.clientX - startX) / parentWidth) * 100;
      setWidthPct(Math.max(25, Math.min(100, startW + deltaPct)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height, widthPct]);

  const chartHeight = height - 90;

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col"
      style={{ height, width: `${widthPct}%` }}
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
          <h3 className="text-sm font-medium text-gray-300">{config.title}</h3>
        </div>
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      {/* Content */}
      <div style={{ height: chartHeight }}>
        {loading && !data ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : data && data.length > 0 ? (
          <VizSwitch config={config} data={data} chartHeight={chartHeight} />
        ) : data && data.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No results returned</p>
        ) : null}
      </div>

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
        className="absolute top-4 right-0 bottom-4 w-2 cursor-ew-resize flex items-center justify-center group"
      >
        <div className="h-16 w-1 rounded-full bg-surface-border group-hover:bg-gray-500 transition-colors" />
      </div>

      {/* Corner resize handle */}
      <div
        onMouseDown={onResizeCornerStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group"
      >
        <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-surface-border group-hover:border-gray-500 transition-colors" />
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
    case "kpi":
      return <KpiCard config={config} data={data} />;
    case "table":
      return <TablePanel config={config} data={data} />;
    default:
      return <p className="text-sm text-gray-500">Unknown viz type: {config.vizType}</p>;
  }
}
