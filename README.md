# herbstutil

[![CI](https://img.shields.io/github/actions/workflow/status/akinevz2/herbstutil/ci.yml?branch=main&label=CI&style=flat&pretty=deferred)](https://github.com/akinevz2/herbstutil/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/herbstutil)](https://www.npmjs.com/package/herbstutil)
[![License](https://img.shields.io/github/license/akinevz2/herbstutil)](LICENSE)

Post-process `herbstclient attr` output into json.

Project page: [akinevz.com/herbstutil](https://akinevz.com/herbstutil)

Early release.

# Usage

```bash
herbstutil parse [options]      # read herbstclient attr output from stdin, print json
herbstutil attr [args...]       # run `herbstclient attr <args>` and print its parsed json
herbstutil mod-<key>            # the dots keybind chains + float state machines (see below)
```

Options (both commands):

- `-s, --space <n>` — indent the JSON output with `n` spaces (default: 4)
- `-e, --escape` — print values exactly as herbstclient printed them: strings keep
  their literal quotes (escaped inside the JSON string) and no type conversion happens

# Examples

Here is what `herbstclient attr` output looks like for a root node:

```bash
> herbstclient attr clients.
The managed windows. For every (managed) window id there is an entry here.

5 children:
  0x280003.
  0x380003.
  0x680004.
  0x900003.
  focus.
0 attributes.
 .---- type
 | .-- writable
 | | .-- hookable
 V V V
```

Here is what `herbstclient attr` output looks like for a node with attributes:

```bash
> herbstclient attr clients.focus.
a managed window

1 child:
  parent_frame.
24 attributes:
 .---- type
 | .-- writable
 | | .-- hookable
 V V V
 s - - class = "Alacritty"
 R - h content_geometry = 1255x1359+1292+34
 b w h decorated = true
 R - - decoration_geometry = 1263x1388+1288+9
 b w h ewmhnotify = true
 b w h ewmhrequests = true
 b w h floating = false
 b - h floating_effectively = false
 R w h floating_geometry = 800x600+6+35
 b w h fullscreen = false
 s - - instance = "Alacritty"
 r w h keymask = ""
 r w h keys_inactive = ""
 b w h minimized = false
 i - h pgid = 457995
 i - h pid = 457995
 b w h pseudotile = false
 b w h sizehints_floating = true
 b w h sizehints_tiling = false
 s - - tag = "work"
 s - h title = "bash /home/kine/development/personal/herbstutil"
 b w h urgent = false
 b - h visible = true
 s - h winid = "0x380003"
```

As you can see its very verbose and "humanized"

Here is what `herbstclient attr` output looks like for a leaf node:

```bash
> herbstclient attr clients.focus.tag
work
```

### herbstutil

`herbstutil attr` runs herbstclient for you and prints the same tree as json —
its arguments are forwarded to `herbstclient attr`:

```json
> herbstutil attr clients.
{
    "value": "The managed windows. For every (managed) window id there is an entry here.",
    "children": [
        "0x280003.",
        "0x380003.",
        "0x680004.",
        "0x900003.",
        "focus."
    ],
    "attributes": {}
}
```

Piping `herbstclient` through `herbstutil parse` is equivalent:

```json
> herbstclient attr clients.focus. | herbstutil parse
{
    "value": "a managed window",
    "children": [
        "parent_frame."
    ],
    "attributes": {
        "class": "Alacritty",
        "content_geometry": {
            "x": 1292,
            "y": 34,
            "width": 1255,
            "height": 1359
        },
        "decorated": true,
        "decoration_geometry": {
            "x": 1288,
            "y": 9,
            "width": 1263,
            "height": 1388
        },
        "ewmhnotify": true,
        "ewmhrequests": true,
        "floating": false,
        "floating_effectively": false,
        "floating_geometry": {
            "x": 6,
            "y": 35,
            "width": 800,
            "height": 600
        },
        "fullscreen": false,
        "instance": "Alacritty",
        "keymask": "",
        "keys_inactive": "",
        "minimized": false,
        "pgid": 457995,
        "pid": 457995,
        "pseudotile": false,
        "sizehints_floating": true,
        "sizehints_tiling": false,
        "tag": "work",
        "title": "bash /home/kine/development/personal/herbstutil",
        "urgent": false,
        "visible": true,
        "winid": "0x380003"
    }
}
```

Leaf nodes:

```json
> herbstutil attr clients.focus.tag
{
    "value": "work",
    "children": [],
    "attributes": {}
}
```

# Value typing

In the attribute listing, herbstclient annotates every attribute with a type
hint in the first column. herbstutil reads that hint and emits properly typed
JSON:

| hint | hlwm type | JSON value |
|------|-----------|------------|
| `s` | string | string, outer quotes stripped |
| `b` | bool | boolean |
| `i`, `u` | int, uint | number |
| `R` | rectangle | object `{ "x", "y", "width", "height" }` parsed from `WIDTHxHEIGHT+X+Y` |
| `p` | point | object `{ "x", "y" }` parsed from `XxY` |
| `c`, `r`, `n`, `f` | color, regex, named value, font | string |
| anything else | — | same heuristic as leaf values (see below) |

Leaf output (`herbstclient attr path.to.attr`) prints bare values without a
type hint, so a heuristic decides there: `true`/`false` become booleans,
integers and decimals become numbers, everything else stays a string.

Pass `--escape` to skip all conversion and keep every value as the literal
string herbstclient printed.

# Keybind chains — `src/commands/nav.ts` (v0.2.0)

The dots keybinds and float keybind state machines, as importable
functions and CLI subcommands. Each function issues the SAME hlwm
chains the source binding expresses, token for token (ports of the
`herbst_focus`/`herbstluftwm` keys.d fragments and the
`hc_zoom`/`hc_floatx` state machines — they live in
[doftiles](https://github.com/akinevz2/doftiles)). Fail-soft
throughout: a failed `herbstclient` call (missing object, vanished
window) resolves null instead of throwing.

| subcommand / function | binding | behavior |
|-----------------------|---------|----------|
| `mod-s` / `modS()` | `$Mod-s` | the zoom/peek grid: urgent jumpto, `focus --level=frame down`, the floating-layer branch (`attr tags.focus.floating_focused true` — focuses the float layer AND fails through when it is empty), cycle fallbacks, pseudotile toggle — one chained spawn under lock |
| `mod-w` / `modW()` | `$Mod-w` | leave the floating layer, then cycle window/frame upward — under lock |
| `mod-d` / `modD()` | `$Mod-d` | count-gated `cycle_layout` mixes with a bare `-1` fallback |
| `mod-e` / `modE()` | `$Mod-e` | cycle frames backward, or `split explode` when it is the last split |
| `mod-a` / `modA()` | `$Mod-a` | `focus left --level=frame`, or `split left 0.33333` |
| `mod-shift-w` / `modShiftW()` | `$ModShift-w` | `shift --level=all up`, else cycle `-1` / cycle+rotate frames |
| `mod-shift-b` / `modShiftB()` | `$ModShift-b` | with >1 window in the frame: `split bottom` + `shift down` |
| `mod-q` / `modQ()` | `$Mod-q` | un-float a focused float, else close (lone-window frames removed, `close_or_remove`) — under lock |
| `mod-f` / `modF()` | hc_zoom (bound `$ModCtrl-f` in dots) | the three-state press machine: tiled -> float (flag reset + center + deco-flush frame fill + fit) / floating -> maximize onto `<tag>-max` / maximized -> restore. The `-max` check runs BEFORE the floating check; PF_MAX state is owned by the delegated `hc_maximize`/`hc_unmaximize` helpers (and their daemon) |
| `mod-x` / `modX()` | hc_floatx (`$Mod-x`) | the layer-yank machine: focus-a-float-then-unfloat / yank (float + center into the float session, frame left alone) / defer / un-float-into-empty-frame / tidying (remove, reveal, `polyframes hidden`, `use_previous`) |

Small imperatives (also importable, shared with polyframes):

- `unfloatWid(wid)` — fold fullscreen/pseudotile/floating flags off a
  float and `jumpto` it (hc_floatx's `unfloat_wid`).
- `floatCenterFrame(wid)` — float a window and center it within the
  focused frame's content geometry, under a lock (the scroll wheel's
  float step).
- `minimizeKeepFrame(wid)` — minimize while deliberately keeping the
  frame (the scroll wheel's tiled step down).
- `removeEmptyFrame()` — prune the focused frame when the tag has more
  than one frame and the focused one holds zero clients.

```ts
import { parseAttr } from "herbstutil/src/commands/parse.js";
import { modS, unfloatWid, floatCenterFrame } from "herbstutil/src/commands/nav.js";
```

The state machines delegate to the dots helper binaries exactly where
the scripts do — `hc_center`, `hc_resize`, `hc_fit_to`, `hc_tile`,
`hc_maximize`, `hc_unmaximize` and `polyframes` — resolved from
`$HOME/.local/bin` by default. Override the directory (tests point it
at a fixture dir) with:

```bash
HERBSTUTIL_HELPER_DIR=/path/to/bin herbstutil mod-x
```

Every subcommand/function is verified against the recorded argv of a
mocked `herbstclient` binary (`bun test`) — nothing here needs a live
WM to test.
