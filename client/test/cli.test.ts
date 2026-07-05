// client/test/cli.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { readState, clearState } from "../src/state.js";
import { deriveKeys, encrypt, decrypt } from "../src/crypto.js";

const CWD = "/tmp/backchannel-cli-test";
afterEach(() => { vi.restoreAllMocks(); clearState(CWD); });
function fetchOnce(status: number, body: any) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }) as any);
}

describe("cli", () => {
  it("start mints a room, writes state, prints a link", async () => {
    fetchOnce(201, { roomId: "ROOM9" });
    const { run } = await import("../src/cli.js");
    const r = await run(["start", "--name", "jay"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, "");
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain("https://relay/r/ROOM9#k=");
    const st = readState(CWD)!;
    expect(st.roomId).toBe("ROOM9");
    expect(st.owner).toBe(true);
    expect(st.displayName).toBe("jay");
  });

  it("start prints both a private link and a ?from personalized link", async () => {
    fetchOnce(201, { roomId: "ROOMBOTH" });
    const { run } = await import("../src/cli.js");
    const r = await run(["start", "--name", "Jay"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, "");
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain("https://relay/r/ROOMBOTH#k=");          // private link, no ?from
    expect(r.stdout).toContain("https://relay/r/ROOMBOTH?from=Jay#k="); // personalized link
  });

  it("start greets the room with a decryptable Hi that a joiner would see", async () => {
    const { run } = await import("../src/cli.js");
    const posted: any[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, init: any) => {
      if (String(url).includes("/events")) { posted.push(JSON.parse(init.body)); return new Response(JSON.stringify({ seq: 1 }), { status: 200 }) as any; }
      return new Response(JSON.stringify({ roomId: "ROOMHI" }), { status: 201 }) as any; // create
    });
    const r = await run(["start", "--name", "apple"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, "");
    expect(r.exit).toBe(0);
    expect(posted.length).toBe(1); // exactly one greeting posted
    const st = readState(CWD)!;
    const { encKey } = deriveKeys(Buffer.from(st.secret, "base64url"));
    const ev = JSON.parse(decrypt(posted[0].payload, encKey)); // relay only ever holds ciphertext
    expect(ev.kind).toBe("share");
    expect(ev.author).toBe("apple");
    expect(ev.text).toContain("Hi");
  });

  it("start still prints the links if the greeting fails to post (fail-open)", async () => {
    const { run } = await import("../src/cli.js");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (String(url).includes("/events")) throw new Error("relay down");
      return new Response(JSON.stringify({ roomId: "ROOMF" }), { status: 201 }) as any;
    });
    const r = await run(["start", "--name", "jay"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, "");
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain("https://relay/r/ROOMF#k=");
  });

  it("prints usage for no command, help, and --help", async () => {
    const { run } = await import("../src/cli.js");
    for (const a of [[] as string[], ["help"], ["--help"]]) {
      const r = await run(a, {} as any, "");
      expect(r.exit).toBe(0);
      expect(r.stdout).toContain("Usage: backchannel");
      expect(r.stdout).toContain("start");
      expect(r.stdout).toContain("join");
    }
  });

  it("hook injects decrypted events wrapped in the safety preamble and advances cursor", async () => {
    // seed state by joining a known link
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 7);
    const link = `https://relay/r/ROOMX#k=${secret.toString("base64url")}`;
    await run(["join", link, "--name", "ali"], { PWD: CWD } as any, "");
    const { encKey } = deriveKeys(secret);
    const payload = encrypt(JSON.stringify({ author: "bob", kind: "finding", text: "db is down", ts: "t" }), encKey);
    fetchOnce(200, { events: [{ seq: 1, author: "tag", ts: "t", type: "finding", payload }], cursor: 1 });
    const stdinJson = JSON.stringify({ cwd: CWD });
    const r = await run(["hook"], {} as any, stdinJson);
    expect(r.exit).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.additionalContext).toContain("observations reported by other participants");
    expect(out.hookSpecificOutput.additionalContext).toContain("db is down");
    expect(out.hookSpecificOutput.additionalContext).toContain("bob");
    expect(readState(CWD)!.cursor).toBe(1);
  });

  it("hook does NOT echo our own posts back, but still advances the cursor", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 9);
    const link = `https://relay/r/ROOMZ#k=${secret.toString("base64url")}`;
    await run(["join", link, "--name", "me"], { PWD: CWD } as any, "");
    const myTag = readState(CWD)!.authorTag;
    const { encKey } = deriveKeys(secret);
    const mine = encrypt(JSON.stringify({ author: "me", kind: "finding", text: "my own note", ts: "t" }), encKey);
    fetchOnce(200, { events: [{ seq: 1, author: myTag, ts: "t", type: "finding", payload: mine }], cursor: 1 });
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    expect(r.exit).toBe(0);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).not.toContain("my own note"); // our own message is still filtered out — not echoed back
    expect(ctx).not.toContain("observations reported by other participants"); // no observation block (nothing to show)
    expect(ctx).toContain("[[backchannel broadcast]]"); // but the standing send directive is always injected
    expect(readState(CWD)!.cursor).toBe(1); // cursor still advances past our own post
  });

  it("hook with no active room emits empty and exits 0", async () => {
    clearState(CWD);
    const { run } = await import("../src/cli.js");
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    expect(r.exit).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("share command is removed (unknown command)", async () => {
    const { run } = await import("../src/cli.js");
    const r = await run(["share", "hi"], { PWD: CWD } as any, "");
    expect(r.exit).toBe(1);
    expect(r.stdout).toContain("unknown command");
  });

  it("start sets default policy and pendingCatchup=true; --policy overrides", async () => {
    fetchOnce(201, { roomId: "ROOMP" });
    const { run } = await import("../src/cli.js");
    await run(["start", "--name", "A", "--policy", "share auth only"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, "");
    const st = readState(CWD)!;
    expect(st.sharePolicy).toBe("share auth only");
    expect(st.pendingCatchup).toBe(true);
  });

  it("join sets default policy and pendingCatchup=false", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 3);
    await run(["join", `https://relay/r/ROOMJ#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    const st = readState(CWD)!;
    expect(st.sharePolicy.length).toBeGreaterThan(0);
    expect(st.pendingCatchup).toBe(false);
  });

  it("policy subcommand updates the policy; summary sets pendingCatchup", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 4);
    await run(["join", `https://relay/r/ROOMK#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    await run(["policy", "share", "only", "tests"], { PWD: CWD } as any, "");
    expect(readState(CWD)!.sharePolicy).toBe("share only tests");
    await run(["summary"], { PWD: CWD } as any, "");
    expect(readState(CWD)!.pendingCatchup).toBe(true);
  });

  it("hook injects the sending directive (policy + marker instruction) even with no new events", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 6);
    await run(["join", `https://relay/r/ROOMD#k=${secret.toString("base64url")}`, "--name", "B", "--policy", "share the auth work"], { PWD: CWD } as any, "");
    fetchOnce(200, { events: [], cursor: 0 });
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain("[[backchannel broadcast]]");
    expect(ctx).toContain("share the auth work");
  });

  it("hook directive asks for a catch-up summary when pendingCatchup is set", async () => {
    fetchOnce(201, { roomId: "ROOMC" });
    const { run } = await import("../src/cli.js");
    await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, ""); // start sets pendingCatchup
    vi.restoreAllMocks();
    fetchOnce(200, { events: [], cursor: 0 });
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx.toLowerCase()).toContain("catch");
  });

  it("hook fails open when the relay read throws — still injects the directive, exit 0", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 8);
    await run(["join", `https://relay/r/ROOMF#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    expect(r.exit).toBe(0);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain("[[backchannel broadcast]]"); // directive still injected despite the read failure
  });

  it("hook does not advance the cursor when the relay returns no events", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 10);
    await run(["join", `https://relay/r/ROOMG#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    expect(readState(CWD)!.cursor).toBe(0);
    fetchOnce(200, { events: [], cursor: 9 });
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    expect(r.exit).toBe(0);
    expect(readState(CWD)!.cursor).toBe(0); // empty response → nothing to advance past
  });

  it("onstop extracts the [[backchannel broadcast]] line from the transcript and posts it; clears pendingCatchup", async () => {
    fetchOnce(201, { roomId: "ROOMS" });
    const { run } = await import("../src/cli.js");
    await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, ""); // pendingCatchup=true
    expect(readState(CWD)!.pendingCatchup).toBe(true);
    vi.restoreAllMocks();
    const tp = "/tmp/backchannel-onstop-test.jsonl";
    writeFileSync(tp, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "did work\n[[backchannel broadcast]] fixed the token check" }] } }));
    const post = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ seq: 1, ts: "t" }), { status: 200 }) as any);
    const r = await run(["onstop"], {} as any, JSON.stringify({ cwd: CWD, transcript_path: tp }));
    expect(r.exit).toBe(0);
    expect(post).toHaveBeenCalledTimes(1);
    const body = JSON.parse((post.mock.calls[0][1] as any).body);
    expect(body.type).toBe("finding");        // top-level type unchanged
    expect(typeof body.payload).toBe("string"); // encrypted, not plaintext
    expect(JSON.stringify(body)).not.toContain("fixed the token check"); // plaintext not leaked
    expect(readState(CWD)!.pendingCatchup).toBe(false); // cleared
    rmSync(tp);
  });

  it("onstop posts nothing when the transcript has no marker", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 8);
    await run(["join", `https://relay/r/ROOMN#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    const tp = "/tmp/backchannel-onstop-none.jsonl";
    writeFileSync(tp, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "just talking, nothing to share" }] } }));
    const post = vi.spyOn(globalThis, "fetch");
    const r = await run(["onstop"], {} as any, JSON.stringify({ cwd: CWD, transcript_path: tp }));
    expect(r.exit).toBe(0);
    expect(post).not.toHaveBeenCalled();
    rmSync(tp);
  });

  it("onstop does NOT clear pendingCatchup when the post fails (fail-open, catch-up retries)", async () => {
    fetchOnce(201, { roomId: "ROOMQ" });
    const { run } = await import("../src/cli.js");
    await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, ""); // pendingCatchup=true
    expect(readState(CWD)!.pendingCatchup).toBe(true);
    const tp = "/tmp/backchannel-onstop-fail.jsonl";
    writeFileSync(tp, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "did work\n[[backchannel broadcast]] catch-up summary line" }] } }));
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("relay down"));
    const r = await run(["onstop"], {} as any, JSON.stringify({ cwd: CWD, transcript_path: tp }));
    expect(r.exit).toBe(0); // still fail-open — never disrupts the turn
    expect(readState(CWD)!.pendingCatchup).toBe(true); // NOT cleared — catch-up will retry on the next stop
    rmSync(tp);
  });

  it("start requires a display name (no name → exit 1, no room created)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { run } = await import("../src/cli.js");
    const r = await run(["start"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD } as any, "");
    expect(r.exit).toBe(1);
    expect(r.stdout.toLowerCase()).toContain("display name");
    expect(fetchSpy).not.toHaveBeenCalled(); // bailed before creating a room
    expect(readState(CWD)).toBeNull();
  });

  it("join requires a display name (no name → exit 1)", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 2);
    const r = await run(["join", `https://relay/r/ROOMNN#k=${secret.toString("base64url")}`], { PWD: CWD } as any, "");
    expect(r.exit).toBe(1);
    expect(r.stdout.toLowerCase()).toContain("display name");
    expect(readState(CWD)).toBeNull();
  });

  it("onstop exits 0 with no active room", async () => {
    clearState(CWD);
    const { run } = await import("../src/cli.js");
    const r = await run(["onstop"], {} as any, JSON.stringify({ cwd: CWD, transcript_path: "/tmp/none.jsonl" }));
    expect(r.exit).toBe(0);
  });

  // Regression: state must be keyed by the stable session id, not cwd. The original cwd-keying
  // broke sharing because the cwd handed to hooks drifts within a session (read-hook at turn
  // start vs Stop hook at turn end saw different dirs), so a session resolved different/no state.
  it("keys state by session_id so a cwd change between turns still resolves the same room", async () => {
    fetchOnce(201, { roomId: "ROOMSID" });
    const { run } = await import("../src/cli.js");
    const SID = "sess-abc-123";
    await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: "/dir/one", CLAUDE_CODE_SESSION_ID: SID } as any, "");
    expect(readState(SID)!.roomId).toBe("ROOMSID"); // keyed by session id
    expect(readState("/dir/one")).toBeNull();        // NOT keyed by cwd
    // a later hook with the SAME session id but a DIFFERENT cwd still finds the room
    fetchOnce(200, { events: [], cursor: 0 });
    const r = await run(["hook"], {} as any, JSON.stringify({ session_id: SID, cwd: "/dir/TWO-different" }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain("[[backchannel broadcast]]"); // directive injected → room resolved despite cwd change
    clearState(SID);
  });

  it("onstop extracts the marker from last_assistant_message (no transcript file needed)", async () => {
    fetchOnce(201, { roomId: "ROOMLAM" });
    const { run } = await import("../src/cli.js");
    const SID = "sess-lam-1";
    await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: "https://relay", PWD: CWD, CLAUDE_CODE_SESSION_ID: SID } as any, "");
    vi.restoreAllMocks();
    const post = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ seq: 1, ts: "t" }), { status: 200 }) as any);
    const stdin = JSON.stringify({ session_id: SID, last_assistant_message: "did work\n[[backchannel broadcast]] from last_assistant_message", transcript_path: "/nonexistent.jsonl" });
    const r = await run(["onstop"], {} as any, stdin);
    expect(r.exit).toBe(0);
    expect(post).toHaveBeenCalledTimes(1);
    const body = JSON.parse((post.mock.calls[0][1] as any).body);
    expect(body.type).toBe("finding");
    expect(JSON.stringify(body)).not.toContain("from last_assistant_message"); // encrypted, not plaintext
    clearState(SID);
  });

  it("hook stops sharing when the read returns 401 (room gone/expired)", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 12);
    await run(["join", `https://relay/r/ROOMGONE#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    fetchOnce(401, { error: "unauthorized" }); // relay no longer recognizes the token → room gone
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain("has closed");     // one-time close note delivered
    expect(ctx).not.toContain("[[backchannel broadcast]]"); // send directive NOT injected
    expect(readState(CWD)!.status).toBe("ended");
  });

  it("hook still fails open on a transient (non-gone) error — keeps the directive", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 13);
    await run(["join", `https://relay/r/ROOMBLIP#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down")); // no .status → transient
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain("[[backchannel broadcast]]");        // directive still injected
    expect(readState(CWD)!.status).toBe("active"); // NOT flipped off on a transient error
  });

  it("hook stops sharing when the relay reports the room is closed", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 11);
    await run(["join", `https://relay/r/ROOMDEAD#k=${secret.toString("base64url")}`, "--name", "B"], { PWD: CWD } as any, "");
    fetchOnce(200, { events: [], cursor: 0, status: "closed" });
    const r = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain("has closed");     // one-time close note delivered
    expect(ctx).not.toContain("[[backchannel broadcast]]"); // send directive NOT injected
    expect(readState(CWD)!.status).toBe("ended"); // local state flipped off
    // next turn: early-return on the ended state — no relay call, empty output
    vi.restoreAllMocks();
    const spy = vi.spyOn(globalThis, "fetch");
    const r2 = await run(["hook"], {} as any, JSON.stringify({ cwd: CWD }));
    expect(r2.stdout).toBe("");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("status", () => {
  const DIR = "/tmp/backchannel-status-test";
  beforeEach(() => { process.env.BACKCHANNEL_STATE_DIR = DIR; rmSync(DIR, { recursive: true, force: true }); });
  afterEach(() => { vi.restoreAllMocks(); rmSync(DIR, { recursive: true, force: true }); delete process.env.BACKCHANNEL_STATE_DIR; });

  it("reports no rooms when there are none", async () => {
    const { run } = await import("../src/cli.js");
    const r = await run(["status"], {} as any, "");
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain("No backchannel rooms");
  });

  it("lists a room with its live status", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 3);
    await run(["join", `https://relay/r/ROOMLIVE#k=${secret.toString("base64url")}`, "--name", "Lister"], { PWD: "/somewd" } as any, "");
    fetchOnce(200, { events: [], cursor: 0, status: "open" });
    const r = await run(["status"], {} as any, "");
    expect(r.stdout).toContain("Lister");
    expect(r.stdout).toContain("ROOMLIVE");
    expect(r.stdout).toContain("open");
  });

  it("marks a room gone when the relay 401s", async () => {
    const { run } = await import("../src/cli.js");
    const secret = Buffer.alloc(32, 4);
    await run(["join", `https://relay/r/ROOMX#k=${secret.toString("base64url")}`, "--name", "Gonezo"], { PWD: "/somewd2" } as any, "");
    fetchOnce(401, { error: "unauthorized" });
    const r = await run(["status"], {} as any, "");
    expect(r.stdout).toContain("Gonezo");
    expect(r.stdout).toContain("gone");
  });
});

describe("doctor", () => {
  const DDIR = "/tmp/backchannel-doctor-test";
  it("reports reach OK (any HTTP response) and exits 0 without mutating config", async () => {
    const { run } = await import("../src/cli.js");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 })); // 404 still proves reachability
    const r = await run(["doctor"], { BACKCHANNEL_RELAY_URL: "https://relay.example.test", BACKCHANNEL_STATE_DIR: DDIR } as any, "");
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain("node");
    expect(r.stdout).toContain("relay.example.test");
    expect(r.stdout).toContain("reach relay.example.test: OK");
    expect(r.stdout).not.toContain("BLOCKED");
  });
  it("reports BLOCKED with the fix snippet when the relay cannot be reached", async () => {
    const { run } = await import("../src/cli.js");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sandbox blocked"));
    const r = await run(["doctor"], { BACKCHANNEL_RELAY_URL: "https://relay.example.test", BACKCHANNEL_STATE_DIR: DDIR } as any, "");
    expect(r.exit).toBe(0);
    expect(r.stdout).toContain("reach relay.example.test: BLOCKED");
    expect(r.stdout).toContain('"allowedDomains":["*.example.test"]'); // wildcard suggestion derived from host
  });
});
