import { useState } from "react";
import { Plus } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { PanelGrid } from "../components/panels/PanelGrid";
import { AddPanelModal } from "../components/panels/AddPanelModal";
import { defaultDashboard } from "../config/dashboards";
import { useCustomPanels } from "../hooks/useCustomPanels";

export function DashboardPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { panels: customPanels, addPanel, removePanel } = useCustomPanels();

  const allPanels = [...defaultDashboard.panels, ...customPanels];

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={defaultDashboard.title} />
      <div className="flex items-center justify-between px-6 pt-4">
        <span className="text-xs text-gray-500">
          {allPanels.length} panel{allPanels.length !== 1 && "s"}
          {customPanels.length > 0 && ` (${customPanels.length} custom)`}
        </span>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Plus size={14} />
          Add Panel
        </button>
      </div>
      <PanelGrid
        panels={allPanels}
        onRemovePanel={removePanel}
        customPanelIds={new Set(customPanels.map((p) => p.id))}
      />
      {showAddModal && (
        <AddPanelModal
          onAdd={addPanel}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
