import { describe, it, expect } from "vitest";
import { handler } from "../src/handlers/landing.js";

const get = async (from?: string) =>
  handler({ pathParameters: { roomId: "ROOM" }, queryStringParameters: from === undefined ? null : { from } } as any);

describe("landing", () => {
  it("returns 200 text/html with a restrictive CSP", async () => {
    const r = await get();
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/html");
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(r.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("generic title when no ?from", async () => {
    const r = await get();
    expect(r.body).toContain("<title>You&#39;re invited to a shared AI coding session</title>");
    expect(r.body).not.toContain("wants to share");
  });

  it("personalized title when ?from is present", async () => {
    const r = await get("jay");
    expect(r.body).toContain("jay wants to share their AI coding session with you");
  });

  it("HTML-escapes a malicious ?from (no XSS)", async () => {
    const evil = '"><script>alert(1)</script>';
    const esc = "&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;";
    const r = await get(evil);
    expect(r.body).not.toContain("<script>alert(1)</script>");                 // raw injection absent
    expect(r.body).toContain(`<title>${esc} wants to share`);                  // <title> context
    expect(r.body).toContain(`property="og:title" content="${esc} wants to share`); // og:title attribute context
    expect(r.body).toContain(`${esc} invited you to collaborate`);             // <h1> headline context (escaped)
  });

  it("clamps an over-long ?from to 60 chars", async () => {
    const r = await get("x".repeat(200));
    expect(r.body).toContain("x".repeat(60) + " wants to share");
    expect(r.body).not.toContain("x".repeat(61));
  });

  it("links to install instructions and includes the join scaffold", async () => {
    const r = await get();
    expect(r.body).toContain('href="https://github.com/j-ronk/backchannel#backchannel"'); // generic install link, not tool-specific
    expect(r.body).not.toContain("/plugin install");                                       // no Claude-only install commands
    expect(r.body).toContain('id="join"');
    expect(r.body).toContain("location.hash"); // client assembles the key-bearing link
  });
});
