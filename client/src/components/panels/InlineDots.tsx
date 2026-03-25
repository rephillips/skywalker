import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../services/api";
import type { StatusDot } from "../../types/dashboard";

interface Props {
  dots: StatusDot[];
  onUpdate?: (dots: StatusDot[]) => void;
}

function getColor(value: number, t: StatusDot["thresholds"]): string {
  if (value <= t.green) return "#10b981";
  if (value <= t.yellow) return "#eab308";
  if (value <= t.orange) return "#f97316";
  return "#ef4444";
}

function Dot({ dot, onRemove }: { dot: StatusDot; onRemove?: () => void }) {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (!dot.spl) return;
    api.search(dot.spl).then((res) => {
      if (res.results?.[0]) {
        const keys = Object.keys(res.results[0]).filter((k) => !k.startsWith("_"));
        setValue(Number(res.results[0][keys[0]]) || 0);
      }
    }).catch(() => {});
  }, [dot.spl]);

  const color = value !== null ? getColor(value, dot.thresholds) : "#6b7280";

  return (
    <div className="group relative flex items-center gap-1">
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}80` }}
      />
      <span className="text-[9px] text-gray-500 whitespace-nowrap">
        {dot.label}{value !== null ? `: ${value}` : ""}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="hidden group-hover:flex items-center justify-center w-3 h-3 rounded-full bg-red-500/20 text-red-400"
        >
          <X size={8} />
        </button>
      )}
    </div>
  );
}

export function InlineDots({ dots, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSpl, setNewSpl] = useState("");

  function addDot() {
    if (!newSpl.trim() || !onUpdate) return;
    onUpdate([...dots, {
      id: `idot-${Date.now()}`,
      label: newLabel || "Status",
      spl: newSpl,
      thresholds: { green: 100, yellow: 500, orange: 1000 },
    }]);
    setNewLabel("");
    setNewSpl("");
    setAdding(false);
  }

  if (dots.length === 0 && !onUpdate) return null;

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-1 shrink-0">
      {dots.map((dot, i) => (
        <Dot
          key={dot.id}
          dot={dot}
          onRemove={onUpdate ? () => onUpdate(dots.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      {onUpdate && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-600 hover:text-gray-400 hover:border-gray-400 transition-colors"
          title="Add status dot"
        >
          <Plus size={7} />
        </button>
      )}
      {adding && (
        <div className="flex items-center gap-1">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-16 rounded border border-surface-border bg-surface px-1 py-0.5 text-[9px] text-gray-300 outline-none"
            placeholder="Label"
            autoFocus
          />
          <input
            value={newSpl}
            onChange={(e) => setNewSpl(e.target.value)}
            className="w-40 rounded border border-surface-border bg-surface px-1 py-0.5 text-[9px] font-mono text-gray-300 outline-none"
            placeholder="SPL query"
            onKeyDown={(e) => e.key === "Enter" && addDot()}
          />
          <button onClick={addDot} className="text-emerald-400 text-[9px]">Add</button>
          <button onClick={() => setAdding(false)} className="text-gray-500 text-[9px]">Cancel</button>
        </div>
      )}
    </div>
  );
}
