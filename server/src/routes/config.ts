import { Router } from "express";
import { config, updateSplunkConfig } from "../config.js";
import { splunkFetch } from "../services/splunkService.js";

const router = Router();

// Get current config (masks sensitive fields)
router.get("/config", (_req, res) => {
  // Derive web URL from base URL if not set (replace port 8089 with 8000)
  const webUrl = config.splunk.webUrl || config.splunk.baseUrl.replace(/:8089\b/, ":8000").replace(/^https/, "http");
  res.json({
    baseUrl: config.splunk.baseUrl,
    webUrl,
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

// Proxy any Splunk REST endpoint for testing from the Docs page
router.post("/proxy", async (req, res) => {
  try {
    const { path, method, body } = req.body;
    if (!path) {
      res.status(400).json({ error: "path is required" });
      return;
    }
    const separator = path.includes("?") ? "&" : "?";
    const url = `/services/${path}${separator}output_mode=json`;

    const options: RequestInit = { method: method || "GET" };
    if (body && method === "POST") {
      options.body = body;
      options.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    }

    const data = await splunkFetch(url, options);
    res.json({ status: "ok", data });
  } catch (err) {
    res.json({ status: "error", message: (err as Error).message });
  }
});

export default router;
