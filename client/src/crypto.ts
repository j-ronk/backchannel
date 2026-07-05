import { hkdfSync, createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function hkdf(secret: Buffer, info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, Buffer.from("backchannel-v1", "utf8"), Buffer.from(info, "utf8"), 32));
}

export function deriveKeys(secret: Buffer): { encKey: Buffer; accessToken: string } {
  return {
    encKey: hkdf(secret, "backchannel-v1-enc"),
    accessToken: hkdf(secret, "backchannel-v1-access").toString("base64url"),
  };
}

export function accessHash(accessToken: string): string {
  return createHash("sha256").update(accessToken, "utf8").digest("base64url");
}

export function encrypt(plaintext: string, encKey: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64url");
}

export function decrypt(payloadB64: string, encKey: Buffer): string | null {
  try {
    const buf = Buffer.from(payloadB64, "base64url");
    if (buf.length < 12 + 16) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ct = buf.subarray(12, buf.length - 16);
    const d = createDecipheriv("aes-256-gcm", encKey, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch { return null; }
}
