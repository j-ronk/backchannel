import { describe, it, expect, vi, afterEach } from "vitest";
import { apiCreateRoom, apiPostEvent, apiGetEvents } from "../src/api.js";

afterEach(() => vi.restoreAllMocks());
function stub(status: number, body: any) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }) as any);
}

describe("api", () => {
  it("apiCreateRoom posts accessAuthHash and returns roomId", async () => {
    const f = stub(201, { roomId: "R" });
    expect(await apiCreateRoom("https://relay", "HASH")).toBe("R");
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("https://relay/rooms");
    expect(JSON.parse(init.body)).toEqual({ accessAuthHash: "HASH" });
  });
  it("apiPostEvent sends the token header, not a query param", async () => {
    const f = stub(200, { seq: 1, ts: "t" });
    await apiPostEvent("https://relay", "R", "TOK", { author: "p", type: "finding", payload: "x" });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("https://relay/rooms/R/events");
    expect(init.headers["x-backchannel-token"]).toBe("TOK");
    expect(url).not.toContain("TOK");
  });
  it("apiGetEvents passes since and token", async () => {
    const f = stub(200, { events: [], cursor: 5 });
    const r = await apiGetEvents("https://relay", "R", "TOK", 5);
    expect(r.cursor).toBe(5);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("https://relay/rooms/R/events?since=5");
    expect(init.headers["x-backchannel-token"]).toBe("TOK");
  });
  it("throws with status on non-2xx", async () => {
    stub(401, { error: "unauthorized" });
    await expect(apiGetEvents("https://relay", "R", "bad", 0)).rejects.toThrow(/401/);
  });
});
