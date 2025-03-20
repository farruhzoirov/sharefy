import os from "os";
import http from "http";
import express from "express";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import crypto from "crypto";
import {
  TunnelOptions,
  RegistrationResponse,
  TunnelRequest,
  TunnelResponse,
} from "../types/types";

class SharefyTunnel {
  private options: TunnelOptions;
  private socket: Socket | null = null;
  private connected: boolean = false;
  private tunnelUrl: string = "";

  private readonly ServerUrl = "http://159.89.86.13:8080";

  constructor(options: Partial<TunnelOptions> = {}) {
    this.options = {
      port: options.port || 8000,
      serveStatic: options.serveStatic || false,
      clientId: crypto
        .createHash("sha256")
        .update(os.hostname())
        .digest("hex")
        .substring(0, 16),
      staticPath: options.staticPath || "./public",
      tunnelServer: options.tunnelServer || this.ServerUrl,
    };
  }

  public async start(): Promise<SharefyTunnel> {
    console.log(chalk.blue("Sharefy Tunnel is opening..."));

    try {
      const app = express();
      if (this.options.serveStatic) {
        console.log(chalk.yellow(`Static file ${this.options.staticPath}`));
        app.use(express.static(this.options.staticPath as string));
      }

      await this.connectToTunnelServer();

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
      //  -------   Registering clientId ---------
      const registration = await axios.post<RegistrationResponse>(
        `${this.options.tunnelServer}/register`,
        {
          clientId: this.options.clientId,
        }
      );

      this.tunnelUrl = registration.data.url;
      console.log(chalk.green(`Tunnel URL: ${this.tunnelUrl}`));

      // --------- Connecting  Tunnel server by socket.io --------
      this.socket = io(this.options.tunnelServer as string, {
        query: {
          token: registration.data.token,
          clientId: registration.data.clientId,
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
          console.error(chalk.red("Error redirecting request:"));
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
      console.error(chalk.red("Error connecting to the tunnel server"), error);
      throw error;
    }
  }

  public stop(): void {
    console.log(chalk.blue("Sharefy Tunnel is stopping..."));
    if (this.socket) {
      this.socket.disconnect();
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

export default SharefyTunnel;
