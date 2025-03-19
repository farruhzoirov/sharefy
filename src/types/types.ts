// src/types.ts
import { Socket } from "socket.io-client";
import { IncomingHttpHeaders } from "http";

export interface TunnelOptions {
  port: number;
  subdomain?: string;
  serveStatic?: boolean;
  staticPath?: string;
  tunnelServer?: string;
}

export interface RegistrationResponse {
  success: boolean;
  subdomain: string;
  token: string;
  url: string;
}

export interface TunnelRequest {
  id: string;
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: Buffer | null;
}

export interface TunnelResponse {
  id: string;
  status: number;
  headers: { [key: string]: string | string[] | undefined };
  body: Buffer | string;
}

export interface ClientInfo {
  token: string;
  socket: Socket | null;
  createdAt: Date;
}

export interface PendingRequest {
  req: any;
  res: any;
  timestamp: number;
}
