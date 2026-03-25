import { useState } from "react";
import { Check, X, Plus, Trash2, Grid3X3, LayoutList } from "lucide-react";
import { api } from "../../services/api";
import type { StatusDot } from "../../types/dashboard";

interface Props {
  dots: StatusDot[];
  onUpdateDots?: (dots: StatusDot[]) => void;
}

function getColor(value: number, t: StatusDot["thresholds"]): string {
  if (value <= t.green) return "#10b981";
  if (value <= t.yellow) return "#eab308";
  if (value <= t.orange) return "#f97316";
  return "#ef4444";
}

function getGlow(value: number, t: StatusDot["thresholds"]): string {
  if (value <= t.green) return "0 0 6px #10b98180";
  if (value <= t.yellow) return "0 0 6px #eab30880";
  if (value <= t.orange) return "0 0 6px #f9731680";
  return "0 0 6px #ef444480";
}

function StatusDotItem({ dot, compact, onUpdate, onRemove }: {
  dot: StatusDot;
  compact: boolean;
  onUpdate: (updates: Partial<StatusDot>) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(dot.label);
  const [editSpl, setEditSpl] = useState(dot.spl);

  useState(() => {
    if (!dot.spl) { setLoading(false); return; }
    api.search(dot.spl).then((res) => {
      if (res.results?.[0]) {
        const keys = Object.keys(res.results[0]).filter((k) => !k.startsWith("_"));
        const val = Number(res.results[0][keys[0]]) || 0;
        setValue(val);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  });

  const color = value !== null ? getColor(value, dot.thresholds) : "#6b7280";
  const glow = value !== null ? getGlow(value, dot.thresholds) : "none";

  if (editing) {
    return (
      <div className="flex flex-col gap-1 p-2 rounded-lg border border-surface-border bg-surface min-w-[200px]">
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          className="text-xs bg-transparent border border-surface-border rounded px-1.5 py-0.5 text-gray-100 outline-none"
          placeholder="Label"
          autoFocus
        />
        <input
          value={editSpl}
          onChange={(e) => setEditSpl(e.target.value)}
          className="text-[10px] font-mono bg-transparent border border-surface-border rounded px-1.5 py-0.5 text-gray-300 outline-none"
          placeholder="SPL query"
        />
        <div className="flex gap-1">
          <button onClick={() => { onUpdate({ label: editLabel, spl: editSpl }); setEditing(false); }} className="text-emerald-400 p-0.5"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="text-gray-500 p-0.5"><X size={12} /></button>
          <button onClick={onRemove} className="text-red-400 p-0.5 ml-auto"><Trash2 size={12} /></button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="rounded-full cursor-pointer transition-all hover:scale-150"
        style={{
          width: 10,
          height: 10,
          backgroundColor: color,
          boxShadow: glow,
        }}
        onClick={() => setEditing(true)}
        title={`${dot.label}: ${value ?? "..."}`}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
      <div
        className="w-6 h-6 rounded-full cursor-pointer transition-all hover:scale-110"
        style={{ backgroundColor: color, boxShadow: glow }}
        onClick={() => setEditing(true)}
        title={`${dot.label}: ${value ?? "loading..."}\nClick to edit`}
      />
      <span className="text-[10px] text-gray-400 text-center leading-tight">{dot.label}</span>
      {value !== null && (
        <span className="text-[11px] font-mono text-gray-300">{value.toLocaleString()}</span>
      )}
      {loading && <span className="text-[10px] text-gray-600">...</span>}
    </div>
  );
}

export function StatusDotsPanel({ dots, onUpdateDots }: Props) {
  const [compact, setCompact] = useState(false);

  const handleUpdate = (index: number, updates: Partial<StatusDot>) => {
    if (!onUpdateDots) return;
    const next = dots.map((d, i) => i === index ? { ...d, ...updates } : d);
    onUpdateDots(next);
  };

  const handleRemove = (index: number) => {
    if (!onUpdateDots) return;
    onUpdateDots(dots.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!onUpdateDots) return;
    onUpdateDots([...dots, {
      id: `dot-${Date.now()}`,
      label: "New",
      spl: "index=_internal | stats count",
      thresholds: { green: 100, yellow: 500, orange: 1000 },
    }]);
  };

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setCompact(false)}
          className={`rounded p-1 transition-colors ${!compact ? "text-brand-400 bg-brand-500/10" : "text-gray-500 hover:text-gray-300"}`}
          title="Normal view"
        >
          <LayoutList size={12} />
        </button>
        <button
          onClick={() => setCompact(true)}
          className={`rounded p-1 transition-colors ${compact ? "text-brand-400 bg-brand-500/10" : "text-gray-500 hover:text-gray-300"}`}
          title="Compact grid"
        >
          <Grid3X3 size={12} />
        </button>
        {onUpdateDots && (
          <button
            onClick={handleAdd}
            className="rounded p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover transition-colors ml-auto"
            title="Add status dot"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      {/* Dots */}
      <div
        className={compact
          ? "grid gap-1.5"
          : "flex flex-wrap items-start gap-4"
        }
        style={compact ? {
          gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(dots.length))}, 10px)`,
        } : undefined}
      >
        {dots.map((dot, i) => (
          <StatusDotItem
            key={dot.id}
            dot={dot}
            compact={compact}
            onUpdate={(u) => handleUpdate(i, u)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>
    </div>
  );
}
