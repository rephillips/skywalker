import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { DashboardPage } from "./pages/DashboardPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DocsPage } from "./pages/DocsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SystemInfoPage } from "./pages/SystemInfoPage";
import { KnowledgeBundlePage } from "./pages/KnowledgeBundlePage";
import { ConfReferencePage } from "./pages/ConfReferencePage";
import { BtoolPage } from "./pages/BtoolPage";
import { SkippedSearchesPage } from "./pages/SkippedSearchesPage";
import { SlowSearchesPage } from "./pages/SlowSearchesPage";
import { ScheduledSearchesPage } from "./pages/ScheduledSearchesPage";
import { SHCPage } from "./pages/SHCPage";
import "./index.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "search/skipped", element: <SkippedSearchesPage /> },
      { path: "search/slow", element: <SlowSearchesPage /> },
      { path: "docs", element: <DocsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "system-info", element: <SystemInfoPage /> },
      { path: "knowledge", element: <KnowledgeBundlePage /> },
      { path: "conf-reference", element: <ConfReferencePage /> },
      { path: "btool", element: <BtoolPage /> },
      { path: "audits/scheduled-searches", element: <ScheduledSearchesPage /> },
      { path: "shc", element: <SHCPage /> },
      { path: "monitoring/:section", element: <PlaceholderPage /> },
      { path: "security", element: <PlaceholderPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
