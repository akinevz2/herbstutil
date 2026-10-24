# herbstutil

Post-process `herbstclient attr` output into json.

Project page: [akinevz.com/herbstutil](https://akinevz.com/herbstutil)

Early release.

# Usage

```bash
herbstutil parse [options]      # read herbstclient attr output from stdin, print json
herbstutil attr [args...]       # run `herbstclient attr <args>` and print its parsed json
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
