import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  splunk: {
    baseUrl: process.env.SPLUNK_BASE_URL || "https://127.0.0.1:8089",
    username: process.env.SPLUNK_USERNAME || "admin",
    password: process.env.SPLUNK_PASSWORD || "changeme",
    token: process.env.SPLUNK_TOKEN || "",
  },
};

/** Update Splunk config at runtime (from the Settings page) */
export function updateSplunkConfig(updates: {
  baseUrl?: string;
  username?: string;
  password?: string;
  token?: string;
}) {
  if (updates.baseUrl) config.splunk.baseUrl = updates.baseUrl;
  if (updates.username) config.splunk.username = updates.username;
  if (updates.password !== undefined) config.splunk.password = updates.password;
  if (updates.token !== undefined) config.splunk.token = updates.token;
}
