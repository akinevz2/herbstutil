import { defineCommand, option } from "@bunli/core";
import { z } from "zod";

import { parseAttr } from "./parse.js";

const HERBSTCLIENT = "herbstclient";

const attrCommand = defineCommand({
  name: "attr",
  description: "Query herbstclient attr and parse its output into JSON",
  options: {
    space: option(z.coerce.number().default(4), {
      description: "Indent the JSON.stringify output",
      short: "s",
    }),
    escape: option(z.boolean().default(false), {
      description: "Print values exactly as herbstclient printed them (quotes stay escaped inside strings)",
      short: "e",
      argumentKind: "flag",
    }),
  },
  handler: async ({ positional, flags }) => {
    let proc: Bun.Subprocess;
    try {
      proc = Bun.spawn([HERBSTCLIENT, "attr", ...positional], {
        stdout: "pipe",
        stderr: "inherit",
      });
    } catch (err) {
      console.error(`Error: failed to run ${HERBSTCLIENT}. Is herbstluftwm installed and running?`);
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.error(err);
      process.exit(127);
    }

    const text = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      process.exit(exitCode);
    }

    const parsed = parseAttr(text, { escape: flags.escape });
    process.stdout.write(JSON.stringify(parsed, null, flags.space));
    process.stdout.write('\n');
  },
});

export default attrCommand;
