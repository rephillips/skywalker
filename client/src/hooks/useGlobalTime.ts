import { createContext, useContext, useState, useCallback } from "react";

export interface GlobalTimeState {
  earliest: string;
  latest: string;
  label: string;
  setTime: (earliest: string, latest: string, label: string) => void;
}

export const TIME_PRESETS = [
  { label: "Last 15 min", earliest: "-15m", latest: "now" },
  { label: "Last 1 hour", earliest: "-1h", latest: "now" },
  { label: "Last 4 hours", earliest: "-4h", latest: "now" },
  { label: "Last 24 hours", earliest: "-24h", latest: "now" },
  { label: "Last 7 days", earliest: "-7d", latest: "now" },
  { label: "Last 30 days", earliest: "-30d", latest: "now" },
  { label: "All time", earliest: "0", latest: "now" },
];

export const GlobalTimeContext = createContext<GlobalTimeState>({
  earliest: "-1h",
  latest: "now",
  label: "Last 1 hour",
  setTime: () => {},
});

export function useGlobalTimeState(): GlobalTimeState {
  const [earliest, setEarliest] = useState("-1h");
  const [latest, setLatest] = useState("now");
  const [label, setLabel] = useState("Last 1 hour");

  const setTime = useCallback((e: string, l: string, lbl: string) => {
    setEarliest(e);
    setLatest(l);
    setLabel(lbl);
  }, []);

  return { earliest, latest, label, setTime };
}

export function useGlobalTime(): GlobalTimeState {
  return useContext(GlobalTimeContext);
}
