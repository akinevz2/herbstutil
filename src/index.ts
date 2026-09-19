#!/usr/bin/env bun



import { createCLI } from "@bunli/core";

import parseCommand from "./commands/parse.js";

const cli = await createCLI({
  name: "herbstutil",
  version: "0.1.0",
  description: "A simple filter to parse herbstclient attr output into json",
});

cli.command(parseCommand);
if (process.stdin.isTTY) {
  console.error("Error: herbstutil is a filter that reads from stdin. You shouldn't be running this interactively.");
  process.exit(1);
}
await cli.run(['parse']);
