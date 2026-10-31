// tests/complete.test.ts — the complete-shell verb's candidate logic.
// The attr positional's LIVE completion is delegated to herbstclient
// complete_shell; the runner is injected so tests never touch a WM.

import { describe, expect, test } from "bun:test";

import { complete } from "../src/commands/complete-shell.js";

const fakeRun = (lines: string[]) => async (args: string[]) => {
    // record-keeping via closure inspection in the assertions below
    return lines;
};

describe("complete-shell", () => {
    test("verb slot: all verbs, filtered by prefix", async () => {
        expect(await complete(0, [""])).toEqual(
            ["attr", "complete-shell", "help", "parse", "version"],
        );
        expect(await complete(0, ["a"])).toEqual(["attr"]);
        expect(await complete(0, ["par"])).toEqual(["parse"]);
        expect(await complete(0, ["zzz"])).toEqual([]);
    });

    test("inside a verb, dash prefix is flags; empty word at the attr positional delegates live", async () => {
        // only a dash prefix asks for flags — an empty word at the
        // positional is a live hlwm path request
        expect(await complete(1, ["attr", "--s"])).toEqual(["--space"]);
        let captured: string[] | null = null;
        const run = async (args: string[]) => {
            captured = args;
            return ["tags."];
        };
        expect(await complete(1, ["attr", ""], run)).toEqual(["tags."]);
        expect(captured).toEqual(["complete_shell", "1", "attr", ""]);
    });

    test("inside a verb, dash prefix offers long+short (sorted: longs first)", async () => {
        expect(await complete(1, ["attr", "--s"])).toEqual(["--space"]);
        expect(await complete(1, ["attr", "-"])).toEqual(
            ["--escape", "--help", "--space", "-e", "-h", "-s"],
        );
    });

    test("after a value-taking flag: no candidates", async () => {
        expect(await complete(2, ["attr", "--space", ""])).toEqual([]);
        expect(await complete(2, ["attr", "-s", ""])).toEqual([]);
    });

    test("attr positional: delegates LIVE to herbstclient complete_shell", async () => {
        let captured: string[] | null = null;
        const run = async (args: string[]) => {
            captured = args;
            return ["clients.focus.", "tags.by-name."];
        };
        const got = await complete(1, ["attr", "clients."], run);
        // the word indexes align: the verb is word 0 in both command
        // lines, so POS passes through unchanged and the attr verb +
        // positionals follow
        expect(captured).toEqual([
            "complete_shell", "1", "attr", "clients.",
        ]);
        expect(got).toEqual(["clients.focus.", "tags.by-name."]);
    });

    test("attr positional deeper index: POS passes through unchanged", async () => {
        let captured: string[] | null = null;
        const run = async (args: string[]) => {
            captured = args;
            return [];
        };
        // herbstutil attr <p1> <p2> — completing index 2
        await complete(2, ["attr", "a", "b"], run);
        expect(captured).toEqual(["complete_shell", "2", "attr", "a", "b"]);
    });

    test("attr positional, delegate failure: empty, still resolvable", async () => {
        const run = async (_args: string[]) => {
            throw new Error("herbstclient: no WM");
        };
        const got = await complete(1, ["attr", "clients."], run);
        expect(got).toEqual([]);
    });

    test("parse positional: no live candidates (stdin-driven)", async () => {
        let called = false;
        const run = async () => {
            called = true;
            return ["should-not-happen"];
        };
        expect(await complete(1, ["parse", ""], run)).toEqual([]);
        expect(called).toBe(false);
    });

    test("unknown verb: no candidates", async () => {
        expect(await complete(1, ["zzz", ""])).toEqual([]);
    });
});
