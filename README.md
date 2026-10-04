# herbstutil

Post-process `herbstclient attr` output into json.

Early release.

# Examples

Here is what `herbstclient attr` output looks like for a root node:

```bash
> herbstclient attr clients.
The managed windows. For every (managed) window id there is an entry here.

5 children:
  0x400003.
  0x700003.
  0xc00003.
  0xe80003.
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
 R - h content_geometry = 1250x1323+18+18
 b w h decorated = true
 R - - decoration_geometry = 1260x1333+13+13
 b w h ewmhnotify = true
 b w h ewmhrequests = true
 b w h floating = false
 b - h floating_effectively = false
 R w h floating_geometry = 800x600+5+5
 b w h fullscreen = false
 s - - instance = "Alacritty"
 r w h keymask = ""
 r w h keys_inactive = ""
 b w h minimized = false
 i - h pgid = 61763
 i - h pid = 61763
 b w h pseudotile = false
 b w h sizehints_floating = true
 b w h sizehints_tiling = false
 s - - tag = "work"
 s - h title = "OC | Customizing opencode and dotfiles"
 b w h urgent = false
 b - h visible = true
 s - h winid = "0x700003"
 ```

As you can see its very verbose and "humanized"

Here is what `herbstclient attr` output looks like for a leaf node:

```bash
> herbstclient attr clients.focus.tag
work
```

### herbstutil

Here is what `herbstclient attr` output piped into herbstutil looks like for a root node:

```json
> herbstclient attr clients. | herbstutil
{
    "value": "The managed windows. For every (managed) window id there is an entry here.",
    "children": [
        "0x400003.",
        "0x700003.",
        "0xc00003.",
        "0xe80003.",
        "focus."
    ],
    "attributes": {}
}
```

Here is what `herbstclient attr` output piped into herbstutil looks like for a node with attributes:

```json
> herbstclient attr clients.focus. | herbstutil
{
    "value": "a managed window",
    "children": [
        "parent_frame."
    ],
    "attributes": {
        "class": "\"Alacritty\"",
        "content_geometry": "1250x1323+18+18",
        "decorated": "true",
        "decoration_geometry": "1260x1333+13+13",
        "ewmhnotify": "true",
        "ewmhrequests": "true",
        "floating": "false",
        "floating_effectively": "false",
        "floating_geometry": "800x600+5+5",
        "fullscreen": "false",
        "instance": "\"Alacritty\"",
        "keymask": "\"\"",
        "keys_inactive": "\"\"",
        "minimized": "false",
        "pgid": "61763",
        "pid": "61763",
        "pseudotile": "false",
        "sizehints_floating": "true",
        "sizehints_tiling": "false",
        "tag": "\"work\"",
        "title": "\"OC | Customizing opencode and dotfiles\"",
        "urgent": "false",
        "visible": "true",
        "winid": "\"0x700003\""
    }
}
```

Here is what `herbstclient attr` output piped into herbstutil looks like for a leaf node:

```json
> herbstclient attr clients.focus.tag | herbstutil
{
    "value": "work",
    "children": [],
    "attributes": {}
}
```