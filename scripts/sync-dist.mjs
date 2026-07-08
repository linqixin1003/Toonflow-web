import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const targetDir = resolve(process.env.TOONFLOW_APP_DIR || resolve(root, "../toonflow"), "data/web");

if (!existsSync(distDir)) {
  console.error("[sync-dist] dist/ not found — run yarn build first");
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true, force: true });
console.log(`[sync-dist] copied ${distDir} -> ${targetDir}`);
