/**
 * Module-level in-memory query cache.
 *
 * Lives for the lifetime of the browser tab — data is never written to disk or
 * localStorage so Splunk results stay in memory only. Navigating between pages
 * returns the cached result instantly; manual refresh busts the entry.
 */

export const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: number;
}

class QueryCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): { data: T; cachedAt: Date } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return { data: entry.data as T, cachedAt: entry.cachedAt };
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      cachedAt: new Date(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Returns a snapshot of all live entries (for a debug/settings panel). */
  snapshot(): { key: string; cachedAt: Date; expiresAt: number }[] {
    const now = Date.now();
    return Array.from(this.store.entries())
      .filter(([, e]) => now < e.expiresAt)
      .map(([key, e]) => ({ key, cachedAt: e.cachedAt, expiresAt: e.expiresAt }));
  }

  get size(): number {
    return this.store.size;
  }
}

export const queryCache = new QueryCache();
