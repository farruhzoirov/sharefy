import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { ClientInfo, PendingRequest } from "../types/types";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

const clients = new Map<string, ClientInfo>();
const pendingRequests = new Map<string, PendingRequest>();

app.post("/register", (req, res) => {
  const { subdomain } = req.body;
  const requestedSubdomain = subdomain || uuidv4().substring(0, 8);

  if (clients.has(requestedSubdomain)) {
    return res
      .status(400)
      .json({ error: "This subdomain is already reserved" });
  }

  const token = uuidv4();

  clients.set(requestedSubdomain, {
    token,
    socket: null,
    createdAt: new Date(),
  });

  const url = `http://159.89.86.13:8080/${requestedSubdomain}`;

  res.json({
    success: true,
    subdomain: requestedSubdomain,
    token,
    url,
  });
});

app.get("/check/:subdomain", (req, res) => {
  const { subdomain } = req.params;

  if (clients.has(subdomain)) {
    return res.json({ available: false });
  }

  res.json({ available: true });
});

io.on("connection", (socket) => {
  const { token, subdomain } = socket.handshake.query;

  if (typeof subdomain !== "string" || typeof token !== "string") {
    socket.disconnect();
    return;
  }

  const client = clients.get(subdomain);
  if (!client || client.token !== token) {
    socket.disconnect();
    return;
  }

  console.log(`Client connected: ${subdomain}`);
  client.socket = socket as any;

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${subdomain}`);
    if (clients.has(subdomain)) {
      const client = clients.get(subdomain);
      if (client) {
        client.socket = null;
      }
    }
  });

  socket.on("response", (responseData) => {
    const pendingRequest = pendingRequests.get(responseData.id);
    if (pendingRequest) {
      const { res } = pendingRequest;

      res.status(responseData.status);
      Object.entries(responseData.headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== "content-length") {
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
  const subdomain = host.split("/")[1];
  const client = clients.get(subdomain);

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
      path: req.url.replace(`/${subdomain}`, ""),
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
  clients.forEach((client, subdomain) => {
    const createdAt = client.createdAt.getTime();
    if (now - createdAt > 24 * 60 * 60 * 1000 && !client.socket) {
      clients.delete(subdomain);
    }
  });
}, 60000);
