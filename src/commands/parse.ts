import { defineCommand, option } from "@bunli/core";
import { parse, z } from "zod";

type Section = 'value' | 'children' | 'attributes';

interface Rule {
  header: RegExp;
  section: Section;
}

const rules: Rule[] = [
  { header: /^(\d+)\s+child(?:ren)?[:.]/i, section: 'children' },
  { header: /^(\d+)\s+attribute(?:s)?[:.]/i, section: 'attributes' },
];

function parseAttr(text: string) {
  const lines = text.split(/\r?\n/);

  let currentSection: Section = 'value';

  const result = {
    value: '' as string,
    children: [] as string[],
    attributes: {} as Record<string, string>,
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    // Check for section header
    const matched = rules.find(r => r.header.test(line));
    if (matched) {
      currentSection = matched.section;
      continue;
    }

    // Content line
    switch (currentSection) {
      case 'value':
        result.value += (result.value ? '\n' : '') + line.trim();
        break;
      case 'children':
        result.children.push(line.trim());
        break;
      case 'attributes':
        if (!line.includes('=')) break;

        const eqIndex = line.indexOf('=');
        const left = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        const key = left.split(/\s+/).pop()!;

        result.attributes[key] = value;
        break;
    }
  }

  return result;
}

const parseCommand = defineCommand({
  name: "parse",
  description: "Parse herbstclient attr output into JSON",
  options: {
    space: option(z.number().default(4), {
      description: "Indent the JSON.stringify output",
      short: "s",
      argumentKind: "flag",
    }),
  },
  handler: async ({ flags }) => {
    const stdinText = await Bun.stdin.text();
    const parsed = parseAttr(stdinText);
    const { space } = flags;

    const jsond = JSON.stringify(parsed, null, space)
    process.stdout.write(jsond);
    process.stdout.write('\n');
  },
});

export default parseCommand;
