#!/usr/bin/env node
// src/bin/cli.ts
import { Command } from "commander";
import chalk from "chalk";
import NodeTunnel from "../tunnel/index";
import { readFileSync } from "fs";
import path from "path";

// package.json o'qish
const packageJsonPath = path.join(__dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const program = new Command();

program
  .version(packageJson.version)
  .description("Local serveringizni internet orqali public qiluvchi tunnel")
  .option("-p, --port <number>", "Local server porti", "8000")
  .option("-s, --subdomain <string>", "Maxsus subdomain nomi (ixtiyoriy)")
  .option("-d, --directory <path>", "Static fayllar papkasi", "./public")
  .option("--static", "Static fayllarni xizmat qilish", false)
  .option(
    "--server <url>",
    "Tunnel server URL",
    "https://your-tunnel-server.com"
  )
  .action(async (options) => {
    console.log(chalk.blue("🚇 Node Tunnel - v" + packageJson.version));
    console.log(chalk.yellow(`Local server: http://localhost:${options.port}`));

    try {
      const tunnel = new NodeTunnel({
        port: parseInt(options.port, 10),
        subdomain: options.subdomain,
        serveStatic: options.static,
        staticPath: options.directory,
        tunnelServer: options.server,
      });

      await tunnel.start();

      // CTRL+C ni tutib olish
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\nCTRL+C bosildi. Tunnel to'xtatilmoqda..."));
        tunnel.stop();
        process.exit(0);
      });
    } catch (error: any) {
      console.error(
        chalk.red("Tunnel ishga tushirishda xatolik:"),
        error.message
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
