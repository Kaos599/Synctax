/**
 * Build script: compiles the Synctax CLI to a Node.js-compatible JS bundle.
 *
 * What it does:
 *   1. Uses Bun's build API with target=node and an alias for react-devtools-core
 *      (Ink imports it at module level; it's a dev-only package not installed in
 *      production, so we stub it out so the bundle runs cleanly on Node.js)
 *   2. Strips the source shebang (#!/usr/bin/env bun) and prepends #!/usr/bin/env node
 *   3. Sets executable permissions (chmod +x)
 *
 * Usage: bun scripts/build.ts
 */

import { build } from "bun";
import { readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync, existsSync } from "fs";
import { join, resolve } from "path";

const outDir = "dist";
const outFile = join(outDir, "synctax.js");
const devtoolsStubDir = "node_modules/react-devtools-core";

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

// Ink's reconciler dynamically imports devtools.js (guarded by isDev()),
// which statically imports react-devtools-core. The real package is not
// installed. We inject a no-op stub into node_modules for the build only.
// bun install won't remove it because it is not in package.json.
const stubAlreadyExists = existsSync(devtoolsStubDir);
if (!stubAlreadyExists) {
  mkdirSync(devtoolsStubDir, { recursive: true });
  writeFileSync(
    join(devtoolsStubDir, "package.json"),
    JSON.stringify({ name: "react-devtools-core", version: "0.0.0", main: "index.js", type: "module" }),
  );
  writeFileSync(
    join(devtoolsStubDir, "index.js"),
    "export default { initialize: () => {}, connectToDevTools: () => {} };\n",
  );
}

console.log("Building Synctax for Node.js...");

const result = await build({
  entrypoints: ["./bin/synctax.ts"],
  outdir: outDir,
  target: "node",
  format: "esm",
  naming: "synctax.js",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Bun copies the source shebang (#!/usr/bin/env bun) into the output.
// Strip it, then prepend the Node.js shebang.
let built = readFileSync(outFile, "utf-8");
if (built.startsWith("#!")) {
  built = built.slice(built.indexOf("\n") + 1);
}
writeFileSync(outFile, `#!/usr/bin/env node\n${built}`);

// Make the file executable so npm's global install wires it up correctly
chmodSync(outFile, 0o755);

const sizeKb = Math.round(readFileSync(outFile).length / 1024);
console.log(`\n✓ Built ${outFile} (${sizeKb} KB, Node.js ≥18, self-contained)`);
console.log("  Verify: node dist/synctax.js --help");
