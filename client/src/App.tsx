import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { ThemeContext, useThemeState } from "./hooks/useTheme";
import { GlobalTimeContext, useGlobalTimeState } from "./hooks/useGlobalTime";
import { SetupWizard } from "./components/SetupWizard";

const FALLBACK_URL = "https://35.169.157.99:8089";

export default function App() {
  const themeState = useThemeState();
  const globalTimeState = useGlobalTimeState();
  const navigate = useNavigate();
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [initialBaseUrl, setInitialBaseUrl] = useState(FALLBACK_URL);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => {
        // Only use server's URL if it isn't the generic localhost default
        const url = cfg.baseUrl && !cfg.baseUrl.includes("127.0.0.1") ? cfg.baseUrl : FALLBACK_URL;
        setInitialBaseUrl(url);
        setIsConnected(!!(cfg.hasToken || cfg.hasPassword));
      })
      .catch(() => {})
      .finally(() => setConnectionChecked(true));
  }, []);

  function handleConnected() {
    setIsConnected(true);
    navigate("/shc", { replace: true });
  }

  if (!connectionChecked) return null;

  return (
    <ThemeContext.Provider value={themeState}>
      <GlobalTimeContext.Provider value={globalTimeState}>
        {!isConnected ? (
          <SetupWizard
            initialBaseUrl={initialBaseUrl}
            onConnected={handleConnected}
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
