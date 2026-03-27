import type { SplunkSearchResponse } from "../types/splunk";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  search(spl: string, earliest?: string, latest?: string) {
    return request<SplunkSearchResponse>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spl, earliest, latest }),
    });
  },

  health() {
    return request<{ status: string; splunk: string }>("/health");
  },

  config() {
    return request<{ baseUrl: string; webUrl: string; username: string; hasPassword: boolean; hasToken: boolean; authMode: string }>("/config");
  },

  searchLog(sid: string) {
    return request<any>(`/search/${encodeURIComponent(sid)}/log`);
  },

  dispatch(sid: string) {
    return request<any>(`/search/${encodeURIComponent(sid)}/dispatch`);
  },

  proxy(path: string, method = "GET", body?: string) {
    return request<{ status: string; data?: any; message?: string }>("/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, method, body }),
    });
  },
};
