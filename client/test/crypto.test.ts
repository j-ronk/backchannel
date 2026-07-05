import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { deriveKeys, accessHash, encrypt, decrypt } from "../src/crypto.js";

describe("crypto", () => {
  const secret = randomBytes(32);
  it("encrypt→decrypt roundtrips", () => {
    const { encKey } = deriveKeys(secret);
    const ct = encrypt("hello world", encKey);
    expect(decrypt(ct, encKey)).toBe("hello world");
  });
  it("decrypt returns null on tamper or wrong key", () => {
    const { encKey } = deriveKeys(secret);
    const ct = encrypt("secret", encKey);
    const tampered = ct.slice(0, -2) + (ct.endsWith("A") ? "B" : "A");
    expect(decrypt(tampered, encKey)).toBeNull();
    const { encKey: other } = deriveKeys(randomBytes(32));
    expect(decrypt(ct, other)).toBeNull();
  });
  it("different secrets yield different keys; enc and access are domain-separated", () => {
    const a = deriveKeys(secret);
    const b = deriveKeys(randomBytes(32));
    expect(a.accessToken).not.toBe(b.accessToken);              // unique per secret
    expect(a.encKey.toString("hex")).not.toBe(Buffer.from(a.accessToken, "base64url").toString("hex")); // enc != access
  });
  it("accessHash is stable base64url of sha256", () => {
    expect(accessHash("tok")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(accessHash("tok")).toBe(accessHash("tok"));
  });
  it("accessHash golden vector pins the client↔server hash contract", () => {
    expect(accessHash("backchannel-test-vector")).toBe("r-Pn9BYCf2xfxBAM-UAQyFsO243MsK2lG45Eruysyqs");
  });
});
