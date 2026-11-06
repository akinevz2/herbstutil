#!/usr/bin/env bun



import { createCLI } from "@bunli/core";

import attrCommand from "./commands/attr.js";
import parseCommand from "./commands/parse.js";
import shellCompletionsCommand from "./commands/shell-completions.js";

import { name, version, description } from "../package.json" with { type: "json" };

const cli = await createCLI({
  name,
  version,
  description,
});

cli.command(shellCompletionsCommand);
cli.command(parseCommand);
cli.command(attrCommand);

const [_node, _bin, command, ...args] = process.argv;
await cli.run([command ?? 'parse', ...args]);
