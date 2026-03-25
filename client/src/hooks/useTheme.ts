import { createContext, useContext, useState, useCallback, useEffect } from "react";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeState>({
  theme: "dark",
  toggle: () => {},
});

export function useThemeState(): ThemeState {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
