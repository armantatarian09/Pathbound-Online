import express from "express";
import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArenaRoom } from "./rooms/ArenaRoom.js";

const port = Number(process.env.PORT ?? 2567);

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", room: "arena" });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("arena", ArenaRoom);

httpServer.listen(port, () => {
  console.log(`[server] Pathbound Online listening at http://localhost:${port}`);
});

process.on("SIGTERM", () => {
  httpServer.close();
});
