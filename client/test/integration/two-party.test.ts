// client/test/integration/two-party.test.ts
import { describe, it, expect } from "vitest";
import { run } from "../../src/cli.js";
import { readState, clearState } from "../../src/state.js";
const relay = process.env.BACKCHANNEL_RELAY_URL;
const A = "/tmp/backchannel-itest-A", B = "/tmp/backchannel-itest-B";

describe.skipIf(!relay)("two-party live", () => {
  it("adversarial: a tampered access token is rejected by the relay (post never lands)", async () => {
    const { writeFileSync, rmSync } = await import("node:fs");
    clearState(A); clearState(B);
    const start = await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: relay, PWD: A } as any, "");
    const link = start.stdout.split("\n").pop()!.trim();
    await run(["join", link, "--name", "B"], { PWD: B } as any, "");

    // tamper A's stored secret → A's derived access token no longer matches the relay's stored hash
    const st = readState(A)!;
    const { writeState } = await import("../../src/state.js");
    writeState(A, { ...st, secret: Buffer.alloc(32, 1).toString("base64url") });

    // A's onstop tries to post a marker; the relay 401s the wrong token. onstop is fail-open → exit 0, nothing stored.
    const tp = "/tmp/backchannel-itest-bad.jsonl";
    writeFileSync(tp, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "[[backchannel broadcast]] TAMPER_SENTINEL must not arrive" }] } }));
    const bad = await run(["onstop"], {} as any, JSON.stringify({ cwd: A, transcript_path: tp }));
    expect(bad.exit).toBe(0); // fail-open: a rejected post never disrupts the turn

    // B (legit token) reads: the rejected post must NOT have landed in the room
    const hook = await run(["hook"], {} as any, JSON.stringify({ cwd: B }));
    expect(JSON.parse(hook.stdout).hookSpecificOutput.additionalContext).not.toContain("TAMPER_SENTINEL");
    rmSync(tp);
  }, 30000);

  it("auto-share: A's onstop posts a marker line; B's hook injects it", async () => {
    const { run } = await import("../../src/cli.js");
    const { writeFileSync, rmSync } = await import("node:fs");
    const AS = "/tmp/backchannel-as-A", BS = "/tmp/backchannel-as-B";
    const { clearState } = await import("../../src/state.js");
    clearState(AS); clearState(BS);
    const start = await run(["start", "--name", "A"], { BACKCHANNEL_RELAY_URL: relay, PWD: AS } as any, "");
    const link = start.stdout.split("\n").pop()!.trim();
    await run(["join", link, "--name", "B"], { PWD: BS } as any, "");
    const tp = "/tmp/backchannel-as-tp.jsonl";
    writeFileSync(tp, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "[[backchannel broadcast]] auto-share works" }] } }));
    await run(["onstop"], {} as any, JSON.stringify({ cwd: AS, transcript_path: tp }));
    const hook = await run(["hook"], {} as any, JSON.stringify({ cwd: BS }));
    expect(JSON.parse(hook.stdout).hookSpecificOutput.additionalContext).toContain("auto-share works");
    rmSync(tp);
  }, 30000);
});
