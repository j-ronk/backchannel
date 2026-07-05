import { createHash, timingSafeEqual } from "node:crypto";

export function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function verifyToken(provided: string | undefined, storedHash: string | undefined): boolean {
  if (!provided || !storedHash) return false;
  const a = Buffer.from(tokenHash(provided));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function extractToken(evt: any): string | undefined {
  return evt?.headers?.["x-backchannel-token"];
}
