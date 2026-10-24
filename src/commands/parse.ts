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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

type AttrValue = string | number | boolean | Rect | Point;

export interface ParseOptions {
  /** Keep values verbatim instead of unquoting strings and typing numbers/booleans. */
  escape?: boolean;
}

interface ParseState {
  value: string;
  children: string[];
  attributes: Record<string, AttrValue>;
}

const NUMERIC = /^-?\d+(?:\.\d+)?$/;
const RECTANGLE = /^(\d+)x(\d+)([+-]\d+)([+-]\d+)$/;
const POINT = /^(-?\d+)x(-?\d+)$/;

// Attribute listing lines look like ` s - - class = "Alacritty"`:
// <type> <writable> <hookable> <name> = <value>, indented by one space.
const ATTR_LINE = /^\s*(\S)\s+(\S)\s+(\S)\s+([^\s=]+)\s+=\s?(.*)$/;

// herbstclient escapes only backslash and double quote inside quoted attribute strings
function unescapeChars(text: string): string {
  return text.replace(/\\(.)/g, (_, c: string) => (c === '"' || c === '\\' ? c : `\\${c}`));
}

function convertValue(raw: string): AttrValue {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return unescapeChars(raw.slice(1, -1));
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (NUMERIC.test(raw)) return Number(raw);
  return raw;
}

// Convert a value using the type hint from herbstclient's attribute listing.
// Falls back to the untyped heuristic for unknown or malformed values.
function convertTyped(type: string, raw: string): AttrValue {
  switch (type) {
    case 'b':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      break;
    case 'i':
    case 'u':
      if (NUMERIC.test(raw)) return Number(raw);
      break;
    case 'R': {
      const rect = RECTANGLE.exec(raw);
      if (rect) {
        return {
          x: Number(rect[3]),
          y: Number(rect[4]),
          width: Number(rect[1]),
          height: Number(rect[2]),
        };
      }
      break;
    }
    case 'p': {
      const point = POINT.exec(raw);
      if (point) {
        return { x: Number(point[1]), y: Number(point[2]) };
      }
      break;
    }
  }
  return convertValue(raw);
}

function parseLine(line: string, section: Section, state: ParseState, options: ParseOptions): Section {
  const matched = rules.find(r => r.header.test(line));
  if (matched) return matched.section;

  const content = line.trim();
  if (section === 'value') {
    state.value += (state.value ? '\n' : '') + content;
  } else if (section === 'children') {
    state.children.push(content);
  } else if (line.includes('=')) {
    const attr = ATTR_LINE.exec(line);
    if (attr) {
      const [, type, , , key, rawValue] = attr;
      state.attributes[key] = options.escape ? rawValue : convertTyped(type, rawValue);
    } else {
      const [key, rawValue] = read(line);
      state.attributes[key] = options.escape ? rawValue : convertValue(rawValue);
    }
  }
  return section;
}

export function parseAttr(text: string, options: ParseOptions = {}) {
  const lines = text.split(/\r?\n/);

  let currentSection: Section = 'value';
  const state: ParseState = { value: '', children: [], attributes: {} };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    currentSection = parseLine(line, currentSection, state, options);
  }

  return {
    value: options.escape ? state.value : convertValue(state.value),
    children: state.children,
    attributes: state.attributes,
  };
}

const parseCommand = defineCommand({
  name: "parse",
  description: "Parse herbstclient attr output into JSON (default)",
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
  handler: async ({ flags }) => {
    if (process.stdin.isTTY) {
      console.error("Error: herbstutil is a filter that reads from stdin. You shouldn't be running this interactively.");
      process.exit(1);
    }
    const stdinText = await Bun.stdin.text();
    const parsed = parseAttr(stdinText, { escape: flags.escape });
    const { space } = flags;

    const jsond = JSON.stringify(parsed, null, space)
    process.stdout.write(jsond);
    process.stdout.write('\n');
  },
});

export default parseCommand;
function read(line: string): [string, string] {
  const eqIndex = line.indexOf('=');
  const left = line.slice(0, eqIndex).trim();
  const value = line.slice(eqIndex + 1).trim();
  const key = left.split(/\s+/).pop()!;
  return [key, value];
}

