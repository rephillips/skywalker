import { Router } from "express";
import { config, updateSplunkConfig } from "../config.js";
import { splunkFetch } from "../services/splunkService.js";

const router = Router();

// Get current config (masks sensitive fields)
router.get("/config", (_req, res) => {
  res.json({
    baseUrl: config.splunk.baseUrl,
    username: config.splunk.username,
    hasPassword: !!config.splunk.password,
    hasToken: !!config.splunk.token,
    authMode: config.splunk.token ? "token" : "basic",
  });
});

// Update config
router.put("/config", async (req, res, next) => {
  try {
    const { baseUrl, username, password, token } = req.body;
    updateSplunkConfig({ baseUrl, username, password, token });

    // Test the connection with new config
    try {
      await splunkFetch("/services/server/info?output_mode=json");
      res.json({ status: "ok", message: "Configuration updated and connection verified" });
    } catch (err) {
      res.json({ status: "warning", message: `Configuration saved but Splunk unreachable: ${(err as Error).message}` });
    }
  } catch (err) {
    next(err);
  }
});

// Test connection
router.post("/config/test", async (_req, res) => {
  try {
    const info = await splunkFetch("/services/server/info?output_mode=json");
    const serverName = info.entry?.[0]?.content?.serverName;
    res.json({ status: "ok", serverName });
  } catch (err) {
    res.json({ status: "error", message: (err as Error).message });
  }
});

export default router;
