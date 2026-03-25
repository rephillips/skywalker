import { useState, useEffect } from "react";
import { api } from "../../services/api";

interface Props {
  spl: string;
  thresholds: { green: number; yellow: number; orange: number };
}

function getColor(value: number, t: Props["thresholds"]): string {
  if (value <= t.green) return "#10b981";
  if (value <= t.yellow) return "#eab308";
  if (value <= t.orange) return "#f97316";
  return "#ef4444";
}

export function StatusIndicator({ spl, thresholds }: Props) {
  const [value, setValue] = useState<number | null>(null);
  const [color, setColor] = useState("#6b7280");

  useEffect(() => {
    if (!spl) return;
    api.search(spl).then((res) => {
      if (res.results?.[0]) {
        const keys = Object.keys(res.results[0]).filter((k) => !k.startsWith("_"));
        const val = Number(res.results[0][keys[0]]) || 0;
        setValue(val);
        setColor(getColor(val, thresholds));
      }
    }).catch(() => {});
  }, [spl, thresholds]);

  return (
    <div
      className="w-3 h-3 rounded-full shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}80`,
      }}
      title={value !== null ? `Status: ${value.toLocaleString()}` : "Loading..."}
    />
  );
}
