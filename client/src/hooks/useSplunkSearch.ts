import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
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
  refetch: () => void;
}

export function useSplunkSearch(
  spl: string,
  options: UseSplunkSearchOptions = {}
): UseSplunkSearchResult {
  const [data, setData] = useState<SplunkResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.search(spl, options.earliest, options.latest);
      setData(response.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl, options.earliest, options.latest]);

  useEffect(() => {
    execute();

    if (options.refreshInterval && options.refreshInterval > 0) {
      const interval = setInterval(execute, options.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [execute, options.refreshInterval]);

  return { data, loading, error, refetch: execute };
}
