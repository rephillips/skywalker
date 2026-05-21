import { Router } from "express";
import { fetch } from "undici";

const STATUS_URL = "https://status.splunkcloud.com/api/v2/summary.json";

const router = Router();

router.get("/cloud-status", async (_req, res, next) => {
  try {
    const response = await fetch(STATUS_URL, {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      res.status(502).json({ error: `Status page returned ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json({ status: "ok", data });
  } catch (err) {
    next(err);
  }
});

export default router;
