import { describe, it, expect } from "vitest";
import { tokenHash, verifyToken, extractToken } from "../../src/lib/auth.js";

describe("auth", () => {
  it("verifyToken accepts a token whose hash matches", () => {
    const t = "abc123";
    expect(verifyToken(t, tokenHash(t))).toBe(true);
  });
  it("verifyToken rejects wrong / missing token or hash", () => {
    expect(verifyToken("wrong", tokenHash("abc123"))).toBe(false);
    expect(verifyToken(undefined, tokenHash("abc123"))).toBe(false);
    expect(verifyToken("abc123", undefined)).toBe(false);
  });
  it("extractToken reads the x-backchannel-token header", () => {
    expect(extractToken({ headers: { "x-backchannel-token": "tok" } })).toBe("tok");
    expect(extractToken({ headers: {} })).toBeUndefined();
    expect(extractToken({})).toBeUndefined();
  });
});
