// src/server.ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { ClientInfo, PendingRequest } from "../types/types";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Subdomain va token ma'lumotlarini saqlash
const clients = new Map<string, ClientInfo>();

// HTTP so'rovlarni kutish uchun Map
const pendingRequests = new Map<string, PendingRequest>();

// Subdomain registratsiya
app.post("/register", (req, res) => {
  const { subdomain } = req.body;
  const requestedSubdomain = subdomain || uuidv4().substring(0, 8);

  // Subdomain band qilinganligini tekshirish
  if (clients.has(requestedSubdomain)) {
    return res.status(400).json({ error: "Bu subdomain band qilingan" });
  }

  // Yangi token yaratish
  const token = uuidv4();

  // Client ma'lumotlarini saqlash
  clients.set(requestedSubdomain, {
    token,
    socket: null,
    createdAt: new Date(),
  });

  // URL generatsiya qilish
  const url = `https://${requestedSubdomain}.your-tunnel-domain.com`;

  res.json({
    success: true,
    subdomain: requestedSubdomain,
    token,
    url,
  });
});

// Subdomain tekshirish
app.get("/check/:subdomain", (req, res) => {
  const { subdomain } = req.params;

  if (clients.has(subdomain)) {
    return res.json({ available: false });
  }

  res.json({ available: true });
});

// Socket.io ulanishlarini boshqarish
io.on("connection", (socket) => {
  const { token, subdomain } = socket.handshake.query;

  if (typeof subdomain !== "string" || typeof token !== "string") {
    socket.disconnect();
    return;
  }

  // Tokenni tekshirish
  const client = clients.get(subdomain);
  if (!client || client.token !== token) {
    socket.disconnect();
    return;
  }

  console.log(`Client ulandi: ${subdomain}`);
  client.socket = socket as any;

  socket.on("disconnect", () => {
    console.log(`Client uzildi: ${subdomain}`);
    if (clients.has(subdomain)) {
      const client = clients.get(subdomain);
      if (client) {
        client.socket = null;
      }
    }
  });

  socket.on("response", (responseData) => {
    // Javobni kutayotgan HTTP so'roviga yo'naltirish
    const pendingRequest = pendingRequests.get(responseData.id);
    if (pendingRequest) {
      const { res } = pendingRequest;

      // HTTP headerlari va statusni o'rnatish
      res.status(responseData.status);
      Object.entries(responseData.headers).forEach(([key, value]) => {
        // Content-Length o'zimiz qo'yamiz
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value);
        }
      });

      // Javobni qaytarish
      res.end(responseData.body);

      // So'rovni o'chirish
      pendingRequests.delete(responseData.id);
    }
  });
});

// Barcha kelayotgan so'rovlarni ushlab, subdomain bo'yicha yo'naltirish
app.use((req, res) => {
  // Hostni olish va subdomain ajratish
  const host = req.headers.host || "";
  const subdomain = host.split(".")[0];

  // Client mavjudligini tekshirish
  const client = clients.get(subdomain);
  if (!client || !client.socket) {
    return res.status(404).send("Tunnel topilmadi yoki offline");
  }

  // So'rov ID generatsiya qilish
  const requestId = uuidv4();

  // Raw body olish uchun array
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const body = Buffer.concat(chunks);

    // So'rovni saqlab qo'yish
    pendingRequests.set(requestId, {
      req,
      res,
      timestamp: Date.now(),
    });

    // Socket orqali so'rovni yuborish
    client.socket?.emit("request", {
      id: requestId,
      method: req.method,
      path: req.url,
      headers: req.headers,
      body: body.length > 0 ? body : null,
    });

    // Timeout o'rnatish (30 sekund)
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        res.status(504).send("Gateway Timeout");
        pendingRequests.delete(requestId);
      }
    }, 30000);
  });
});

// Serverga quloq solish
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Tunnel server ${PORT} portida ishlamoqda`);
});

// Stale pendingRequests va clients larni tozalash
setInterval(() => {
  const now = Date.now();

  // Timed out pendingRequests larni tozalash
  pendingRequests.forEach((request, id) => {
    if (now - request.timestamp > 30000) {
      request.res.status(504).send("Gateway Timeout");
      pendingRequests.delete(id);
    }
  });

  // Inaktiv clientlarni tozalash (24 soatdan ortiq inaktiv)
  clients.forEach((client, subdomain) => {
    const createdAt = client.createdAt.getTime();
    if (now - createdAt > 24 * 60 * 60 * 1000 && !client.socket) {
      clients.delete(subdomain);
    }
  });
}, 60000);
