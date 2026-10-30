// tests/nav.test.ts — port-fidelity suite for src/commands/nav.ts.
//
// The herbstclient binary is mocked via PATH (tests/fixtures/mock-bin):
// the fixture records every invocation's argv to a log file and replies
// from a scenario table ("regex<TAB>exit<TAB>output"). The dots helper
// binaries (hc_center, hc_resize, hc_fit_to, hc_tile, hc_maximize,
// hc_unmaximize) are mocked the same way, located through the
// HERBSTUTIL_HELPER_DIR override. Every test asserts the recorded
// argv sequence matches the hlwm chain from the source binding —
// nothing here ever talks to a live herbstluftwm session.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
    getAdvice,
    getDeck,
    getDedeck,
    getExplore,
    getFocus,
    getZoom,
    getQuiet,
    getSouth,
    getBelow,
    modShiftW,
    getForward,
    getExtracted,
} from "../src/commands/nav";

const FIX = join(import.meta.dir, "fixtures", "mock-bin");

let tmp = "";
let logPath = "";
let scenarioPath = "";
let savedPath = "";
let savedHelperDir: string | undefined;

/** Parse the mock log: one entry per invocation, argv split on \x1f. */
function log(): string[][] {
    return readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const parts = line.split("\x1f");
            return parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts;
        });
}

/** Write the scenario table: [regex, exitCode, output] rows. */
function scenario(rows: Array<[string, string, string]>): void {
    writeFileSync(scenarioPath, rows.map((r) => r.join("\t")).join("\n") + "\n");
}

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "herbstutil-nav-"));
    logPath = join(tmp, "mock.log");
    scenarioPath = join(tmp, "mock.scenario");
    writeFileSync(logPath, "");
    // Defensive chmod: git preserves the exec bit, but fat/WSL
    // metadata can drop it — the fixtures must stay spawnable.
    for (const f of ["herbstclient", "hc_center", "hc_resize", "hc_fit_to", "hc_maximize", "hc_unmaximize", "hc_tile"]) {
        chmodSync(join(FIX, f), 0o755);
    }
    savedPath = process.env.PATH ?? "";
    savedHelperDir = process.env.HERBSTUTIL_HELPER_DIR;
    process.env.PATH = `${FIX}:${savedPath}`;
    process.env.HERBSTUTIL_HELPER_DIR = FIX;
    process.env.HERBSTUTIL_MOCK_LOG = logPath;
    process.env.HERBSTUTIL_MOCK_SCENARIO = scenarioPath;
});

afterEach(() => {
    process.env.PATH = savedPath;
    if (savedHelperDir === undefined) delete process.env.HERBSTUTIL_HELPER_DIR;
    else process.env.HERBSTUTIL_HELPER_DIR = savedHelperDir;
    delete process.env.HERBSTUTIL_MOCK_LOG;
    delete process.env.HERBSTUTIL_MOCK_SCENARIO;
    rmSync(tmp, { recursive: true, force: true });
});

// The pure keybind chains: ONE chained herbstclient spawn, argv
// verbatim from the keys.d fragments.
describe("pure keybind chains", () => {
    // focus.sh $Mod-s
    test("getSouth issues the zoom/peek grid chain", async () => {
        await getSouth();
        expect(log()).toEqual([
            [
                "chain", ":", "lock",
                ":", "or",
                ",", "and", ".", "compare", "tags.focus.urgent_count", "gt", "0", ".", "jumpto", "urgent",
                ",", "focus", "--level=frame", "down",
                ",", "and",
                ".", "attr", "tags.focus.floating_focused", "true",
                ".", "attr", "tags.focus.focused_client.floating", "off",
                ".", "attr", "tags.focus.focused_client.pseudotile", "off",
                ",", "and",
                "!", "compare", "tags.focus.curframe_wcount", "gt", "1",
                "!", "cycle", "-1",
                "!", "attr", "clients.focus.pseudotile", "off",
                ",", "pseudotile", "toggle",
                ":", "unlock",
            ],
        ]);
    });

    // nav.sh $Mod-w
    test("getForward issues the leave-floating/ cycle-up chain", async () => {
        await getForward();
        expect(log()).toEqual([
            [
                "chain", ":", "lock", ":", "or",
                ",", "and",
                "!", "compare", "tags.focus.floating_focused", "=", "1",
                "!", "attr", "tags.focus.floating_focused", "off",
                ",", "and",
                "!", "compare", "tags.focus.curframe_wcount", "gt", "1",
                "!", "cycle", "+1",
                ",", "focus", "--level=frame", "up",
                ",", "cycle_frame",
                ":", "unlock",
            ],
        ]);
    });

    // nav.sh $Mod-d
    test("getDeck issues the count-gated layout cycler", async () => {
        await getDeck();
        expect(log()).toEqual([
            [
                "or",
                ",", "and",
                ".", "compare", "tags.focus.curframe_wcount", "gt", "3",
                ".", "cycle_layout", "+1", "max", "vertical", "grid", "horizontal",
                ",", "and",
                ".", "compare", "tags.focus.curframe_wcount", "=", "2",
                ".", "cycle_layout", "+1", "vertical", "max", "horizontal",
                ",", "cycle_layout", "-1", "vertical", "horizontal", "max",
            ],
        ]);
    });

    // focus.sh $Mod-e
    test("getExplore issues the cycle-backward/explode chain", async () => {
        await getExplore();
        expect(log()).toEqual([
            [
                "or", ".",
                "and", ",", "compare", "tags.focus.frame_count", "gt", "1", ",", "cycle_frame", "-1",
                ".", "chain", "!", "split", "explode", "!", "cycle_frame",
            ],
        ]);
    });

    // autostart $Mod-a
    test("getAdvice issues the focus-left-or-split chain", async () => {
        await getAdvice();
        expect(log()).toEqual([
            ["or", ",", "focus", "left", "--level=frame", ",", "split", "left", "0.33333"],
        ]);
    });

    // nav.sh $ModShift-w
    test("modShiftW issues the shift-up/cycle/rotate chain", async () => {
        await modShiftW();
        expect(log()).toEqual([
            [
                "or",
                ",", "shift", "--level=all", "up",
                ",", "or",
                "!", "and", ".", "compare", "tags.focus.frame_count", "gt", "1", ".", "cycle_frame",
                "!", "cycle", "-1",
                ",", "chain", "!", "lock", "!", "rotate", "!", "unlock",
            ],
        ]);
    });

    // autostart $ModShift-b
    test("getBelow issues the split-bottom-and-shift chain", async () => {
        await getBelow();
        expect(log()).toEqual([
            [
                "or", ".",
                "and", ",", "compare", "tags.focus.curframe_wcount", "gt", "1",
                ",", "chain", "!", "split", "bottom", "!", "shift", "down",
            ],
        ]);
    });

    // nav.sh $ModShift-d
    test("getDedeck issues the count-gated mix-or-remove chain", async () => {
        await getDedeck();
        expect(log()).toEqual([
            [
                "or",
                ".", "and",
                ",", "compare", "tags.focus.curframe_wcount", "gt", "1",
                ",", "cycle_layout", "+1", "max", "grid", "vertical",
                ".", "remove",
            ],
        ]);
    });

    // floating.sh $Mod-q
    test("getQuiet issues the un-float-or-close chain", async () => {
        await getQuiet();
        expect(log()).toEqual([
            [
                "chain", "!", "lock",
                "!", "or",
                ".", "and", ",", "compare", "tags.focus.floating_focused", "=", "true",
                ",", "attr", "clients.focus.floating", "off",
                ".", "and", ",", "compare", "tags.focus.curframe_wcount", "=", "1",
                ",", "close_and_remove",
                ".", "close_or_remove",
                "!", "unlock",
            ],
        ]);
    });
});

// getZoom — the hc_zoom press-state machine.
describe("getZoom (hc_zoom port)", () => {
    test("(a) tiled -> flag reset + hc_center root + hc_resize frame + hc_fit_to root, under lock", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000001"],
            ["^attr clients\\.0x1000001\\.tag$", "0", "work"],
            ["^attr clients\\.0x1000001\\.floating$", "0", "false"],
        ]);
        expect(await getZoom()).toBe(true);
        expect(log()).toEqual([
            ["attr", "clients.focus.winid"],
            ["lock"],
            ["attr", "clients.0x1000001.tag"],
            ["attr", "clients.0x1000001.floating"],
            ["attr", "clients.0x1000001.fullscreen", "off"],
            ["attr", "clients.0x1000001.pseudotile", "off"],
            [`${FIX}/hc_center`, "root"],
            [`${FIX}/hc_resize`, "0x1000001", "frame"],
            [`${FIX}/hc_fit_to`, "root"],
            ["unlock"],
        ]);
    });

    test("(b) floating -> hc_maximize (the <tag>-max tag dance, PF_MAX state owned by the helper)", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000001"],
            ["^attr clients\\.0x1000001\\.tag$", "0", "work"],
            ["^attr clients\\.0x1000001\\.floating$", "0", "true"],
        ]);
        expect(await getZoom()).toBe(true);
        expect(log()).toEqual([
            ["attr", "clients.focus.winid"],
            ["lock"],
            ["attr", "clients.0x1000001.tag"],
            ["attr", "clients.0x1000001.floating"],
            [`${FIX}/hc_maximize`, "0x1000001"],
            ["unlock"],
        ]);
    });

    test("(c) on a <tag>-max tag -> hc_unmaximize (the -max check runs BEFORE the floating check)", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000001"],
            ["^attr clients\\.0x1000001\\.tag$", "0", "work-max"],
        ]);
        expect(await getZoom()).toBe(true);
        expect(log()).toEqual([
            ["attr", "clients.focus.winid"],
            ["lock"],
            ["attr", "clients.0x1000001.tag"],
            // floating is read BEFORE the case (the -max check only
            // branches on the tag).
            ["attr", "clients.0x1000001.floating"],
            [`${FIX}/hc_unmaximize`, "0x1000001"],
            ["unlock"],
        ]);
    });

    test("no focused window -> false, no lock taken (hc_zoom exits 1)", async () => {
        scenario([["^attr clients\\.focus\\.winid$", "1", ""]]);
        expect(await getZoom()).toBe(false);
        expect(log()).toEqual([["attr", "clients.focus.winid"]]);
    });
});

// getExtracted — the hc_floatx layer-yank state machine.
describe("getExtracted (hc_floatx port)", () => {
    // The batched state read every branch starts with (chain + echo "|").
    const stateChain = (wcount: number, frameCc: number, frameCount: number, algo: string) =>
        [
            "chain",
            ",", "attr", "tags.focus.curframe_wcount", ",", "echo", "|",
            ",", "attr", "tags.focus.tiling.focused_frame.client_count", ",", "echo", "|",
            ",", "attr", "tags.focus.frame_count", ",", "echo", "|",
            ",", "attr", "tags.focus.tiling.focused_frame.algorithm", ",", "echo", "|",
            ",", "attr", "tags.focus.name", ",", "echo", "|",
            ",", "attr", "tags.focus.tiling.focused_frame.content_geometry", ",", "echo", "|",
            ",", "attr", "clients.focus.floating_effectively",
        ];
    const UNFLOAT_CHAIN = (wid: string) => [
        "chain",
        ",", "attr", `clients.${wid}.fullscreen`, "off",
        ",", "attr", `clients.${wid}.pseudotile`, "off",
        ",", "attr", `clients.${wid}.floating`, "off",
    ];

    test("focus-a-float-then-unfloat: tiling layer + visible float -> unfloat_wid(first_float)", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000002"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "1|0|2|max|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000001\n0x1000002"],
            ["^attr clients\\.0x1000001\\.floating$", "0", "true"],
            ["^attr clients\\.0x1000001\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "0", ""],
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"], // orig
            stateChain(1, 0, 2, "max"),
            ["attr", "tags.focus.floating_focused"], // ff read
            ["list_clients", "--tag=work"], // first_float scan
            ["attr", "clients.0x1000001.floating"],
            ["attr", "clients.0x1000001.minimized"],
            ["attr", "tags.focus.floating_focused", "on"], // the try-focus
            UNFLOAT_CHAIN("0x1000001"),
            ["jumpto", "0x1000001"],
            ["unlock"],
        ]);
    });

    test("yank: no floats to focus + populated frame -> float + hc_center root + register on, frame left alone", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000003"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "1|1|1|grid|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000003"],
            ["^attr clients\\.0x1000003\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""], // re-entry fails: no floats
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(1, 0, 1, "grid"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x1000003.floating"],
            ["attr", "tags.focus.floating_focused", "on"], // fails
            ["attr", "clients.focus.floating", "on"], // yank
            [`${FIX}/hc_center`, "root"],
            ["attr", "tags.focus.floating_focused", "on"],
            ["unlock"],
        ]);
    });

    test("defer: float focused, multiple frames -> floating_focused off only", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000004"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "1|1|2|max|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000004"],
            ["^attr clients\\.0x1000004\\.floating$", "0", "true"],
            ["^attr clients\\.0x1000004\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "true"],
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(1, 1, 2, "max"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x1000004.floating"],
            ["attr", "clients.0x1000004.minimized"],
            ["attr", "tags.focus.floating_focused", "off"], // defer
            ["unlock"],
        ]);
    });

    test("float focused, ONE frame -> use_previous + hc_tile + un-float the newly focused client", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000006"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "2|1|1|max|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000005"],
            ["^attr clients\\.0x1000005\\.floating$", "0", "true"],
            ["^attr clients\\.0x1000005\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "true"],
            ["^attr clients\\.0x1000006\\.floating false$", "0", ""],
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(2, 1, 1, "max"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x1000005.floating"],
            ["attr", "clients.0x1000005.minimized"],
            ["use_previous"],
            [`${FIX}/hc_tile`],
            ["attr", "clients.focus.winid"], // wfocus after the tile
            ["attr", "clients.0x1000006.floating", "false"],
            ["unlock"],
        ]);
    });

    test("un-float-into-empty-frame: float focused, empty focused frame -> direct unfloat (non-max layout)", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000007"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "0|0|3|grid|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000007"],
            ["^attr clients\\.0x1000007\\.floating$", "0", "true"],
            ["^attr clients\\.0x1000007\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "true"],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.client_count$", "0", "0"],
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(0, 0, 3, "grid"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x1000007.floating"],
            ["attr", "clients.0x1000007.minimized"],
            ["attr", "clients.focus.winid"], // wfocus
            ["attr", "tags.focus.tiling.focused_frame.client_count"], // fcc == 0 -> direct
            ["attr", "tags.focus.tiling.focused_frame.algorithm"], // falgo read (unconditional)
            UNFLOAT_CHAIN("0x1000007"),
            ["jumpto", "0x1000007"],
            ["unlock"],
        ]);
    });

    test("tidying remove: empty frame, >1 frame, tag still holds clients -> remove", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000008"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "0|0|2|grid|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000008"],
            ["^attr clients\\.0x1000008\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""],
            ["^attr tags\\.by-name\\.work\\.client_count$", "0", "3"],
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(0, 0, 2, "grid"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x1000008.floating"],
            ["attr", "tags.focus.floating_focused", "on"], // fails
            ["attr", "tags.by-name.work.client_count"], // tag_total
            ["remove"],
            ["unlock"],
        ]);
    });

    test("tidying reveal: nothing tiled, minimized clients exist -> reveal chain over the tag's clients", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x1000009"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "1|0|2|grid|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x1000009"],
            ["^attr clients\\.0x1000009\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""],
            ["^chain , attr clients\\.0x1000009\\.minimized$", "0", "true"], // has_minimized
            ["^chain , attr clients\\.0x1000009\\.minimized off$", "0", ""], // the reveal
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(1, 0, 2, "grid"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x1000009.floating"],
            ["attr", "tags.focus.floating_focused", "on"], // fails
            ["list_clients", "--tag=work"], // has_minimized re-enumerates
            ["chain", ",", "attr", "clients.0x1000009.minimized"], // has_minimized
            ["list_clients", "--tag=work"], // the reveal re-enumerates
            ["chain", ",", "attr", "clients.0x1000009.minimized", "off"], // reveal
            ["unlock"],
        ]);
    });

    test("fallback: single empty frame, nothing hidden -> use_previous + bring the original client", async () => {
        scenario([
            ["^attr clients\\.focus\\.winid$", "0", "0x100000a"],
            ["^chain , attr tags\\.focus\\.curframe_wcount", "0", "0|0|1|grid|work|800x600+6+35|false"],
            ["^list_clients --tag=work$", "0", "0x100000a"],
            ["^attr clients\\.0x100000a\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""],
            ["^attr tags\\.by-name\\.work\\.client_count$", "0", "0"],
        ]);
        await getExtracted();
        expect(log()).toEqual([
            ["lock"],
            ["attr", "clients.focus.winid"],
            stateChain(0, 0, 1, "grid"),
            ["attr", "tags.focus.floating_focused"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x100000a.floating"],
            ["attr", "tags.focus.floating_focused", "on"], // fails
            ["attr", "tags.by-name.work.client_count"], // tag_total == 0 -> no remove
            ["use_previous"],
            ["bring", "0x100000a"],
            ["unlock"],
        ]);
    });
});

// getFocus — the hc_focus float-register machine ($Mod-f). NO lock is
// ever taken (hc_focus's header: the helpers own their locks).
describe("getFocus (hc_focus port)", () => {
    const UNFLOAT_CHAIN = (wid: string) => [
        "chain",
        ",", "attr", `clients.${wid}.fullscreen`, "off",
        ",", "attr", `clients.${wid}.pseudotile`, "off",
        ",", "attr", `clients.${wid}.floating`, "off",
    ];

    test("(c->e) tiling layer + layer-switch succeeds + EMPTY frame -> un-float the pre-scanned float (no jumpto, no lock)", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000001"],
            ["^attr clients\\.0x2000001\\.floating$", "0", "true"],
            ["^attr clients\\.0x2000001\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "0", ""],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.client_count$", "0", "0"],
        ]);
        await getFocus();
        expect(log()).toEqual([
            ["attr", "tags.focus.name"], // pre-scan
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x2000001.floating"],
            ["attr", "clients.0x2000001.minimized"],
            ["attr", "tags.focus.floating_focused"], // ff read
            ["attr", "tags.focus.floating_focused", "on"], // the try-focus
            ["attr", "tags.focus.tiling.focused_frame.client_count"], // fcc == 0
            UNFLOAT_CHAIN("0x2000001"), // no jumpto — already focused
        ]);
    });

    test("(f) layer-switch succeeds + populated frame -> terminate, the float stays", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000001"],
            ["^attr clients\\.0x2000001\\.floating$", "0", "true"],
            ["^attr clients\\.0x2000001\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "0", ""],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.client_count$", "0", "2"],
        ]);
        await getFocus();
        expect(log()).toEqual([
            ["attr", "tags.focus.name"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x2000001.floating"],
            ["attr", "clients.0x2000001.minimized"],
            ["attr", "tags.focus.floating_focused"],
            ["attr", "tags.focus.floating_focused", "on"],
            ["attr", "tags.focus.tiling.focused_frame.client_count"], // fcc > 0 -> stop
        ]);
    });

    test("(g) switch fails + max layout -> flag chain, hc_center frame, vacated frame removed, hc_fit_to frame, algorithm max", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000003"],
            ["^attr clients\\.0x2000003\\.floating$", "0", "false"], // no visible float
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""], // re-entry fails
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.algorithm$", "0", "max"],
            ["^attr clients\\.focus\\.winid$", "0", "0x2000003"],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.client_count$", "0", "0"],
        ]);
        await getFocus();
        expect(log()).toEqual([
            ["attr", "tags.focus.name"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x2000003.floating"],
            ["attr", "tags.focus.floating_focused"],
            ["attr", "tags.focus.floating_focused", "on"], // fails
            ["attr", "tags.focus.tiling.focused_frame.algorithm"], // algo == max
            ["attr", "clients.focus.winid"],
            ["chain", ",", "attr", "clients.0x2000003.fullscreen", "off",
             ",", "attr", "clients.0x2000003.pseudotile", "off"],
            [`${FIX}/hc_center`, "frame"],
            ["attr", "tags.focus.tiling.focused_frame.client_count"], // vcc == 0
            ["remove"], // Mod-f owns frame closing here
            [`${FIX}/hc_fit_to`, "frame"],
            ["attr", "tags.focus.tiling.focused_frame.algorithm", "max"], // the tail
        ]);
    });

    test("(g) vacated frame still holds clients -> no remove", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000003"],
            ["^attr clients\\.0x2000003\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.algorithm$", "0", "max"],
            ["^attr clients\\.focus\\.winid$", "0", "0x2000003"],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.client_count$", "0", "1"],
        ]);
        await getFocus();
        const entries = log();
        expect(entries).not.toContainEqual(["remove"]);
        expect(entries.slice(-4)).toEqual([
            [`${FIX}/hc_center`, "frame"],
            ["attr", "tags.focus.tiling.focused_frame.client_count"], // vcc == 1
            [`${FIX}/hc_fit_to`, "frame"],
            ["attr", "tags.focus.tiling.focused_frame.algorithm", "max"], // the tail
        ]);
    });

    test("(g) non-max layout -> no lift, just the algorithm=max tail", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000004"],
            ["^attr clients\\.0x2000004\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused on$", "1", ""],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.algorithm$", "0", "grid"],
        ]);
        await getFocus();
        expect(log()).toEqual([
            ["attr", "tags.focus.name"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x2000004.floating"],
            ["attr", "tags.focus.floating_focused"],
            ["attr", "tags.focus.floating_focused", "on"], // fails
            ["attr", "tags.focus.tiling.focused_frame.algorithm"], // grid != max
            ["attr", "tags.focus.tiling.focused_frame.algorithm", "max"], // tail only
        ]);
    });

    test("(h) floating_focused TRUE -> direct un-float (NO hc_tile), client_count read unused", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000005"],
            ["^attr clients\\.0x2000005\\.floating$", "0", "true"],
            ["^attr clients\\.0x2000005\\.minimized$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "true"],
            ["^attr clients\\.focus\\.winid$", "0", "0x2000006"],
            ["^attr tags\\.focus\\.tiling\\.focused_frame\\.client_count$", "0", "1"],
        ]);
        await getFocus();
        expect(log()).toEqual([
            ["attr", "tags.focus.name"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x2000005.floating"],
            ["attr", "clients.0x2000005.minimized"],
            ["attr", "tags.focus.floating_focused"],
            ["attr", "clients.focus.winid"], // wid (fallback to float_wid)
            ["attr", "tags.focus.tiling.focused_frame.client_count"], // read, unused
            UNFLOAT_CHAIN("0x2000006"),
        ]);
    });

    test("(h) no focused window and no visible float -> stop after the reads", async () => {
        scenario([
            ["^attr tags\\.focus\\.name$", "0", "work"],
            ["^list_clients --tag=work$", "0", "0x2000007"],
            ["^attr clients\\.0x2000007\\.floating$", "0", "false"],
            ["^attr tags\\.focus\\.floating_focused$", "0", "true"],
            ["^attr clients\\.focus\\.winid$", "1", ""],
        ]);
        await getFocus();
        expect(log()).toEqual([
            ["attr", "tags.focus.name"],
            ["list_clients", "--tag=work"],
            ["attr", "clients.0x2000007.floating"],
            ["attr", "tags.focus.floating_focused"],
            ["attr", "clients.focus.winid"], // empty -> no float_wid -> stop
        ]);
    });
});

// The deprecated mod-* CLI aliases: still work (same commands), with a
// stderr deprecation note pointing at the new name.
describe("deprecated mod-* aliases", () => {
    test("mod-d alias dispatches the same chain and notes on stderr", async () => {
        const { navCommands } = await import("../src/commands/nav");
        const alias = navCommands.find((c) => c.name === "mod-d")!;
        expect(alias).toBeDefined();
        const errs: string[] = [];
        const origErr = console.error;
        console.error = (msg?: unknown) => errs.push(String(msg));
        try {
            await (alias as unknown as { handler: (i: never) => Promise<void> }).handler(undefined as never);
        } finally {
            console.error = origErr;
        }
        expect(errs.some((e) => e.includes("mod-d is deprecated") && e.includes("get-deck"))).toBe(true);
        expect(log()).toEqual([
            [
                "or",
                ",", "and",
                ".", "compare", "tags.focus.curframe_wcount", "gt", "3",
                ".", "cycle_layout", "+1", "max", "vertical", "grid", "horizontal",
                ",", "and",
                ".", "compare", "tags.focus.curframe_wcount", "=", "2",
                ".", "cycle_layout", "+1", "vertical", "max", "horizontal",
                ",", "cycle_layout", "-1", "vertical", "horizontal", "max",
            ],
        ]);
    });
});
