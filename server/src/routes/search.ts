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
    console.log(`[Search] SPL: ${spl} | earliest: ${earliest} | latest: ${latest}`);
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

export default router;
