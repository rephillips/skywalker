import { Agent } from "undici";
import { config } from "../config.js";

const tlsAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

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
    // @ts-expect-error undici dispatcher for TLS bypass
    dispatcher: tlsAgent,
    headers: {
      Authorization: authHeader(),
      "Cache-Control": "no-cache",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Splunk API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/** Fetch raw text from Splunk (for search.log etc.) */
export async function splunkFetchRaw(path: string): Promise<string> {
  const url = `${config.splunk.baseUrl}${path}`;
  const res = await fetch(url, {
    // @ts-expect-error undici dispatcher for TLS bypass
    dispatcher: tlsAgent,
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Splunk API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
}

export async function createSearchJob(
  spl: string,
  earliest?: string,
  latest?: string
): Promise<string> {
  const normalizedSpl = /^\s*(search|tstats|\|)/.test(spl) ? spl : `search ${spl}`;
  const body = new URLSearchParams();
  body.set("search", normalizedSpl);
  body.set("output_mode", "json");
  body.set("reuse_max_seconds_ago", "0");
  if (earliest && earliest !== "undefined") body.set("earliest_time", earliest);
  if (latest && latest !== "undefined") body.set("latest_time", latest);

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
  const data = await splunkFetch(
    `/services/search/v2/jobs/${encodeURIComponent(sid)}/results?output_mode=json&count=${count}&offset=${offset}`
  );

  // Log the fields we got back for debugging
  if (data?.results?.length > 0) {
    const fields = Object.keys(data.results[0]);
    console.log(`[Results] sid=${sid} rows=${data.results.length} fields=${JSON.stringify(fields)}`);
    console.log(`[Results] sample: ${JSON.stringify(data.results[0])}`);
  } else {
    console.log(`[Results] sid=${sid} empty results, fields from response: ${JSON.stringify(data?.fields?.map((f: any) => f.name))}`);
  }

  return data;
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
    console.log(`[Poll] sid=${sid} state=${status.dispatchState} progress=${status.doneProgress} resultCount=${status.resultCount}`);
    if (status.dispatchState === "DONE") {
      const results = await getJobResults(sid, 1000);
      results.sid = sid;
      return results;
    }
    if (status.dispatchState === "FAILED") {
      throw new Error(`Search job ${sid} failed`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Search job ${sid} timed out after ${timeoutMs}ms`);
}
