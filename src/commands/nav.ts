// src/commands/nav.ts — the dots keybind chains + float/keybind state
// machines, as importable functions and `herbstutil mod-*` subcommands.
//
// Every function issues the SAME herbstclient chains the dots bindings
// express (ports of ~/dots/herbst_focus/.config/herbstluftwm/keys.d/
// {focus,floating}.sh, ~/dots/herbstluftwm/.config/herbstluftwm/
// keys.d/nav.sh + autostart, and the ~/dots/herbst_focus/.local/bin/
// {hc_zoom,hc_floatx} state machines — ported faithfully, token for
// token). The helpers the scripts delegate to (hc_center, hc_resize,
// hc_fit_to, hc_tile, hc_maximize, hc_unmaximize, polyframes) are
// spawned from the same place the scripts use: $HOME/.local/bin —
// override with HERBSTUTIL_HELPER_DIR (tests point this at a fixture
// directory).
//
// Fail-soft everywhere (the dots wrapper convention): a failed
// herbstclient call (missing object, vanished window) resolves null
// instead of throwing — a vanished window may never wedge the bar or
// the keybind.

import { defineCommand } from "@bunli/core";

const HERBSTCLIENT = "herbstclient";

/** The dots helper directory (hc_center, hc_maximize, polyframes, …). */
function helperDir(): string {
    return process.env.HERBSTUTIL_HELPER_DIR ?? `${process.env.HOME}/.local/bin`;
}

/** Spawn env exactly like the dots scripts: DISPLAY defaults to
 *  localhost:0.0 (WSL2 + VcXsrv convention), WAYLAND_DISPLAY stripped
 *  (WSLg's socket makes dual-backend apps abort). */
function spawnEnv(): Record<string, string> {
    const { WAYLAND_DISPLAY: _strip, ...rest } = process.env;
    return { ...rest, DISPLAY: process.env.DISPLAY || "localhost:0.0" };
}

/**
 * Run `herbstclient <args...>`. Resolves { stdout } on exit 0, null on
 * ANY failure (missing object / unreachable WM / 5s timeout) — the
 * fail-soft contract; callers branch on null instead of catching.
 * The 5-second timeout is the dots wrapper convention (a hung WM may
 * never wedge the bar or the keybind).
 */
async function hc(...args: string[]): Promise<{ stdout: string } | null> {
    try {
        const proc = Bun.spawn([HERBSTCLIENT, ...args], {
            stdout: "pipe",
            stderr: "pipe",
            env: spawnEnv(),
            timeout: 5000,
        });
        const stdout = await new Response(proc.stdout).text();
        const code = await proc.exited;
        return code === 0 ? { stdout } : null;
    } catch {
        return null;
    }
}

/**
 * Run a dots helper script (hc_center, hc_resize, hc_fit_to, hc_tile,
 * hc_maximize, hc_unmaximize) to completion. Resolves true on exit 0 —
 * the scripts' callers all use `|| true`, so failures are tolerated.
 */
async function helper(name: string, args: string[] = []): Promise<boolean> {
    try {
        const proc = Bun.spawn([`${helperDir()}/${name}`, ...args], {
            stdout: "ignore",
            stderr: "ignore",
            env: spawnEnv(),
            timeout: 5000,
        });
        return (await proc.exited) === 0;
    } catch {
        return false;
    }
}

/** Raw leaf read, trimmed ("" when the read failed). */
async function attrRaw(path: string): Promise<string> {
    return (await hc("attr", path))?.stdout.trim() ?? "";
}

/** herbstclient list_clients --tag=NAME → wids (WM order). */
async function listClientsByTag(tag: string): Promise<string[]> {
    const r = await hc("list_clients", `--tag=${tag}`);
    if (r === null) return [];
    return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// The pure keybind chains (single `herbstclient` spawns — the chains ARE
// the binding, verbatim from the keys.d fragments).
// ---------------------------------------------------------------------------

/** $Mod-s — the zoom/peek grid (focus.sh): urgent jumpto, frame-down
 *  focus, the floating-layer branch (attr floating_focused true both
 *  focuses the floating layer AND fails through when it is empty), the
 *  cycle fallbacks and the pseudotile toggle. One chained spawn, held
 *  under lock. */
export async function getSouth(): Promise<void> {
    await hc(
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
    );
}

/** $Mod-e (focus.sh): with >1 frame cycle backwards, else explode the
 *  frame and cycle forward. */
export async function getExplore(): Promise<void> {
    await hc(
        "or", ".",
        "and", ",", "compare", "tags.focus.frame_count", "gt", "1", ",", "cycle_frame", "-1",
        ".", "chain", "!", "split", "explode", "!", "cycle_frame",
    );
}

/** $Mod-w (nav.sh): leave the floating layer, then cycle window/frame
 *  upward — focus --level=frame up, cycle_frame. */
export async function getForward(): Promise<void> {
    await hc(
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
    );
}

/** $Mod-d (nav.sh): the layout cycler — count-gated cycle_layout mixes
 *  (4+ windows, exactly 2) with a bare -1 rotation fallback. */
export async function getDeck(): Promise<void> {
    await hc(
        "or",
        ",", "and",
        ".", "compare", "tags.focus.curframe_wcount", "gt", "3",
        ".", "cycle_layout", "+1", "max", "vertical", "grid", "horizontal",
        ",", "and",
        ".", "compare", "tags.focus.curframe_wcount", "=", "2",
        ".", "cycle_layout", "+1", "vertical", "max", "horizontal",
        ",", "cycle_layout", "-1", "vertical", "horizontal", "max",
    );
}

/** $Mod-a (autostart): focus the frame to the left, or split one off
 *  at a third of the width when there is nothing to focus. */
export async function getAdvice(): Promise<void> {
    await hc(
        "or",
        ",", "focus", "left", "--level=frame",
        ",", "split", "left", "0.33333",
    );
}

/** $ModShift-w (nav.sh): shift the window up into the frame above
 *  (--level=all); with nothing above, cycle the frame's windows -1 or
 *  cycle/rotate frames. */
export async function modShiftW(): Promise<void> {
    await hc(
        "or",
        ",", "shift", "--level=all", "up",
        ",", "or",
        "!", "and", ".", "compare", "tags.focus.frame_count", "gt", "1", ".", "cycle_frame",
        "!", "cycle", "-1",
        ",", "chain", "!", "lock", "!", "rotate", "!", "unlock",
    );
}

/** $ModShift-b (autostart): with >1 window in the focused frame, split
 *  a bottom frame and shift the window down into it. */
export async function getBelow(): Promise<void> {
    await hc(
        "or", ".",
        "and", ",", "compare", "tags.focus.curframe_wcount", "gt", "1",
        ",", "chain", "!", "split", "bottom", "!", "shift", "down",
    );
}

/** $ModShift-d (nav.sh): with >1 window in the focused frame mix in
 *  the max/grid/vertical layouts, otherwise remove the focused frame
 *  (the shift-complement of $Mod-d's cycler). */
export async function getDedeck(): Promise<void> {
    await hc(
        "or",
        ".", "and",
        ",", "compare", "tags.focus.curframe_wcount", "gt", "1",
        ",", "cycle_layout", "+1", "max", "grid", "vertical",
        ".", "remove",
    );
}

/** $Mod-q (floating.sh): a focused float is ONLY un-floated; tiling
 *  windows get closed, with a lone-window frame removed afterwards
 *  (close_and_remove / close_or_remove). Under lock. */
export async function getQuiet(): Promise<void> {
    await hc(
        "chain", "!", "lock",
        "!", "or",
        ".", "and", ",", "compare", "tags.focus.floating_focused", "=", "true",
        ",", "attr", "clients.focus.floating", "off",
        ".", "and", ",", "compare", "tags.focus.curframe_wcount", "=", "1",
        ",", "close_and_remove",
        ".", "close_or_remove",
        "!", "unlock",
    );
}

// ---------------------------------------------------------------------------
// The state machines (ports of hc_zoom / hc_floatx) and the small
// imperatives polyframes currently composes inline.
// ---------------------------------------------------------------------------

/**
 * un-float a float by wid and focus it (hc_floatx's unfloat_wid): fold
 * the fullscreen/pseudotile flags, floating off, then jumpto. The
 * chain is intentionally fail-soft (2>/dev/null || true in the
 * source).
 */
export async function unfloatWid(wid: string): Promise<void> {
    await hc(
        "chain",
        ",", "attr", `clients.${wid}.fullscreen`, "off",
        ",", "attr", `clients.${wid}.pseudotile`, "off",
        ",", "attr", `clients.${wid}.floating`, "off",
    );
    await hc("jumpto", wid);
}

/**
 * Float a window and center it within the FOCUSED frame's content
 * geometry (the scrollFocus "float + center to frame" composition):
 * floating on, then hc_center frame — under a lock so both land in one
 * motion (no intermediate paint of the uncentered float). The vacated
 * frame is deliberately left in place.
 */
export async function floatCenterFrame(wid: string): Promise<void> {
    await hc("lock");
    try {
        await hc("set_attr", `clients.${wid}.floating`, "true");
        await helper("hc_center", ["frame"]);
    } finally {
        await hc("unlock");
    }
}

/**
 * Minimize a window while deliberately KEEPING its frame (the
 * scrollFocus down step of the escalation ladder — tiled windows
 * minimize without the frame-removal dance).
 */
export async function minimizeKeepFrame(wid: string): Promise<void> {
    await hc("set_attr", `clients.${wid}.minimized`, "true");
}

/**
 * Prune an empty focused frame: if the tag has more than one frame and
 * the FOCUSED frame holds zero clients, remove it. Checks the focused
 * frame (not the window's parent_frame) because minimized windows lose
 * their parent_frame attribute.
 */
export async function removeEmptyFrame(): Promise<void> {
    const frameCount = Number((await attrRaw("tags.focus.frame_count")) || "1");
    if (frameCount <= 1) return;
    const clients = Number(
        (await attrRaw("tags.focus.tiling.focused_frame.client_count")) || "1");
    if (clients < 1) {
        await hc("remove");
    }
}

/**
 * getZoom — hc_zoom, the three-state press machine for the focused
 * window (bound as $ModCtrl-f in dots; the hc_zoom press register):
 *   press 1  tiled      -> float it, stretched to fill the frame
 *   press 2  floating   -> maximize onto a dedicated <tag>-max tag
 *   press 3  maximized  -> restore to the original tag/frame
 * Every branch ends centered inside the focused frame of the tag it
 * lands on. The "-max" check MUST come before the floating check or a
 * maximized window would be misread as tiled and re-floated instead of
 * restored (hc_zoom's header). The maximize/restore record/restore
 * state lives in hlwm env (PF_MAX_FRAME_<wid> / PF_MAX_WIN_<wid>) and
 * is owned by the hc_maximize/hc_unmaximize helpers this delegates to
 * — exactly as the script does — so the PF_MAX state handling (and the
 * hc_maximize-daemon janitor they spawn) is preserved untouched.
 *
 * Resolves false when there is no focused window (hc_zoom exits 1);
 * the CLI subcommand maps that to exit code 1.
 */
export async function getZoom(): Promise<boolean> {
    const wid = await attrRaw("clients.focus.winid");
    if (!wid) {
        console.error("mod-f: no focused window");
        return false;
    }

    // Hold the WM lock across the whole toggle (hc_zoom's outer lock):
    // branch (a) runs hc_center followed by hc_resize, and without an
    // outer lock the window would be drawn at the centered geometry for
    // a frame before jumping to the frame-filling one (visible flash).
    // hlwm's lock is reference-counted, so the nested locks inside the
    // helpers stay balanced.
    if (!(await hc("lock"))) return false;
    try {
        const tag = await attrRaw(`clients.${wid}.tag`);
        const floating = (await attrRaw(`clients.${wid}.floating`)) || "false";

        if (tag.endsWith("-max")) {
            // (c) maximized -> back to the original tag/frame
            await helper("hc_unmaximize", [wid]);
        } else if (floating === "true") {
            // (b) floating, not maximized -> dedicated max tag
            await helper("hc_maximize", [wid]);
        } else {
            // (a) tiled -> float the focused window directly: clear
            // stray fullscreen/pseudotile flags, then hc_center root
            // floats it, centers it inside its focused frame and
            // focuses it; hc_resize <wid> frame is the deco-flush fill
            // and hc_fit_to root the idempotent guard.
            await hc("attr", `clients.${wid}.fullscreen`, "off");
            await hc("attr", `clients.${wid}.pseudotile`, "off");
            await helper("hc_center", ["root"]);
            await helper("hc_resize", [wid, "frame"]);
            await helper("hc_fit_to", ["root"]);
        }
    } finally {
        await hc("unlock");
    }
    return true;
}

/**
 * getExtracted — hc_floatx, the layer-focus toggle / yanker (all branches,
 * faithfully):
 *
 *   floating_focused FALSE (tiling layer owns focus):
 *     1. TRY focusing a float (floating_focused on; it fails when no
 *        non-minimized float exists).
 *     2. Success -> UN-FLOAT the float it focused (the pre-scanned
 *        first_float is PRIMARY — clients.focus settles late after the
 *        switch).
 *     3. Failure -> no floats exist:
 *          populated focused frame  -> YANK: the focused client floats
 *                                     at its current size, centered in
 *                                     the monitor, INTO the float
 *                                     session. The vacated frame is
 *                                     deliberately LEFT ALONE (the
 *                                     frame is only ever closed in
 *                                     the tidying branch).
 *          empty focused frame      -> tidying (frame removal, reveal
 *                                     minimized, polyframes hidden in
 *                                     max layout, or use_previous).
 *
 *   floating_focused TRUE (a float holds the layer focus):
 *     populated focused frame, ONE frame on the tag -> use_previous,
 *                                 hc_tile, un-float the focused client
 *                                 there.
 *     populated focused frame, MULTIPLE frames -> DEFER: hand focus to
 *                                 the tiling layer; the next press
 *                                 re-runs the focus-and-un-float branch.
 *     empty focused frame      -> UN-FLOAT the focused float into the
 *                                 empty frame.
 *
 * Un-float chains intentionally contain NO floating_focused off — hlwm
 * tracks the register on un-float (the defensive write raced with it).
 * Standalone register writes (defer, re-entry failure) remain.
 */
export async function getExtracted(): Promise<void> {
    await hc("lock");
    try {
        const orig = await attrRaw("clients.focus.winid");

        // One batched state read (hc_floatx's chain+echo round trip):
        // curframe_wcount | focused_frame.client_count | frame_count |
        // focused_frame.algorithm | tag name | focused content_geometry
        // | floating_effectively. Newlines stripped, pipe-split — the
        // same parsing the script does.
        const state = await hc(
            "chain",
            ",", "attr", "tags.focus.curframe_wcount", ",", "echo", "|",
            ",", "attr", "tags.focus.tiling.focused_frame.client_count", ",", "echo", "|",
            ",", "attr", "tags.focus.frame_count", ",", "echo", "|",
            ",", "attr", "tags.focus.tiling.focused_frame.algorithm", ",", "echo", "|",
            ",", "attr", "tags.focus.name", ",", "echo", "|",
            ",", "attr", "tags.focus.tiling.focused_frame.content_geometry", ",", "echo", "|",
            ",", "attr", "clients.focus.floating_effectively",
        );
        const st = (state?.stdout ?? "").replace(/\n/g, "").split("|");
        const frameClients = st[0] || "0";
        const frameCc = st[1] || "0";
        const frameCount = st[2] || "1";
        const algo = st[3] ?? "";
        const tag = st[4] ?? "";

        const tagTotal = async (): Promise<string> => {
            if (!tag) return "0";
            return (await attrRaw(`tags.by-name.${tag}.client_count`)) || "0";
        };

        const hasMinimizedClients = async (): Promise<boolean> => {
            if (!tag) return false;
            const wids = await listClientsByTag(tag);
            if (wids.length === 0) return false;
            const r = await hc(
                "chain",
                ...wids.flatMap((w) => [",", "attr", `clients.${w}.minimized`]),
            );
            return r?.stdout.includes("true") ?? false;
        };

        // Scan for the first visible (non-minimized) float on the tag,
        // resolved UP FRONT (clients.focus settles late after the
        // switch).
        const ff = (await attrRaw("tags.focus.floating_focused")) || "false";
        let firstFloat = "";
        for (const c of await listClientsByTag(tag)) {
            const floating = (await attrRaw(`clients.${c}.floating`)) || "false";
            if (floating === "true") {
                const minimized = (await attrRaw(`clients.${c}.minimized`)) || "false";
                if (minimized === "false") {
                    firstFloat = c;
                    break;
                }
            }
        }

        // Mod-f's tile register, performed HERE (Mod-x owns hc_tile in
        // this branch): populated frame in a NON-MAX layout ->
        // un-float directly; populated frame in max layout -> hc_tile
        // makes the new empty frame and the window un-floats into it.
        const unfloatIntoFrameBelow = async (wid: string): Promise<void> => {
            const fcc = (await attrRaw("tags.focus.tiling.focused_frame.client_count")) || "0";
            const falgo = await attrRaw("tags.focus.tiling.focused_frame.algorithm");
            if (fcc !== "0" && falgo === "max") {
                await helper("hc_tile", [wid]);
                return;
            }
            await unfloatWid(wid);
        };

        if (ff === "true") {
            if (frameCc !== "0") {
                if (frameCount === "1") {
                    // The revised sequence: use_previous (back to the
                    // previously viewed tag), hc_tile (the tile register
                    // on whatever holds focus there), then un-float the
                    // newly focused client if it is floating.
                    await hc("use_previous");
                    await helper("hc_tile");
                    const wfocus = await attrRaw("clients.focus.winid");
                    if (wfocus) {
                        await hc("attr", `clients.${wfocus}.floating`, "false");
                    }
                } else {
                    // DEFER: hand focus to the tiling layer; the next
                    // press re-runs the focus-and-un-float branch.
                    await hc("attr", "tags.focus.floating_focused", "off");
                }
                return;
            }
            // Empty focused frame: un-float the float into it directly.
            const wfocus = await attrRaw("clients.focus.winid");
            if (wfocus) {
                await unfloatIntoFrameBelow(wfocus);
                return;
            }
            await hc("attr", "tags.focus.floating_focused", "off");
            return;
        }

        // floating_focused FALSE: try focusing a float FIRST.
        if ((await hc("attr", "tags.focus.floating_focused", "on")) !== null) {
            // Success: the switched-to float is un-floated (manual
            // un-float is Mod-x's register). The PRE-SCANNED first_float
            // is PRIMARY — clients.focus settles late after the switch.
            const wfocus = firstFloat || (await attrRaw("clients.focus.winid"));
            if (wfocus) {
                await unfloatWid(wfocus);
                return;
            }
            await hc("attr", "tags.focus.floating_focused", "off");
            return;
        }

        // Re-entry failed: no non-minimized float exists.
        if (Number(frameCc) > 0) {
            // YANK: float the focused client, center it in the monitor's
            // geometry at its current size, INTO the float session. The
            // (now possibly empty) frame is deliberately LEFT ALONE.
            await hc("attr", "clients.focus.floating", "on");
            await helper("hc_center", ["root"]);
            await hc("attr", "tags.focus.floating_focused", "on");
            return;
        }

        // Empty frame, no floats: tidying.
        if (Number(frameCount) > 1) {
            if (frameClients === "0" && (await tagTotal()) !== "0") {
                await hc("remove");
                return;
            }
            // Hidden windows exist and nothing is tiled in the focused
            // frame: reveal them.
            if ((await hasMinimizedClients()) && Number(frameCc) === 0) {
                const wids = await listClientsByTag(tag);
                await hc(
                    "chain",
                    ...wids.flatMap((w) => [",", "attr", `clients.${w}.minimized`, "off"]),
                );
                return;
            }
        }

        if (frameClients === "0" && (await tagTotal()) !== "0") {
            await hc("remove");
            return;
        }

        if (algo === "max" && (await hasMinimizedClients()) && Number(frameClients) < 1) {
            await hc("spawn", `${helperDir()}/polyframes hidden`);
            return;
        }

        await hc("use_previous");
        if (orig) await hc("bring", orig);
    } finally {
        await hc("unlock");
    }
}

/**
 * getFocus — hc_focus, the float-register machine (the $Mod-f key —
 * distinct from getZoom, which is hc_zoom on $ModCtrl-f):
 *
 *   Pre-scan the first VISIBLE float on the tag (the only candidate
 *   the floating layer can focus; a fallback for the focus read that
 *   may lag right after the layer switch).
 *
 *   floating_focused FALSE:
 *     TRY the layer switch (floating_focused on; fails when no
 *     non-minimized float exists).
 *     Success -> the float it focused STAYS floating when the focused
 *     frame holds children (no stacking); an EMPTY frame -> UN-FLOAT
 *     the float into it (the register chain: fullscreen/pseudotile/
 *     floating off — NO jumpto, the window is already focused; NO
 *     floating_focused write — hlwm tracks the register on un-float).
 *     Failure -> float the current window, but ONLY when the focused
 *     frame's layout algorithm is "max": flags off, hc_center frame
 *     (the size-keeping lift), close the vacated frame when it reads
 *     zero clients (`remove` — Mod-f owns frame closing on this path),
 *     hc_fit_to frame. Afterwards the focused frame is set to the max
 *     algorithm regardless (the script's unconditional tail).
 *
 *   floating_focused TRUE (a float has focus): DIRECT un-float — no
 *   hc_tile (that is Mod-x's register; the window re-tiles into the
 *   frame below whatever it holds). The frame's client_count is read
 *   first and unused — the script does exactly that.
 *
 *   NO script-level lock: the helpers take their own
 *   reference-counted WM locks (hc_focus's header).
 */
export async function getFocus(): Promise<void> {
    const tag = await attrRaw("tags.focus.name");

    // Pre-scan the first visible (non-minimized) float on the tag.
    let floatWid = "";
    if (tag) {
        for (const c of await listClientsByTag(tag)) {
            const floating = (await attrRaw(`clients.${c}.floating`)) || "false";
            if (floating === "true") {
                const minimized = (await attrRaw(`clients.${c}.minimized`)) || "false";
                if (minimized === "false") {
                    floatWid = c;
                    break;
                }
            }
        }
    }

    const ff = (await attrRaw("tags.focus.floating_focused")) || "false";

    if (ff !== "true") {
        // a) false; b) try the layer switch.
        if ((await hc("attr", "tags.focus.floating_focused", "on")) !== null) {
            // c) switch succeeded. The PRE-SCANNED float wid is PRIMARY —
            // clients.focus may lag a settle-tick after the switch.
            const fcc = (await attrRaw("tags.focus.tiling.focused_frame.client_count")) || "0";
            const wid = floatWid || (await attrRaw("clients.focus.winid"));
            if (fcc === "0") {
                // e) un-float the float into the empty frame (no jumpto —
                // it is already focused; no register write — hlwm tracks
                // it on un-float).
                await hc(
                    "chain",
                    ",", "attr", `clients.${wid}.fullscreen`, "off",
                    ",", "attr", `clients.${wid}.pseudotile`, "off",
                    ",", "attr", `clients.${wid}.floating`, "off",
                );
            }
            // f) otherwise: terminate — the float stays floating, the
            // floating layer holds focus (no stacking).
            return;
        }

        // g) the switch failed (no float to focus): float the current
        // window — but ONLY in the max layout.
        const algo = await attrRaw("tags.focus.tiling.focused_frame.algorithm");
        if (algo === "max") {
            const wid = await attrRaw("clients.focus.winid");
            if (wid) {
                await hc(
                    "chain",
                    ",", "attr", `clients.${wid}.fullscreen`, "off",
                    ",", "attr", `clients.${wid}.pseudotile`, "off",
                );
                await helper("hc_center", ["frame"]);
                // The lifted window vacated its tile — when the focused
                // frame reads zero clients now, close it (Mod-f's
                // register; removes the split).
                const vcc = (await attrRaw("tags.focus.tiling.focused_frame.client_count")) || "1";
                if (vcc === "0") {
                    await hc("remove");
                }
                await helper("hc_fit_to", ["frame"]);
            }
        }
        await hc("attr", "tags.focus.tiling.focused_frame.algorithm", "max");
        return;
    }

    // h) floating_focused TRUE: a floating window has focus. Direct
    // un-float — NO hc_tile (Mod-x's register).
    let wid = await attrRaw("clients.focus.winid");
    if (!wid) wid = floatWid;
    if (!wid) return;
    await attrRaw("tags.focus.tiling.focused_frame.client_count");
    await hc(
        "chain",
        ",", "attr", `clients.${wid}.fullscreen`, "off",
        ",", "attr", `clients.${wid}.pseudotile`, "off",
        ",", "attr", `clients.${wid}.floating`, "off",
    );
}

// ---------------------------------------------------------------------------
// CLI subcommands — herbstutil get-south | get-forward | get-deck |
// get-explore | get-advice | get-shift-w | get-below | get-quiet |
// get-zoom | get-extracted | get-dedeck | get-focus — so dots keybinds
// can call them directly. The old mod-* names remain as deprecated
// aliases (they still work; a note is printed on stderr) until the
// dots keybinds are re-pointed.
// ---------------------------------------------------------------------------

function navCommand(name: string, description: string, run: () => Promise<boolean | void>) {
    return defineCommand({
        name: name as never,
        description,
        handler: async () => {
            const ok = await run();
            if (ok === false) process.exit(1);
        },
    });
}

/** Deprecated mod-* alias: same behavior, stderr note, exit codes kept. */
function deprecatedCommand(alias: string, replacement: string, run: () => Promise<boolean | void>) {
    return navCommand(alias, `(deprecated) use ${replacement}`, async () => {
        console.error(`herbstutil ${alias} is deprecated — use herbstutil ${replacement}`);
        return await run();
    });
}

export const navCommands = [
    navCommand("get-south", "[$Mod-s] Zoom/peek grid: urgent jumpto, frame-down focus, float-layer un-float, cycle/pseudotile fallbacks", getSouth),
    navCommand("get-forward", "[$Mod-w] Leave the floating layer and cycle window/frame upward", getForward),
    navCommand("get-deck", "[$Mod-d] Count-gated layout cycling (cycle_layout mixes, -1 fallback)", getDeck),
    navCommand("get-explore", "[$Mod-e] Cycle frames backward, or explode when it is the last split", getExplore),
    navCommand("get-advice", "[$Mod-a] Focus the frame left, or split one off at 1/3 width", getAdvice),
    navCommand("mod-shift-w", "[$ModShift-w] Shift window up / cycle -1 / cycle+rotate frames (not yet renamed)", modShiftW),
    navCommand("get-below", "[$ModShift-b] Split a bottom frame and shift the window down into it", getBelow),
    navCommand("get-quiet", "[$Mod-q] Un-float a focused float, else close (lone-window frames removed)", getQuiet),
    navCommand("get-zoom", "[hc_zoom, $ModCtrl-f] Three-state toggle: float (frame fill) -> <tag>-max maximize -> restore", getZoom),
    navCommand("get-extracted", "[hc_floatx, $Mod-x] Layer-yank state machine: focus-a-float-then-unfloat / yank / defer / slurp / tidying", getExtracted),
    navCommand("get-dedeck", "[$ModShift-d] Count-gated layout mix, else remove the focused frame", getDedeck),
    navCommand("get-focus", "[hc_focus, $Mod-f] Float-register machine: focus-a-float-and-unfloat / max-layout lift / direct un-float", getFocus),
    // Deprecated aliases (old scheme) — still work.
    deprecatedCommand("mod-s", "get-south", getSouth),
    deprecatedCommand("mod-w", "get-forward", getForward),
    deprecatedCommand("mod-d", "get-deck", getDeck),
    deprecatedCommand("mod-e", "get-explore", getExplore),
    deprecatedCommand("mod-a", "get-advice", getAdvice),
    deprecatedCommand("mod-shift-b", "get-below", getBelow),
    deprecatedCommand("mod-q", "get-quiet", getQuiet),
    deprecatedCommand("mod-f", "get-zoom", getZoom),
    deprecatedCommand("mod-x", "get-extracted", getExtracted),
];
