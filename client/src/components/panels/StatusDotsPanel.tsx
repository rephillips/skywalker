import { useState } from "react";
import { Check, X, Plus, Trash2 } from "lucide-react";
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
  if (value <= t.green) return "0 0 8px #10b98180";
  if (value <= t.yellow) return "0 0 8px #eab30880";
  if (value <= t.orange) return "0 0 8px #f9731680";
  return "0 0 8px #ef444480";
}

function StatusDotItem({ dot, onUpdate, onRemove }: {
  dot: StatusDot;
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

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
      {editing ? (
        <div className="flex flex-col gap-1 p-2 rounded-lg border border-surface-border bg-surface">
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            className="text-xs bg-transparent border border-surface-border rounded px-1.5 py-0.5 text-gray-100 outline-none w-24"
            placeholder="Label"
          />
          <input
            value={editSpl}
            onChange={(e) => setEditSpl(e.target.value)}
            className="text-[10px] font-mono bg-transparent border border-surface-border rounded px-1.5 py-0.5 text-gray-300 outline-none w-40"
            placeholder="SPL query"
          />
          <div className="flex gap-1">
            <button onClick={() => { onUpdate({ label: editLabel, spl: editSpl }); setEditing(false); }} className="text-emerald-400 p-0.5"><Check size={12} /></button>
            <button onClick={() => { setEditing(false); }} className="text-gray-500 p-0.5"><X size={12} /></button>
            <button onClick={onRemove} className="text-red-400 p-0.5 ml-auto"><Trash2 size={12} /></button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export function StatusDotsPanel({ dots, onUpdateDots }: Props) {
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
    <div className="flex flex-wrap items-start gap-4 py-2">
      {dots.map((dot, i) => (
        <StatusDotItem
          key={dot.id}
          dot={dot}
          onUpdate={(u) => handleUpdate(i, u)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      {onUpdateDots && (
        <button
          onClick={handleAdd}
          className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-surface-border text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
          title="Add status dot"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
