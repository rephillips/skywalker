import { useState } from "react";
import { Plus } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { PanelGrid } from "../components/panels/PanelGrid";
import { AddPanelModal } from "../components/panels/AddPanelModal";
import { useCustomPanels } from "../hooks/useCustomPanels";

export function DashboardPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { panels: customPanels, addPanel, removePanel } = useCustomPanels();

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Dashboard" />
      <div className="flex items-center justify-between px-6 pt-4">
        <span className="text-xs text-gray-500">
          {customPanels.length} panel{customPanels.length !== 1 && "s"}
        </span>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Plus size={14} />
          Add Panel
        </button>
      </div>
      {customPanels.length > 0 ? (
        <PanelGrid
          panels={customPanels}
          onRemovePanel={removePanel}
          customPanelIds={new Set(customPanels.map((p) => p.id))}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500">Click "Add Panel" to create your first timechart.</p>
        </div>
      )}
      {showAddModal && (
        <AddPanelModal
          onAdd={addPanel}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
