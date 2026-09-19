#!/usr/bin/env bun
import { createCLI } from "@bunli/core";

import parseCommand from "./commands/parse.js";

const cli = await createCLI({
  name: "herbstutil",
  version: "0.1.0",
  description: "A simple filter to parse herbstclient attr output into json",
});

cli.command(parseCommand);

await cli.run(['parse']);
