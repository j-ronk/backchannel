import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { lastAssistantText, extractShareMarker } from "../src/transcript.js";

const TP = process.env.TMPDIR ? `${process.env.TMPDIR}/backchannel-transcript-test.jsonl` : "/tmp/backchannel-transcript-test.jsonl";
afterEach(() => { try { rmSync(TP); } catch {} });

describe("extractShareMarker", () => {
  it("returns the last non-empty [[backchannel]] line, trimmed", () => {
    expect(extractShareMarker("hello\n[[backchannel]] first\nmore\n[[backchannel]]  second note ")).toBe("second note");
  });
  it("returns null when no marker / only empty marker", () => {
    expect(extractShareMarker("no marker here")).toBeNull();
    expect(extractShareMarker("[[backchannel]]   ")).toBeNull();
  });
});

describe("lastAssistantText", () => {
  it("returns the last assistant message's text, joining text blocks, skipping tool_use", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "earlier" }] } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Edit" }, { type: "text", text: "done [[backchannel]] fixed it" }] } }),
    ].join("\n");
    writeFileSync(TP, lines);
    expect(lastAssistantText(TP)).toBe("done [[backchannel]] fixed it");
  });
  it("scans back past tool-use-only assistant turns to find text", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "found it [[backchannel]] fixed the bug" }] } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Edit" }] } }),
    ].join("\n");
    writeFileSync(TP, lines);
    expect(lastAssistantText(TP)).toBe("found it [[backchannel]] fixed the bug");
  });
  it("returns empty string for a missing file or all-malformed lines", () => {
    expect(lastAssistantText("/tmp/does-not-exist-xyz.jsonl")).toBe("");
    writeFileSync(TP, "not json\n{bad");
    expect(lastAssistantText(TP)).toBe("");
  });
});
