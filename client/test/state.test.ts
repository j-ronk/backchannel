import { describe, it, expect, afterEach } from "vitest";
import { statSync, rmSync } from "node:fs";
import { readState, writeState, clearState, statePath, RoomState } from "../src/state.js";

const cwd = "/tmp/backchannel-test-proj";
const sample: RoomState = { roomId: "r", secret: "s", cursor: 0, displayName: "jay", relayUrl: "https://x", owner: true, authorTag: "tag", status: "active", sharePolicy: "share stuff", pendingCatchup: true };
afterEach(() => { try { rmSync(statePath(cwd)); } catch {} });

describe("state", () => {
  it("write then read roundtrips", () => {
    writeState(cwd, sample);
    expect(readState(cwd)).toEqual(sample);
  });
  it("file is mode 0600", () => {
    writeState(cwd, sample);
    expect(statSync(statePath(cwd)).mode & 0o777).toBe(0o600);
  });
  it("readState returns null when absent", () => {
    clearState(cwd);
    expect(readState(cwd)).toBeNull();
  });
});
