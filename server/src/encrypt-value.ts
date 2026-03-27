#!/usr/bin/env tsx
/**
 * CLI to encrypt sensitive values for .env
 *
 * Usage:
 *   npx tsx src/encrypt-value.ts <master-key> <value-to-encrypt>
 *
 * Example:
 *   npx tsx src/encrypt-value.ts my-secret-key "eyJraWQ..."
 *
 * Then paste the output into .env:
 *   SPLUNK_TOKEN=enc:ab12...:cd34...:ef56...
 */

import { encrypt } from "./crypto.js";

const [, , masterKey, value] = process.argv;

if (!masterKey || !value) {
  console.log("Usage: npx tsx src/encrypt-value.ts <master-key> <value>");
  console.log("");
  console.log("Example:");
  console.log('  npx tsx src/encrypt-value.ts my-secret-key "eyJraWQ..."');
  console.log("");
  console.log("Then set in .env:");
  console.log("  SPLUNK_TOKEN=enc:...");
  console.log("  MASTER_KEY=my-secret-key");
  process.exit(1);
}

const encrypted = encrypt(value, masterKey);
console.log("");
console.log("Encrypted value:");
console.log(encrypted);
console.log("");
console.log("Add to .env:");
console.log(`SPLUNK_TOKEN=${encrypted}`);
console.log(`MASTER_KEY=${masterKey}`);
