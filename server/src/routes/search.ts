import { Router } from "express";
import {
  executeSearch,
  createSearchJob,
  getJobStatus,
  getJobResults,
} from "../services/splunkService.js";

const router = Router();

// Synchronous search: run SPL, poll until done, return results
router.post("/search", async (req, res, next) => {
  try {
    const { spl, earliest, latest } = req.body;
    if (!spl) {
      res.status(400).json({ error: "spl field is required" });
      return;
    }
    console.log(`[Search] SPL: ${spl}  earliest=${earliest}  latest=${latest}`);
    const results = await executeSearch(spl, earliest, latest);
    console.log(`[Search] Results: ${results?.results?.length ?? 0} rows, fields: ${JSON.stringify(results?.fields?.map((f: any) => f.name))}`);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Async search: start job and return SID immediately
router.post("/search/async", async (req, res, next) => {
  try {
    const { spl, earliest, latest } = req.body;
    if (!spl) {
      res.status(400).json({ error: "spl field is required" });
      return;
    }
    const sid = await createSearchJob(spl, earliest, latest);
    res.json({ sid });
  } catch (err) {
    next(err);
  }
});

// Poll job status
router.get("/search/:sid/status", async (req, res, next) => {
  try {
    const status = await getJobStatus(req.params.sid);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// Get job results
router.get("/search/:sid/results", async (req, res, next) => {
  try {
    const count = parseInt(req.query.count as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;
    const results = await getJobResults(req.params.sid, count, offset);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Get search.log for a job
router.get("/search/:sid/log", async (req, res, next) => {
  try {
    const { splunkFetchRaw } = await import("../services/splunkService.js");
    const text = await splunkFetchRaw(
      `/services/search/v2/jobs/${encodeURIComponent(req.params.sid)}/search.log`
    );
    res.json({ log: text });
  } catch (err) {
    next(err);
  }
});

// Get dispatch directory listing for a job
router.get("/search/:sid/dispatch", async (req, res, next) => {
  try {
    const sid = req.params.sid;
    const { splunkFetch, splunkFetchRaw } = await import("../services/splunkService.js");

    // Get job metadata which includes dispatch dir info
    const jobData = await splunkFetch(
      `/services/search/v2/jobs/${encodeURIComponent(sid)}?output_mode=json`
    );
    const content = jobData?.entry?.[0]?.content || {};

    // Collect available artifacts
    const artifacts: { name: string; content: string }[] = [];

    // search.log
    try {
      const log = await splunkFetchRaw(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/search.log`
      );
      artifacts.push({ name: "search.log", content: log });
    } catch {}

    // Job info as JSON
    artifacts.push({
      name: "job_info.json",
      content: JSON.stringify(content, null, 2),
    });

    // Results
    try {
      const results = await splunkFetch(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/results?output_mode=json&count=0`
      );
      artifacts.push({
        name: "results.json",
        content: JSON.stringify(results, null, 2),
      });
    } catch {}

    // Events
    try {
      const events = await splunkFetch(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/events?output_mode=json&count=100`
      );
      artifacts.push({
        name: "events.json",
        content: JSON.stringify(events, null, 2),
      });
    } catch {}

    // Timeline
    try {
      const timeline = await splunkFetch(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/timeline?output_mode=json`
      );
      artifacts.push({
        name: "timeline.json",
        content: JSON.stringify(timeline, null, 2),
      });
    } catch {}

    // Summary
    try {
      const summary = await splunkFetch(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/summary?output_mode=json`
      );
      artifacts.push({
        name: "summary.json",
        content: JSON.stringify(summary, null, 2),
      });
    } catch {}

    res.json({
      sid,
      dispatchDir: `$SPLUNK_HOME/var/run/splunk/dispatch/${sid}`,
      artifactCount: artifacts.length,
      artifacts,
    });
  } catch (err) {
    next(err);
  }
});

// Package full dispatch directory as tar.gz via SPL script, then download
router.get("/search/:sid/dispatch-tar", async (req, res, next) => {
  try {
    const sid = req.params.sid;
    const { executeSearch, splunkFetchRaw, splunkFetch } = await import("../services/splunkService.js");

    const tarPath = `/tmp/skywalker_dispatch_${sid}.tar.gz`;

    // Step 1: Run script on Splunk server to tar the dispatch directory
    console.log(`[Dispatch] Tarring dispatch dir for SID: ${sid}`);
    const tarSpl = `| makeresults | eval _raw="tarring" | script bash "tar -czf ${tarPath} -C \\$SPLUNK_HOME/var/run/splunk/dispatch/ ${sid} 2>&1 && echo TAR_SUCCESS || echo TAR_FAILED"`;

    try {
      const tarResult = await executeSearch(tarSpl);
      const output = tarResult?.results?.[0]?._raw || "";
      console.log(`[Dispatch] Tar result: ${output}`);

      if (output.includes("TAR_FAILED")) {
        throw new Error("tar command failed on Splunk server");
      }
    } catch (tarErr) {
      console.log(`[Dispatch] Tar via script failed, falling back to REST artifacts: ${(tarErr as Error).message}`);
      // Fallback: download individual files via REST
      const enc = encodeURIComponent(sid);
      const files: Record<string, string | null> = {};

      try { files["search.log"] = await splunkFetchRaw(`/services/search/v2/jobs/${enc}/search.log`); } catch { files["search.log"] = null; }
      try { const info = await splunkFetch(`/services/search/v2/jobs/${enc}?output_mode=json`); files["job_info.json"] = JSON.stringify(info?.entry?.[0]?.content || {}, null, 2); } catch { files["job_info.json"] = null; }
      try { files["results.csv"] = await splunkFetchRaw(`/services/search/v2/jobs/${enc}/results?output_mode=csv&count=0`); } catch { files["results.csv"] = null; }
      try { files["events.csv"] = await splunkFetchRaw(`/services/search/v2/jobs/${enc}/events?output_mode=csv&count=0`); } catch { files["events.csv"] = null; }
      try { const tl = await splunkFetch(`/services/search/v2/jobs/${enc}/timeline?output_mode=json`); files["timeline.json"] = JSON.stringify(tl, null, 2); } catch { files["timeline.json"] = null; }
      try { const sum = await splunkFetch(`/services/search/v2/jobs/${enc}/summary?output_mode=json`); files["summary.json"] = JSON.stringify(sum, null, 2); } catch { files["summary.json"] = null; }

      res.json({ sid, method: "rest-fallback", files });
      return;
    }

    // Step 2: Read the tar.gz back via SPL and send as base64
    console.log(`[Dispatch] Reading tar.gz from Splunk server`);
    const readSpl = `| makeresults | eval _raw="reading" | script bash "base64 ${tarPath} && rm -f ${tarPath}"`;

    try {
      const readResult = await executeSearch(readSpl, undefined, undefined, 60000);
      const base64Data = readResult?.results?.map((r: any) => r._raw).join("") || "";

      if (!base64Data || base64Data.includes("reading")) {
        throw new Error("Failed to read tar.gz");
      }

      res.json({
        sid,
        method: "tar",
        filename: `dispatch_${sid}.tar.gz`,
        contentType: "application/gzip",
        base64: base64Data,
      });
    } catch (readErr) {
      console.log(`[Dispatch] Reading tar failed: ${(readErr as Error).message}`);
      // Cleanup
      try { await executeSearch(`| makeresults | script bash "rm -f ${tarPath}"`); } catch {}
      throw readErr;
    }
  } catch (err) {
    next(err);
  }
});

export default router;
