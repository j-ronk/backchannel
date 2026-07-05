import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from "node:fs";

export interface RoomState { roomId: string; secret: string; cursor: number; displayName: string; relayUrl: string; owner: boolean; authorTag: string; status: "active" | "ended"; sharePolicy: string; pendingCatchup: boolean; }

const dir = () => process.env.BACKCHANNEL_STATE_DIR || join(homedir(), ".backchannel");
export function statePath(cwd: string): string {
  return join(dir(), createHash("sha256").update(cwd, "utf8").digest("hex") + ".json");
}
export function writeState(cwd: string, s: RoomState): void {
  mkdirSync(dir(), { recursive: true, mode: 0o700 });
  writeFileSync(statePath(cwd), JSON.stringify(s), { mode: 0o600 });
}
export function readState(cwd: string): RoomState | null {
  try { return JSON.parse(readFileSync(statePath(cwd), "utf8")) as RoomState; } catch { return null; }
}
export function clearState(cwd: string): void {
  try { rmSync(statePath(cwd)); } catch {}
}
// Every room-state file this machine has (one per session that started/joined a room).
// Used by `backchannel status`. Tolerates a missing dir and unparseable files.
export function listStates(): RoomState[] {
  let files: string[];
  try { files = readdirSync(dir()).filter((f) => f.endsWith(".json")); } catch { return []; }
  const out: RoomState[] = [];
  for (const f of files) {
    try { out.push(JSON.parse(readFileSync(join(dir(), f), "utf8")) as RoomState); } catch {}
  }
  return out;
}
