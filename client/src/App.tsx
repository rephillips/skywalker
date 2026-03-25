import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { ThemeContext, useThemeState } from "./hooks/useTheme";

export default function App() {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <div className="flex min-h-screen bg-surface text-gray-100">
        <Sidebar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
