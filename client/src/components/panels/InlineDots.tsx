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
      <div className="flex flex-col gap-1 p-2 rounded-lg border border-surface-border bg-surface text-[9px]">
        <div className="flex items-center gap-1">
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            className="w-20 rounded border border-surface-border bg-surface-raised px-1 py-0.5 text-gray-200 outline-none"
            placeholder="Name"
            autoFocus
          />
          <input
            value={editSpl}
            onChange={(e) => setEditSpl(e.target.value)}
            className="w-48 rounded border border-surface-border bg-surface-raised px-1 py-0.5 font-mono text-gray-300 outline-none"
            placeholder="SPL query"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-emerald-400">G≤</span>
          <input type="number" value={editGreen} onChange={(e) => setEditGreen(Number(e.target.value))} className="w-12 rounded border border-surface-border bg-surface-raised px-1 py-0.5 text-gray-300 outline-none" />
          <span className="text-yellow-400">Y≤</span>
          <input type="number" value={editYellow} onChange={(e) => setEditYellow(Number(e.target.value))} className="w-12 rounded border border-surface-border bg-surface-raised px-1 py-0.5 text-gray-300 outline-none" />
          <span className="text-orange-400">O≤</span>
          <input type="number" value={editOrange} onChange={(e) => setEditOrange(Number(e.target.value))} className="w-12 rounded border border-surface-border bg-surface-raised px-1 py-0.5 text-gray-300 outline-none" />
          <button
            onClick={() => {
              if (onEdit) onEdit({ label: editLabel, spl: editSpl, thresholds: { green: editGreen, yellow: editYellow, orange: editOrange } });
              setEditing(false);
            }}
            className="text-emerald-400 p-0.5"
          ><Check size={10} /></button>
          <button onClick={() => setEditing(false)} className="text-gray-500 p-0.5"><X size={10} /></button>
          {onRemove && <button onClick={onRemove} className="text-red-400 p-0.5 ml-auto">Remove</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex items-center gap-1 cursor-pointer" onClick={() => onEdit && setEditing(true)}>
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}80` }}
      />
      <span className="text-[9px] text-gray-500 whitespace-nowrap">
        {dot.label}{value !== null ? `: ${value}` : ""}
      </span>
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
