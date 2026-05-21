import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { ThemeContext, useThemeState } from "./hooks/useTheme";
import { GlobalTimeContext, useGlobalTimeState } from "./hooks/useGlobalTime";
import { SetupWizard } from "./components/SetupWizard";

export default function App() {
  const themeState = useThemeState();
  const globalTimeState = useGlobalTimeState();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);

  function handleConnected() {
    setIsConnected(true);
    navigate("/system-info", { replace: true });
  }

  return (
    <ThemeContext.Provider value={themeState}>
      <GlobalTimeContext.Provider value={globalTimeState}>
        {!isConnected ? (
          <SetupWizard onConnected={handleConnected} />
        ) : (
          <div className="flex min-h-screen bg-surface text-gray-100">
            <Sidebar />
            <main className="flex-1">
              <Outlet />
            </main>
          </div>
        )}
      </GlobalTimeContext.Provider>
    </ThemeContext.Provider>
  );
}
