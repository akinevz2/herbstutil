# herbstutil

A simple filter to print herbstclient attr output in machine-readable
format — the pure parse/attr compatibility layer for
[herbstluftwm](https://herbstluftwm.github.io/).

[![npm](https://img.shields.io/npm/v/herbstutil)](https://www.npmjs.com/package/herbstutil)
[![CI](https://img.shields.io/github/actions/workflow/herbstutil/ci.yml)](https://github.com/akinevz2/herbstutil/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Project page: [akinevz.com/herbstutil](https://akinevz.com/herbstutil)

## Install

The package's `bin` entry is a TypeScript source (`src/index.ts`).
Install and run it with bun:

```sh
bun install          # or: bun add herbstutil
bunx herbstutil      # runs src/index.ts through bun's runtime
```

It is a published npm package — `bun add herbstutil` works from any
bun project.

> **Note:** use bun or bunx, not npx — npx does not handle the
> TypeScript `bin` sources correctly.

## Usage

```bash
herbstutil parse [options]    # read herbstclient attr output from stdin, print json
herbstutil attr [args...]     # run herbstclient attr + parse its output
```

Both print the hlwm attribute tree as typed JSON: string, bool, int
and uint hints are converted to their JSON types, rectangle (`R`)
hints become `{x, y, width, height}` objects, point (`p`) hints become
`{x, y}` objects. `--escape` keeps every value as the literal string
herbstclient printed.

## Library

`parseAttr` is importable for tooling that wants hlwm-typed values
without spawning the CLI:

```ts
import { parseAttr } from "herbstutil/src/commands/parse.js";

const tree = parseAttr(output);
```

## Scope

herbstutil is deliberately **pure**: a herbstclient-attr
compatibility layer (parse + attr helpers — no opinions, no composite
commands). The imperative compositions (the dots keybind chains, the
float keybind state machines) live in their own project:
[herbctl](https://github.com/akinevz2/herbctl).

## Test

`bun test` covers the parser and the attr runner against recorded
herbstclient output — nothing here needs a live WM to test.
