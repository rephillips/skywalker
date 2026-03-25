import { useState, useCallback, useRef } from "react";
import { RefreshCw, Trash2, GripVertical } from "lucide-react";
import clsx from "clsx";
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
    config.height === "sm" ? 180 : config.height === "lg" ? 450 : 320
  );
  const resizing = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startY.current = e.clientY;
    startH.current = height;

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientY - startY.current;
      setHeight(Math.max(150, startH.current + delta));
    };

    const onUp = () => {
      resizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height]);

  return (
    <div
      className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col"
      style={{ height }}
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
      <div className="flex-1 min-h-0">
        {loading && !data ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorAlert message={error} />
        ) : data && data.length > 0 ? (
          <VizSwitch config={config} data={data} />
        ) : data && data.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No results returned</p>
        ) : null}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="h-2 shrink-0 cursor-ns-resize flex items-center justify-center group mt-1"
      >
        <div className="w-12 h-1 rounded-full bg-surface-border group-hover:bg-gray-500 transition-colors" />
      </div>
    </div>
  );
}

function VizSwitch({
  config,
  data,
}: {
  config: PanelConfig;
  data: NonNullable<ReturnType<typeof useSplunkSearch>["data"]>;
}) {
  switch (config.vizType) {
    case "line":
    case "area":
      return <LineChartPanel config={config} data={data} />;
    case "bar":
      return <BarChartPanel config={config} data={data} />;
    case "kpi":
      return <KpiCard config={config} data={data} />;
    case "table":
      return <TablePanel config={config} data={data} />;
    default:
      return <p className="text-sm text-gray-500">Unknown viz type: {config.vizType}</p>;
  }
}
