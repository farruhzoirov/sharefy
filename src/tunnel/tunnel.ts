import os from "os";
import crypto from "crypto";
import WebSocket from "ws";

const tunnelServer = process.env.tunnelServer;

function generateUniqueAndStableClientId(userId?: string): string {
  if (userId) return userId;
  const uniqueMachineId = os.hostname() + os.userInfo().username;
  return crypto
    .createHash("sha256")
    .update(uniqueMachineId)
    .digest("hex")
    .slice(0, 8);
}

export function openTunnel(localPort: number, userId?: string) {
  const clientId = generateUniqueAndStableClientId(userId);
  const assignedHost = `${tunnelServer}/tunnel-${clientId}`;

  // -------------------- LOGS ------------------
  console.log(`
  🚀 Tunnel opened!
  🌍 Public server: ${assignedHost}
  🔑 Client ID: ${clientId}
  `);

  // -------------------- LOGS ------------------

  const ws = new WebSocket(`${tunnelServer}/connect?clientId=${clientId}`);

  ws.on("open", () => {
    console.log("✅ WebSocket connection established!");
    ws.send(JSON.stringify({ type: "register", clientId, localPort }));
  });

  ws.on("message", (data) => {
    console.log("📩 New message:", data.toString());
  });

  ws.on("close", () => {
    console.log("❌ Tunnel closed.");
  });
}
