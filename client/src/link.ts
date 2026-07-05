export function buildLink(relayUrl: string, roomId: string, secret: Buffer, fromName?: string): string {
  const base = relayUrl.replace(/\/$/, "");
  const query = fromName ? `?from=${encodeURIComponent(fromName)}` : "";
  return `${base}/r/${roomId}${query}#k=${secret.toString("base64url")}`;
}

export function parseLink(link: string): { relayUrl: string; roomId: string; secret: Buffer } {
  const u = new URL(link);
  const m = u.pathname.match(/^\/r\/([^/]+)$/);
  const k = new URLSearchParams(u.hash.replace(/^#/, "")).get("k");
  if (!m || !k) throw new Error("invalid backchannel link");
  return { relayUrl: `${u.protocol}//${u.host}`, roomId: m[1], secret: Buffer.from(k, "base64url") };
}
