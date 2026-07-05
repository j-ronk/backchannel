import { build } from "esbuild";
await build({
  entryPoints: ["src/cli.ts"],
  bundle: true, platform: "node", target: "node20", format: "cjs",
  outfile: "dist/backchannel.cjs", banner: { js: "#!/usr/bin/env node" },
});
console.log("built dist/backchannel.cjs");
