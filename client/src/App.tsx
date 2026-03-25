import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { ThemeContext, useThemeState } from "./hooks/useTheme";
import { GlobalTimeContext, useGlobalTimeState } from "./hooks/useGlobalTime";

export default function App() {
  const themeState = useThemeState();
  const globalTimeState = useGlobalTimeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <GlobalTimeContext.Provider value={globalTimeState}>
        <div className="flex min-h-screen bg-surface text-gray-100">
          <Sidebar />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </GlobalTimeContext.Provider>
    </ThemeContext.Provider>
  );
}
