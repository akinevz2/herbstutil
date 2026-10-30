// tests/parse.test.ts — smoke test for the pre-existing parseAttr
// (the package's original core, previously with zero coverage). The
// sample is the documented `herbstclient attr clients.focus.` output
// shape (see README).

import { describe, expect, test } from "bun:test";

import { parseAttr } from "../src/commands/parse";

const CLIENT_FOCUS_OUTPUT = `a managed window

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
`;

describe("parseAttr", () => {
    test("parses the documented clients.focus. tree with REAL type coercion", () => {
        const parsed = parseAttr(CLIENT_FOCUS_OUTPUT);

        expect(parsed.value).toBe("a managed window");
        // parseAttr keeps the trailing dots (hlwm prints children as
        // "parent_frame."); callers strip them if they want.
        expect(parsed.children).toEqual(["parent_frame."]);

        const a = parsed.attributes;
        // Booleans are real booleans.
        expect(a.floating).toBe(false);
        expect(a.decorated).toBe(true);
        expect(a.minimized).toBe(false);
        // Geometries are typed objects (never string-split by hand).
        expect(a.content_geometry).toEqual({ x: 1292, y: 34, width: 1255, height: 1359 });
        expect(a.floating_geometry).toEqual({ x: 6, y: 35, width: 800, height: 600 });
        // Numbers and strings.
        expect(a.pid).toBe(457995);
        expect(a.tag).toBe("work");
        expect(a.winid).toBe("0x380003");
    });

    test("escape mode keeps the values verbatim", () => {
        const parsed = parseAttr(CLIENT_FOCUS_OUTPUT, { escape: true });
        expect(parsed.attributes.floating).toBe("false");
        expect(parsed.attributes.tag).toBe("\u0022work\u0022"); // quotes stay
        expect(parsed.attributes.content_geometry).toBe("1255x1359+1292+34");
    });

    test("parses the container shape of `attr clients.`", () => {
        const parsed = parseAttr(`The managed windows.

3 children:
  0x280003.
  0x380003.
  focus.
0 attributes.
`);
        expect(parsed.value).toBe("The managed windows.");
        expect(parsed.children).toEqual(["0x280003.", "0x380003.", "focus."]);
        expect(parsed.attributes).toEqual({});
    });

    test("parses a bare leaf read", () => {
        expect(parseAttr("work").value).toBe("work");
        expect(parseAttr("1255x1359+1292+34").value).toBe("1255x1359+1292+34");
        expect(parseAttr("true").value).toBe(true);
        expect(parseAttr("42").value).toBe(42);
    });
});
