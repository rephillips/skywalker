import { useState, useEffect } from "react";
import { Plus, X, Check, Pencil } from "lucide-react";
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

function Dot({ dot, onEdit, onRemove }: {
  dot: StatusDot;
  onEdit?: (updates: Partial<StatusDot>) => void;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(dot.label);
  const [editSpl, setEditSpl] = useState(dot.spl);
  const [editGreen, setEditGreen] = useState(dot.thresholds.green);
  const [editYellow, setEditYellow] = useState(dot.thresholds.yellow);
  const [editOrange, setEditOrange] = useState(dot.thresholds.orange);

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

  if (editing) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-surface-border bg-surface w-full max-w-lg">
        {/* Name + SPL */}
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-400">Name</span>
            <input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-gray-200 outline-none focus:border-brand-500"
              placeholder="e.g. Error Count"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-400">SPL Query</span>
            <input
              value={editSpl}
              onChange={(e) => setEditSpl(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm font-mono text-gray-300 outline-none focus:border-brand-500"
              placeholder="index=_internal | stats count"
            />
          </label>
        </div>
        {/* Thresholds */}
        <div>
          <span className="text-[11px] font-medium text-gray-400 block mb-3">Color Thresholds</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" style={{ boxShadow: "0 0 6px #10b98180" }} />
              <span className="text-xs text-gray-300 w-14">Green</span>
              <span className="text-xs text-gray-500">when count is between 0 and</span>
              <input type="number" value={editGreen} onChange={(e) => setEditGreen(Number(e.target.value))}
                className="w-20 rounded-lg border border-surface-border bg-surface-raised px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-brand-500" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 shrink-0" style={{ boxShadow: "0 0 6px #eab30880" }} />
              <span className="text-xs text-gray-300 w-14">Yellow</span>
              <span className="text-xs text-gray-500">when count is between {editGreen + 1} and</span>
              <input type="number" value={editYellow} onChange={(e) => setEditYellow(Number(e.target.value))}
                className="w-20 rounded-lg border border-surface-border bg-surface-raised px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-brand-500" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-orange-500 shrink-0" style={{ boxShadow: "0 0 6px #f9731680" }} />
              <span className="text-xs text-gray-300 w-14">Orange</span>
              <span className="text-xs text-gray-500">when count is between {editYellow + 1} and</span>
              <input type="number" value={editOrange} onChange={(e) => setEditOrange(Number(e.target.value))}
                className="w-20 rounded-lg border border-surface-border bg-surface-raised px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-brand-500" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0" style={{ boxShadow: "0 0 6px #ef444480" }} />
              <span className="text-xs text-gray-300 w-14">Red</span>
              <span className="text-xs text-gray-500">when count is above {editOrange}</span>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-surface-border/50">
          <button
            onClick={() => {
              if (onEdit) onEdit({ label: editLabel, spl: editSpl, thresholds: { green: editGreen, yellow: editYellow, orange: editOrange } });
              setEditing(false);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
          ><Check size={12} /> Save</button>
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          ><X size={12} /> Cancel</button>
          {onRemove && (
            <button onClick={onRemove}
              className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
            >Remove dot</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-2 cursor-pointer" onClick={() => onEdit && setEditing(true)}>
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}, 0 0 8px ${color}80, 0 0 12px ${color}40` }}
      />
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-400 leading-tight">{dot.label}</span>
        {value !== null && (
          <span className="text-sm font-bold font-mono leading-tight" style={{ color }}>{value.toLocaleString()}</span>
        )}
      </div>
      {onEdit && (
        <Pencil size={8} className="hidden group-hover:block text-gray-600" />
      )}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
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

  function editDot(index: number, updates: Partial<StatusDot>) {
    if (!onUpdate) return;
    onUpdate(dots.map((d, i) => i === index ? { ...d, ...updates } : d));
  }

  function removeDot(index: number) {
    if (!onUpdate) return;
    onUpdate(dots.filter((_, i) => i !== index));
  }

  if (dots.length === 0 && !onUpdate) return null;

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-1 shrink-0">
      {dots.map((dot, i) => (
        <Dot
          key={dot.id}
          dot={dot}
          onEdit={onUpdate ? (u) => editDot(i, u) : undefined}
          onRemove={onUpdate ? () => removeDot(i) : undefined}
        />
      ))}
      {onUpdate && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-400 transition-colors"
          title="Add status dot"
        >
          <div className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-600 flex items-center justify-center">
            <Plus size={7} />
          </div>
          <span>Add dot</span>
        </button>
      )}
      {adding && (
        <div className="flex items-center gap-1">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-20 rounded border border-surface-border bg-surface px-1 py-0.5 text-[9px] text-gray-300 outline-none"
            placeholder="Name"
            autoFocus
          />
          <input
            value={newSpl}
            onChange={(e) => setNewSpl(e.target.value)}
            className="w-48 rounded border border-surface-border bg-surface px-1 py-0.5 text-[9px] font-mono text-gray-300 outline-none"
            placeholder="SPL query"
            onKeyDown={(e) => e.key === "Enter" && addDot()}
          />
          <button onClick={addDot} className="text-emerald-400 text-[9px]">Add</button>
          <button onClick={() => { setAdding(false); setNewLabel(""); setNewSpl(""); }} className="text-gray-500 text-[9px]">Cancel</button>
        </div>
      )}
    </div>
  );
}
