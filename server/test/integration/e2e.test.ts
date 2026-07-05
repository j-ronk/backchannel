// run with: BACKCHANNEL_URL=<ApiUrl> npx vitest run test/integration
import { it, expect, describe } from "vitest";
import { createHash } from "node:crypto";
const base = process.env.BACKCHANNEL_URL;
const TOKEN = "integration-test-token";
const HASH = createHash("sha256").update(TOKEN, "utf8").digest("base64url");
const H = { "x-backchannel-token": TOKEN };

describe.skipIf(!base)("e2e lifecycle", () => {
  it("create → post → read → close, with token auth", async () => {
    const { roomId } = await (await fetch(`${base}/rooms`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessAuthHash: HASH }),
    })).json();

    const post = await (await fetch(`${base}/rooms/${roomId}/events`, {
      method: "POST", headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ author: "p", type: "finding", payload: "ZW5j" }),
    })).json();
    expect(post.seq).toBe(1);

    const read = await (await fetch(`${base}/rooms/${roomId}/events?since=0`, { headers: H })).json();
    expect(read.events[0].payload).toBe("ZW5j");

    // wrong token rejected
    const bad = await fetch(`${base}/rooms/${roomId}/events?since=0`, { headers: { "x-backchannel-token": "nope" } });
    expect(bad.status).toBe(401);
    // no token rejected
    const none = await fetch(`${base}/rooms/${roomId}/events?since=0`);
    expect(none.status).toBe(401);

    expect((await fetch(`${base}/rooms/${roomId}/close`, { method: "POST", headers: H })).status).toBe(200);
  }, 30000);
});
