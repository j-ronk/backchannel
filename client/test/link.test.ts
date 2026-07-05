import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { buildLink, parseLink } from "../src/link.js";

describe("link", () => {
  it("buildLink → parseLink roundtrips", () => {
    const secret = randomBytes(32);
    const link = buildLink("https://relay.example.com", "ROOM123", secret);
    expect(link).toBe(`https://relay.example.com/r/ROOM123#k=${secret.toString("base64url")}`);
    const p = parseLink(link);
    expect(p.relayUrl).toBe("https://relay.example.com");
    expect(p.roomId).toBe("ROOM123");
    expect(p.secret.equals(secret)).toBe(true);
  });
  it("parseLink throws on a malformed link", () => {
    expect(() => parseLink("https://relay.example.com/r/ROOM123")).toThrow();
  });
  it("buildLink with fromName adds ?from before the #k fragment and round-trips", () => {
    const secret = Buffer.alloc(32, 1);
    const link = buildLink("https://relay", "ROOM1", secret, "jay ronk");
    expect(link).toBe(`https://relay/r/ROOM1?from=jay%20ronk#k=${secret.toString("base64url")}`);
    const p = parseLink(link); // query string must not break parsing
    expect(p.roomId).toBe("ROOM1");
    expect(p.secret.equals(secret)).toBe(true);
  });

  it("buildLink without fromName is unchanged (no ?from)", () => {
    const secret = Buffer.alloc(32, 2);
    const link = buildLink("https://relay", "ROOM2", secret);
    expect(link).toBe(`https://relay/r/ROOM2#k=${secret.toString("base64url")}`);
    expect(link).not.toContain("?from");
  });
});
