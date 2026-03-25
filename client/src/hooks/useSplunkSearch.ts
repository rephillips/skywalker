import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useGlobalTime } from "./useGlobalTime";
import type { SplunkResult } from "../types/splunk";

interface UseSplunkSearchOptions {
  earliest?: string;
  latest?: string;
  refreshInterval?: number;
}

interface UseSplunkSearchResult {
  data: SplunkResult[] | null;
  loading: boolean;
  error: string | null;
  sid: string | null;
  refetch: () => void;
}

export function useSplunkSearch(
  spl: string,
  options: UseSplunkSearchOptions = {}
): UseSplunkSearchResult {
  const globalTime = useGlobalTime();
  const [data, setData] = useState<SplunkResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sid, setSid] = useState<string | null>(null);

  const earliest = options.earliest || globalTime.earliest;
  const latest = options.latest || globalTime.latest;

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.search(spl, earliest, latest);
      setData(response.results);
      setSid(response.sid || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl, earliest, latest]);

  useEffect(() => {
    execute();

    if (options.refreshInterval && options.refreshInterval > 0) {
      const interval = setInterval(execute, options.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [execute, options.refreshInterval]);

  return { data, loading, error, sid, refetch: execute };
}
