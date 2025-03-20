import express from "express";
import http from "http";
import WebSocket from "ws";
import httpProxy from "http-proxy";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  TunnelOptions,
  RegistrationResponse,
  TunnelRequest,
  TunnelResponse,
} from "../types/types";

class NodeTunnel {
  private options: TunnelOptions;
  private localServer: http.Server | null = null;
  private socket: Socket | null = null;
  private connected: boolean = false;
  private tunnelUrl: string = "";

  constructor(options: Partial<TunnelOptions> = {}) {
    this.options = {
      port: options.port || 8000,
      subdomain: options.subdomain || uuidv4().substring(0, 8),
      serveStatic: options.serveStatic || false,
      staticPath: options.staticPath || "./public",
      tunnelServer: options.tunnelServer || "http://159.89.86.13:8080",
    };
  }

  public async start(): Promise<NodeTunnel> {
    console.log(chalk.blue("Node Tunnel is opening..."));

    try {
      const proxy = httpProxy.createProxyServer({});

      const app = express();
      if (this.options.serveStatic) {
        console.log(chalk.yellow(`Static file ${this.options.staticPath}`));
        app.use(express.static(this.options.staticPath as string));
      }

      this.localServer = http.createServer((req, res) => {
        if (this.options.serveStatic) {
          const urlPath = req.url || "/";
          const staticFilePath = path.join(
            this.options.staticPath as string,
            urlPath === "/" ? "index.html" : urlPath
          );

          if (fs.existsSync(staticFilePath)) {
            return app(req, res);
          }
        }

        proxy.web(
          req,
          res,
          { target: `http://localhost:${this.options.port}` },
          (err) => {
            if (err) {
              console.error(chalk.red("Proxy error:"));
              res.statusCode = 502;
              res.end("Proxy error: " + err.message);
            }
          }
        );
      });

      const wss = new WebSocket.Server({ server: this.localServer });
      wss.on("connection", (ws) => {
        ws.on("message", (message) => {});
      });

      await this.connectToTunnelServer();

      this.localServer.listen(0, () => {
        const address = this.localServer?.address();
        if (address && typeof address !== "string") {
          const port = address.port;
          console.log(chalk.green(`Local server is running on port ${port}`));
        }
      });

      return this;
    } catch (error) {
      console.error(chalk.red("Error opening Tunnel"));
      throw error;
    }
  }

  private async connectToTunnelServer(): Promise<string> {
    console.log(
      chalk.blue(
        `Connecting to the tunnel server: ${this.options.tunnelServer}`
      )
    );

    try {
      //  -------   Registering subdomain ---------
      const registration = await axios.post<RegistrationResponse>(
        `${this.options.tunnelServer}/register`,
        {
          subdomain: this.options.subdomain,
        }
      );

      this.tunnelUrl = registration.data.url;
      console.log(chalk.green(`Tunnel URL: ${this.tunnelUrl}`));

      // --------- Connecting  Tunnel server by socket.io --------
      this.socket = io(this.options.tunnelServer as string, {
        query: {
          token: registration.data.token,
          subdomain: this.options.subdomain,
        },
      });

      this.socket.on("connect", () => {
        console.log(chalk.green("Connected tunnel server"));
        this.connected = true;
      });

      this.socket.on("disconnect", () => {
        console.log(chalk.yellow("Disconnected tunnel server"));
        this.connected = false;

        // Reconnecting
        setTimeout(() => {
          if (!this.connected && this.socket) {
            console.log(chalk.blue("Reconnecting..."));
            this.socket.connect();
          }
        }, 5000);
      });

      this.socket.on("request", async (requestData: TunnelRequest) => {
        try {
          const { method, path, headers, body } = requestData;

          const response = await axios({
            method: method as any,
            url: `http://localhost:${this.options.port}${path}`,
            headers,
            data: body,
            responseType: "arraybuffer",
          });

          this.socket?.emit("response", {
            id: requestData.id,
            status: response.status,
            headers: response.headers,
            body: response.data,
          } as TunnelResponse);
        } catch (error: any) {
          console.error(chalk.red("Error redirecting request:"), error.message);
          this.socket?.emit("response", {
            id: requestData.id,
            status: error.response?.status || 500,
            headers: error.response?.headers || {},
            body: error.response?.data || Buffer.from("Internal server error"),
          } as TunnelResponse);
        }
      });

      return this.tunnelUrl;
    } catch (error) {
      console.error(chalk.red("Error connecting to the tunnel server"));
      throw error;
    }
  }

  public stop(): void {
    console.log(chalk.blue("Sharefy Tunnel is stopping..."));

    if (this.socket) {
      this.socket.disconnect();
    }

    if (this.localServer) {
      this.localServer.close();
    }

    console.log(chalk.green("Sharefy Tunnel stopped"));
  }

  public getUrl(): string {
    return this.tunnelUrl;
  }

  public isConnected(): boolean {
    return this.connected;
  }
}

export default NodeTunnel;
