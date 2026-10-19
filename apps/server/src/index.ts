import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
import type { HealthStatus } from "@docssync/shared";

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  const body: HealthStatus = {
    status: "ok",
    service: "docssync-server",
    time: new Date().toISOString(),
  };
  res.json(body);
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

const port = Number(process.env.PORT ?? 4000);
const httpServer = createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "connected" }));
  socket.on("message", (data) => {
    socket.send(data);
  });
});

httpServer.listen(port, () => {
  console.log(`[docssync-server] listening on http://localhost:${port}`);
});
