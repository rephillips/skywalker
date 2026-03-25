import { Router } from "express";
import { splunkFetch } from "../services/splunkService.js";

const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    const info = await splunkFetch("/services/server/info?output_mode=json");
    res.json({ status: "ok", splunk: "reachable", serverName: info.entry?.[0]?.content?.serverName });
  } catch (err) {
    res.json({ status: "ok", splunk: "unreachable", error: (err as Error).message });
  }
});

export default router;
