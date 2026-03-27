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

// Package and download full dispatch directory via SPL
router.get("/search/:sid/dispatch-tar", async (req, res, next) => {
  try {
    const sid = req.params.sid;
    const { executeSearch, splunkFetch } = await import("../services/splunkService.js");

    // Use SPL to tar the dispatch directory on the Splunk server
    const tarSpl = `| makeresults | eval dispatch_dir="$SPLUNK_HOME/var/run/splunk/dispatch/${sid}" | eval cmd="tar -czf /tmp/dispatch_${sid}.tar.gz -C $SPLUNK_HOME/var/run/splunk/dispatch/ ${sid} 2>&1 && echo SUCCESS || echo FAILED" | map search="| script bash \\\"$$cmd\\\"" maxsearches=1`;

    // Alternative approach: list files via | rest and get what we can
    // First try to get dispatch info with file listing
    const listSpl = `| rest splunk_server=local /services/search/v2/jobs/${sid} | fields sid, dispatchState, runDuration, scanCount, resultCount, eventCount, diskUsage, search, performance, messages`;

    const jobData = await executeSearch(listSpl);

    // Also get the full results with count=0 (all results)
    const results = await splunkFetch(
      `/services/search/v2/jobs/${encodeURIComponent(sid)}/results?output_mode=csv&count=0`
    );

    // Get search.log
    let searchLog = "";
    try {
      const { splunkFetchRaw } = await import("../services/splunkService.js");
      searchLog = await splunkFetchRaw(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/search.log`
      );
    } catch {}

    // Get events as CSV
    let eventsCsv = "";
    try {
      const { splunkFetchRaw } = await import("../services/splunkService.js");
      eventsCsv = await splunkFetchRaw(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/events?output_mode=csv&count=0`
      );
    } catch {}

    // Get job info JSON
    const jobInfo = await splunkFetch(
      `/services/search/v2/jobs/${encodeURIComponent(sid)}?output_mode=json`
    );

    // Get timeline
    let timeline = null;
    try {
      timeline = await splunkFetch(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/timeline?output_mode=json`
      );
    } catch {}

    // Get summary
    let summary = null;
    try {
      summary = await splunkFetch(
        `/services/search/v2/jobs/${encodeURIComponent(sid)}/summary?output_mode=json`
      );
    } catch {}

    // Return as a structured bundle with CSV for easy import
    res.json({
      sid,
      dispatchDir: `$SPLUNK_HOME/var/run/splunk/dispatch/${sid}`,
      note: "Full dispatch directory requires filesystem access. This bundle contains all data available via REST API.",
      files: {
        "search.log": searchLog,
        "job_info.json": JSON.stringify(jobInfo?.entry?.[0]?.content || {}, null, 2),
        "results.csv": typeof results === "string" ? results : JSON.stringify(results),
        "events.csv": eventsCsv,
        "timeline.json": timeline ? JSON.stringify(timeline, null, 2) : null,
        "summary.json": summary ? JSON.stringify(summary, null, 2) : null,
        "job_rest_output.json": JSON.stringify(jobData, null, 2),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
