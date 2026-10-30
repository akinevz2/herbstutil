#!/usr/bin/env bun



import { createCLI } from "@bunli/core";

import attrCommand from "./commands/attr.js";
import parseCommand from "./commands/parse.js";
import { navCommands } from "./commands/nav.js";

import { name, version, description } from "../package.json" with { type: "json" };

const cli = await createCLI({
  name,
  version,
  description,
});

cli.command(parseCommand);
cli.command(attrCommand);
for (const navCommand of navCommands) {
  cli.command(navCommand);
}

const [_node, _bin, command, ...args] = process.argv;
await cli.run([command ?? 'parse', ...args]);
