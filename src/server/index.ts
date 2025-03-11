import { WebSocketServer, WebSocket } from "ws";

const connections = new Map<string, WebSocket[]>();
