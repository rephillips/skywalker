import { useParams, useLocation } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";

const TITLES: Record<string, string> = {
  "/monitoring/infra": "Infrastructure",
  "/monitoring/apps": "Applications",
  "/security": "Security",
};

export function PlaceholderPage() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Coming Soon";

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={title} />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">{title} page coming soon.</p>
      </div>
    </div>
  );
}
