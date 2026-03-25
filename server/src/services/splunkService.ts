import https from "node:https";
import { config } from "../config.js";

const agent = new https.Agent({ rejectUnauthorized: false });

function authHeader(): string {
  if (config.splunk.token) {
    return `Bearer ${config.splunk.token}`;
  }
  const { username, password } = config.splunk;
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

export async function splunkFetch(path: string, options?: RequestInit): Promise<any> {
  const url = `${config.splunk.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    // @ts-expect-error Node fetch supports agent via dispatcher
    dispatcher: agent,
    headers: {
      Authorization: authHeader(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Splunk API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function createSearchJob(
  spl: string,
  earliest?: string,
  latest?: string
): Promise<string> {
  const body = new URLSearchParams();
  body.set("search", spl);
  body.set("output_mode", "json");
  if (earliest) body.set("earliest_time", earliest);
  if (latest) body.set("latest_time", latest);

  const data = await splunkFetch("/services/search/v2/jobs", {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data.sid;
}

interface JobStatus {
  dispatchState: string;
  doneProgress: number;
  resultCount: number;
}

export async function getJobStatus(sid: string): Promise<JobStatus> {
  const data = await splunkFetch(
    `/services/search/v2/jobs/${encodeURIComponent(sid)}?output_mode=json`
  );
  const content = data.entry?.[0]?.content;
  return {
    dispatchState: content?.dispatchState ?? "UNKNOWN",
    doneProgress: content?.doneProgress ?? 0,
    resultCount: content?.resultCount ?? 0,
  };
}

export async function getJobResults(
  sid: string,
  count = 1000,
  offset = 0
): Promise<any> {
  return splunkFetch(
    `/services/search/v2/jobs/${encodeURIComponent(sid)}/results?output_mode=json&count=${count}&offset=${offset}`
  );
}

export async function executeSearch(
  spl: string,
  earliest?: string,
  latest?: string,
  timeoutMs = 30000
): Promise<any> {
  const sid = await createSearchJob(spl, earliest, latest);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await getJobStatus(sid);
    if (status.dispatchState === "DONE") {
      return getJobResults(sid);
    }
    if (status.dispatchState === "FAILED") {
      throw new Error(`Search job ${sid} failed`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Search job ${sid} timed out after ${timeoutMs}ms`);
}
