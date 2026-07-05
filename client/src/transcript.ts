import { readFileSync } from "node:fs";

// Reads the Claude Code session transcript (JSONL) and returns the text of the
// most recent assistant message. Tolerant of unknown/extra fields and malformed
// lines. All transcript-shape assumptions live here.
export function lastAssistantText(transcriptPath: string): string {
  let raw: string;
  try {
    raw = readFileSync(transcriptPath, "utf8");
  } catch {
    return "";
  }
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry: any;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const msg = entry?.message ?? entry;
    const role = msg?.role ?? entry?.type;
    if (role !== "assistant") continue;
    const content = msg?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const text = content
        .filter((b: any) => b?.type === "text" && typeof b.text === "string")
        .map((b: any) => b.text)
        .join("\n");
      if (text) return text;
      continue;
    }
    continue;
  }
  return "";
}

// Returns the text of the LAST non-empty `[[backchannel]] …` line, trimmed, or null.
export function extractShareMarker(text: string): string | null {
  const re = /^[ \t]*\[\[backchannel\]\][ \t]?(.*)$/gm;
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = re.exec(text)) !== null) {
    const t = m[1].trim();
    if (t) last = t;
  }
  return last;
}
