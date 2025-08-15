// server.js — serves the website + runs WebSocket signaling on the same domain
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static site from /web
app.use(express.static(path.join(__dirname, "web")));
app.get("/health", (_, res) => res.type("text").send("ok"));

const server = http.createServer(app);

// --- Minimal room-based signaling ---
const wss = new WebSocketServer({ server, path: "/socket" });
const rooms = new Map(); // code -> Set<ws>

function joinRoom(code, ws) {
  if (!rooms.has(code)) rooms.set(code, new Set());
  rooms.get(code).add(ws);
  ws._roomCode = code;
}

function leaveRoom(ws) {
  const code = ws._roomCode;
  if (!code) return;
  const set = rooms.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(code);
}

function broadcast(code, msg, except) {
  const set = rooms.get(code);
  if (!set) return;
  for (const client of set) {
    if (client !== except && client.readyState === 1) {
      client.send(JSON.stringify(msg));
    }
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data.type === "join") {
      const code = String(data.code || "").replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid room code" }));
        return;
      }
      joinRoom(code, ws);
      ws.send(JSON.stringify({ type: "joined", code }));
      broadcast(code, { type: "peer-joined" }, ws);
      return;
    }

    if (["offer", "answer", "ice"].includes(data.type)) {
      const code = ws._roomCode;
      if (!code) return;
      broadcast(code, data, ws);
    }
  });

  ws.on("close", () => leaveRoom(ws));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on http://localhost:" + PORT);
});
