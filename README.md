# herbstutil

A simple filter to print herbstclient attr output in machine-readable
format — the pure parse/attr compatibility layer for
[herbstluftwm](https://herbstluftwm.github.io/).

[![npm](https://img.shields.io/npm/v/herbstutil)](https://www.npmjs.com/package/herbstutil)
[![CI](https://img.shields.io/github/actions/workflow/akinevz2/herbstutil/ci.yml?branch=main)](https://github.com/akinevz2/herbstutil/actions)
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

The project page on akinevz.com carries the rendered architecture
diagrams and is generated from this repo's `docs/architecture.md` by
the depot's documentation system (`system/docs/sync-website.mjs`) —
this README is the source for the usage examples; the website page is
curated and never regenerated wholesale.

## Examples

The same nodes, before and after herbstutil.

### root node: `herbstclient attr clients.`

raw:

```text
$ herbstclient attr clients.
The managed windows. One entry per window id.

4 children:
  0x280003.
  0x680004.
  0x900003.
  focus.
0 attributes.
 .---- type
 | .-- writable
 | | .-- hookable
 V V V
```

through herbstutil:

```json
{
    "value": "The managed windows. One entry per window id.",
    "children": [
        "0x280003.",
        "0x680004.",
        "0x900003.",
        "focus."
    ],
    "attributes": {}
}
```

### node with attributes: `herbstclient attr clients.focus.`

raw (excerpt):

```text
$ herbstclient attr clients.focus.
a managed window

1 child:
  parent_frame.
24 attributes:
 .---- type
 | .-- writable
 | | .-- hookable
 V V V
 s - - class = "Alacritty"
 R - h content_geometry = 1255x662+13+34
 b w h decorated = true
 i - h pid = 403112
 s - - tag = "work"
 s - h title = "OpenCode"
 b - h visible = true
 s - h winid = "0x280003"
```

through herbstutil (excerpt — all 24 attributes arrive in the JSON):

```json
{
    "value": "a managed window",
    "children": [
        "parent_frame."
    ],
    "attributes": {
        "class": "Alacritty",
        "content_geometry": { "x": 13, "y": 34, "width": 1255, "height": 662 },
        "decorated": true,
        "pid": 403112,
        "tag": "work",
        "title": "OC | herbstutil tag 0.1.1b discrepancy",
        "visible": true,
        "winid": "0x280003"
    }
}
```

### leaf node: `herbstclient attr clients.focus.tag`

raw:

```text
$ herbstclient attr clients.focus.tag
work
```

through herbstutil:

```json
"work"
```

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
