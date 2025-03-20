#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import NodeTunnel from "../tunnel/index";
import { readFileSync } from "fs";
import path from "path";

const packageJsonPath = path.join(__dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const program = new Command();

program
  .version(packageJson.version)
  .description(
    "A tunnel that makes your local server publicly accessible via the internet"
  )
  .option("-p, --port <number>", "Local server port", "8000")
  .option("-s, --subdomain <string>", "Custom subdomain name (optional)")
  .option("-d, --directory <path>", "Directory for static files", "./public")
  .option("--static", "Serve static files", false)
  .option("--server <url>", "Tunnel server URL", "http://159.89.86.13:8080")
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

      process.on("SIGINT", () => {
        console.log(chalk.yellow("\nCTRL+C. Tunnel is stopping..."));
        tunnel.stop();
        process.exit(0);
      });
    } catch (error: any) {
      console.error(chalk.red("Error running tunnel:"), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
