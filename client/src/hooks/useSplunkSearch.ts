import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { queryCache, DEFAULT_CACHE_TTL } from "../services/cache";
import { useGlobalTime } from "./useGlobalTime";
import type { SplunkResult } from "../types/splunk";

interface UseSplunkSearchOptions {
  earliest?: string;
  latest?: string;
  refreshInterval?: number;
  /**
   * How long to cache results (ms). Defaults to DEFAULT_CACHE_TTL (5 min).
   * Pass 0 to disable caching for this query (e.g. always-live dashboards).
   */
  cacheTtl?: number;
}

interface UseSplunkSearchResult {
  data: SplunkResult[] | null;
  loading: boolean;
  error: string | null;
  sid: string | null;
  /** When the current data was fetched and cached. Null if this was a live fetch. */
  cachedAt: Date | null;
  /** Re-runs the search and busts the cache entry for this query. */
  refetch: () => void;
}

export function useSplunkSearch(
  spl: string,
  options: UseSplunkSearchOptions = {}
): UseSplunkSearchResult {
  const globalTime = useGlobalTime();
  const [data, setData]       = useState<SplunkResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [sid, setSid]         = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);

  const earliest = options.earliest || globalTime.earliest;
  const latest   = options.latest   || globalTime.latest;
  const cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;

  const execute = useCallback(async (skipCache = false) => {
    const key = `search:${spl}:${earliest}:${latest}`;

    // ── Cache hit ──────────────────────────────────────────────────────────
    if (!skipCache && cacheTtl > 0) {
      const hit = queryCache.get<Awaited<ReturnType<typeof api.search>>>(key);
      if (hit) {
        setData(hit.data.results);
        setSid(hit.data.sid || null);
        setCachedAt(hit.cachedAt);
        setLoading(false);
        return;
      }
    }

    // ── Live fetch ─────────────────────────────────────────────────────────
    if (skipCache) queryCache.invalidate(key);
    try {
      setLoading(true);
      setError(null);
      setCachedAt(null);
      const response = await api.search(spl, earliest, latest);
      if (cacheTtl > 0) queryCache.set(key, response, cacheTtl);
      setData(response.results);
      setSid(response.sid || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [spl, earliest, latest, cacheTtl]);

  useEffect(() => {
    execute();

    if (options.refreshInterval && options.refreshInterval > 0) {
      const interval = setInterval(() => execute(true), options.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [execute, options.refreshInterval]);

  return { data, loading, error, sid, cachedAt, refetch: () => execute(true) };
}
