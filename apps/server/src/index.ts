import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom.js";

const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", room: "arena" });
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distCandidates = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "apps/client/dist"),
  path.resolve(currentDir, "../../client/dist"),
  path.resolve(currentDir, "../../../dist"),
];
const clientDist = distCandidates.find((candidate) => existsSync(candidate));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!health).*/, (req, res, next) => {
    if (req.path.startsWith("/colyseus")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("arena", ArenaRoom);

httpServer.listen(port, host, () => {
  console.log(`[server] Pathbound Online listening at http://${host}:${port}`);
  if (clientDist) {
    console.log(`[server] Serving client build from ${clientDist}`);
  }
});

process.on("SIGTERM", () => {
  httpServer.close();
});
