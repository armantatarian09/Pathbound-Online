import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const serverDist = path.join(rootDir, "apps", "server", "dist", "index.js");

try {
  if (!existsSync(serverDist)) {
    console.error("[bootstrap] Missing apps/server/dist/index.js.");
    console.error("[bootstrap] Ensure build step runs: npm run build");
    process.exit(1);
  }

  await import(pathToFileURL(serverDist).href);
} catch (error) {
  console.error("[bootstrap] Failed to start application.");
  console.error(error);
  process.exit(1);
}
