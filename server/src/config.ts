import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { decryptIfNeeded } from "./crypto.js";
import { promptSecret } from "./prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  splunk: {
    baseUrl: process.env.SPLUNK_BASE_URL || "https://127.0.0.1:8089",
    webUrl: process.env.SPLUNK_WEB_URL || "",
    username: process.env.SPLUNK_USERNAME || "admin",
    password: process.env.SPLUNK_PASSWORD || "changeme",
    token: process.env.SPLUNK_TOKEN || "",
  },
};

/**
 * If encrypted values exist in .env, prompt for master key and decrypt.
 * Called once at startup before the server starts listening.
 */
export async function initConfig(): Promise<void> {
  const hasEncrypted =
    (process.env.SPLUNK_TOKEN || "").startsWith("enc:") ||
    (process.env.SPLUNK_PASSWORD || "").startsWith("enc:");

  if (!hasEncrypted) return;

  console.log("\n🔒 Encrypted credentials detected in .env");
  const masterKey = await promptSecret("   Enter master key: ");

  if (!masterKey) {
    console.log("⚠️  No master key provided — encrypted values will not be decrypted");
    return;
  }

  try {
    if ((process.env.SPLUNK_TOKEN || "").startsWith("enc:")) {
      config.splunk.token = decryptIfNeeded(process.env.SPLUNK_TOKEN!, masterKey);
      console.log("✅ Token decrypted successfully");
    }
    if ((process.env.SPLUNK_PASSWORD || "").startsWith("enc:")) {
      config.splunk.password = decryptIfNeeded(process.env.SPLUNK_PASSWORD!, masterKey);
      console.log("✅ Password decrypted successfully");
    }
  } catch (err) {
    console.error("❌ Decryption failed — wrong master key?", (err as Error).message);
    process.exit(1);
  }
}

/** Update Splunk config at runtime (from the Settings page) */
export function updateSplunkConfig(updates: {
  baseUrl?: string;
  username?: string;
  password?: string;
  token?: string;
}) {
  if (updates.baseUrl) config.splunk.baseUrl = updates.baseUrl;
  if (updates.username) config.splunk.username = updates.username;
  if (updates.password) config.splunk.password = updates.password;
  if (updates.token) config.splunk.token = updates.token;
}
