import { appendFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const serverDist = path.join(rootDir, "apps", "server", "dist", "index.js");
const runtimeLogFile = path.join(rootDir, "startup-error.log");
const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

let diagnosticStarted = false;

function serializeError(error) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

function writeRuntimeLog(error) {
  const body = `[${new Date().toISOString()}]\n${serializeError(error)}\n\n`;
  try {
    appendFileSync(runtimeLogFile, body, "utf8");
  } catch {
    // Ignore file logging failures.
  }
  console.error(body);
}

function startDiagnosticServer(error) {
  if (diagnosticStarted) {
    return;
  }
  diagnosticStarted = true;
  const message = serializeError(error);

  createServer((_req, res) => {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(
      [
        "Pathbound startup failed.",
        "",
        "This is temporary diagnostic output.",
        "Check startup-error.log in your deployment root.",
        "",
        message,
      ].join("\n"),
    );
  }).listen(port, host, () => {
    console.error(`[bootstrap] Diagnostic server active at http://${host}:${port}`);
  });
}

process.on("unhandledRejection", (reason) => {
  writeRuntimeLog(reason);
  startDiagnosticServer(reason);
});

process.on("uncaughtException", (error) => {
  writeRuntimeLog(error);
  startDiagnosticServer(error);
});

try {
  if (!existsSync(serverDist)) {
    const missingError = new Error("Missing apps/server/dist/index.js. Ensure build step runs: npm run build");
    writeRuntimeLog(missingError);
    startDiagnosticServer(missingError);
  } else {
    await import(pathToFileURL(serverDist).href);
  }
} catch (error) {
  writeRuntimeLog(error);
  startDiagnosticServer(error);
}
