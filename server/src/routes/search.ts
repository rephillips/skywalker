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

// Package and download full dispatch directory via REST
router.get("/search/:sid/dispatch-tar", async (req, res, next) => {
  try {
    const sid = req.params.sid;
    const { splunkFetch, splunkFetchRaw } = await import("../services/splunkService.js");
    const enc = encodeURIComponent(sid);

    const files: Record<string, string | null> = {};

    // search.log (plain text)
    try {
      files["search.log"] = await splunkFetchRaw(`/services/search/v2/jobs/${enc}/search.log`);
    } catch { files["search.log"] = null; }

    // Job info (JSON)
    try {
      const info = await splunkFetch(`/services/search/v2/jobs/${enc}?output_mode=json`);
      files["job_info.json"] = JSON.stringify(info?.entry?.[0]?.content || {}, null, 2);
    } catch { files["job_info.json"] = null; }

    // Results as CSV
    try {
      files["results.csv"] = await splunkFetchRaw(`/services/search/v2/jobs/${enc}/results?output_mode=csv&count=0`);
    } catch { files["results.csv"] = null; }

    // Events as CSV
    try {
      files["events.csv"] = await splunkFetchRaw(`/services/search/v2/jobs/${enc}/events?output_mode=csv&count=0`);
    } catch { files["events.csv"] = null; }

    // Timeline (JSON)
    try {
      const tl = await splunkFetch(`/services/search/v2/jobs/${enc}/timeline?output_mode=json`);
      files["timeline.json"] = JSON.stringify(tl, null, 2);
    } catch { files["timeline.json"] = null; }

    // Summary (JSON)
    try {
      const sum = await splunkFetch(`/services/search/v2/jobs/${enc}/summary?output_mode=json`);
      files["summary.json"] = JSON.stringify(sum, null, 2);
    } catch { files["summary.json"] = null; }

    res.json({ sid, files });
  } catch (err) {
    next(err);
  }
});

export default router;
