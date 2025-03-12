#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { openTunnel } from "../../src/tunnel/tunnel.ts";

const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    type: "number",
    description: "Port of local server",
  })

  .option("id", {
    alias: "i",
    type: "string",
    description: "Custom client ID",
  })
  .help().argv as { port: number; id?: string };

const LOCAL_PORT = argv.port;

openTunnel(argv.port, argv.id);
