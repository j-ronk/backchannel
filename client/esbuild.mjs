import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
await build({
  entryPoints: ["src/cli.ts"],
  bundle: true, platform: "node", target: "node20", format: "cjs",
  outfile: "dist/backchannel.cjs", banner: { js: "#!/usr/bin/env node" },
});
console.log("built dist/backchannel.cjs");
// Keep the Codex plugin's bundle in sync with the Claude Code one (same CLI, self-contained per plugin).
mkdirSync("../plugins/backchannel/dist", { recursive: true });
copyFileSync("dist/backchannel.cjs", "../plugins/backchannel/dist/backchannel.cjs");
console.log("synced plugins/backchannel/dist/backchannel.cjs");
