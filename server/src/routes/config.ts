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

// Update a saved search (cron, earliest, latest)
router.post("/saved-search/update", async (req, res) => {
  try {
    const { name, app, owner, updates } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const ownerPath = owner || "-";
    const appPath = app || "-";
    // First, get current state to preserve it
    const getUrl = `/servicesNS/${encodeURIComponent(ownerPath)}/${encodeURIComponent(appPath)}/saved/searches/${encodeURIComponent(name)}?output_mode=json`;
    const current = await splunkFetch(getUrl);
    const currentContent = current?.entry?.[0]?.content || {};

    const body = new URLSearchParams();
    // Preserve current scheduling state — normalize booleans to Splunk's expected "1"/"0"
    const isScheduled = currentContent.is_scheduled === true || currentContent.is_scheduled === "1" || currentContent.is_scheduled === 1;
    const isDisabled = currentContent.disabled === true || currentContent.disabled === "1" || currentContent.disabled === 1;
    body.set("is_scheduled", isScheduled ? "1" : "0");
    body.set("disabled", isDisabled ? "1" : "0");
    // Preserve the search itself
    if (currentContent.search) body.set("search", currentContent.search);

    // Apply all user's changes — always send even if same value
    if (updates.cron_schedule !== undefined) body.set("cron_schedule", updates.cron_schedule);
    if (updates["dispatch.earliest_time"] !== undefined) body.set("dispatch.earliest_time", updates["dispatch.earliest_time"]);
    if (updates["dispatch.latest_time"] !== undefined) body.set("dispatch.latest_time", updates["dispatch.latest_time"]);

    const postUrl = `/servicesNS/${encodeURIComponent(ownerPath)}/${encodeURIComponent(appPath)}/saved/searches/${encodeURIComponent(name)}?output_mode=json`;
    console.log(`[SavedSearch] POST ${postUrl}`);
    console.log(`[SavedSearch] Body: ${body.toString()}`);

    const url = postUrl;

    const data = await splunkFetch(url, {
      method: "POST",
      body: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    res.json({ status: "ok", message: `Updated ${name}`, data: data?.entry?.[0]?.content });
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
    // Support both /services/ and /servicesNS/ paths
    const prefix = path.startsWith("NS/") ? "/services" : "/services/";
    const url = `${prefix}${path}${separator}output_mode=json`;

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
