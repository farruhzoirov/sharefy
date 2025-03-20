import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { ClientInfo, PendingRequest } from "../types/types";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ServerUrl = "http://159.89.86.13:8080";

app.use(express.json());

const clients = new Map<string, ClientInfo>();
const pendingRequests = new Map<string, PendingRequest>();

app.post("/register", (req, res) => {
  const { clientId } = req.body;
  const token = uuidv4();
  if (!clients.has(clientId)) {
    clients.set(clientId, {
      token,
      socket: null,
      createdAt: new Date(),
    });
  }
  const url = `${ServerUrl}/${clientId}`;

  res.json({
    success: true,
    clientId: clientId,
    token: clients.get(clientId)?.token,
    url,
  });
});

app.get("/check/:clientId", (req, res) => {
  const { clientId } = req.params;

  if (clients.has(clientId)) {
    return res.json({ available: false });
  }

  res.json({ available: true });
});

io.on("connection", (socket) => {
  const { token, clientId } = socket.handshake.query;
  if (typeof clientId !== "string" || typeof token !== "string") {
    socket.disconnect();
    return;
  }

  const client = clients.get(clientId);
  if (!client || client.token !== token) {
    socket.disconnect();
    return;
  }

  console.log(`Client connected: ${clientId}`);
  client.socket = socket as any;

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${clientId}`);
  });

  socket.on("response", (responseData) => {
    const pendingRequest = pendingRequests.get(responseData.id);
    if (pendingRequest) {
      const { res } = pendingRequest;

      res.status(responseData.status);
      Object.entries(responseData.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== "content-length") {
          console.log(key, value);
          res.setHeader(key, value);
        }
      });

      res.end(responseData.body);
      pendingRequests.delete(responseData.id);
    }
  });
});

app.use((req, res) => {
  const host = req.url || "";
  const clientId = host.split("/")[1];
  const client = clients.get(clientId);

  if (!client || !client.socket) {
    return res
      .status(404)
      .send("Tunnel not found or disconnected from public server");
  }

  const requestId = uuidv4();
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const body = Buffer.concat(chunks);
    pendingRequests.set(requestId, {
      req,
      res,
      timestamp: Date.now(),
    });

    client.socket?.emit("request", {
      id: requestId,
      method: req.method,
      path: req.url.replace(`/${clientId}`, ""),
      headers: req.headers,
      body: body.length > 0 ? body : null,
    });

    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        res.status(504).send("Gateway Timeout");
        pendingRequests.delete(requestId);
      }
    }, 30000);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Tunnel server running on port ${PORT}`);
});

setInterval(() => {
  const now = Date.now();

  pendingRequests.forEach((request, id) => {
    if (now - request.timestamp > 30000) {
      request.res.status(504).send("Gateway Timeout");
      pendingRequests.delete(id);
    }
  });

  // Cleaning inactive clients (more than 24 hours)
  clients.forEach((client, clientId) => {
    const createdAt = client.createdAt.getTime();
    if (now - createdAt > 24 * 60 * 60 * 1000 && !client.socket) {
      clients.delete(clientId);
    }
  });
}, 60000);
