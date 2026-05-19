import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { ThemeContext, useThemeState } from "./hooks/useTheme";
import { GlobalTimeContext, useGlobalTimeState } from "./hooks/useGlobalTime";
import { SetupWizard } from "./components/SetupWizard";

export default function App() {
  const themeState = useThemeState();
  const globalTimeState = useGlobalTimeState();
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [initialBaseUrl, setInitialBaseUrl] = useState("https://127.0.0.1:8089");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        setInitialBaseUrl(cfg.baseUrl || "https://127.0.0.1:8089");
        setIsConnected(!!(cfg.hasToken || cfg.hasPassword));
      })
      .catch(() => {})
      .finally(() => setConnectionChecked(true));
  }, []);

  if (!connectionChecked) return null;

  return (
    <ThemeContext.Provider value={themeState}>
      <GlobalTimeContext.Provider value={globalTimeState}>
        {!isConnected ? (
          <SetupWizard
            initialBaseUrl={initialBaseUrl}
            onConnected={() => setIsConnected(true)}
          />
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
