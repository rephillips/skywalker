import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SALT = "skywalker-salt-v1";

function deriveKey(masterKey: string): Buffer {
  return scryptSync(masterKey, SALT, 32);
}

/**
 * Encrypt a plaintext value. Returns "enc:iv:authTag:ciphertext" format.
 */
export function encrypt(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a value in "enc:iv:authTag:ciphertext" format.
 * Returns null if the value is not encrypted (no "enc:" prefix).
 */
export function decrypt(value: string, masterKey: string): string | null {
  if (!value.startsWith("enc:")) return null;
  const parts = value.split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted format");
  const [, ivHex, authTagHex, ciphertext] = parts;
  const key = deriveKey(masterKey);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Decrypt if encrypted, otherwise return as-is.
 */
export function decryptIfNeeded(value: string, masterKey: string): string {
  if (!value || !value.startsWith("enc:")) return value;
  try {
    return decrypt(value, masterKey) || value;
  } catch (err) {
    console.error("[Crypto] Failed to decrypt value — using as plaintext:", (err as Error).message);
    return value;
  }
}
