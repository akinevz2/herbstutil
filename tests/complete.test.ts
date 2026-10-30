// tests/complete.test.ts — the complete-shell verb's candidate logic
// (pure computation; mirrors how hlwm's completion.cpp is exercised).

import { describe, expect, test } from "bun:test";
import { complete } from "../src/commands/complete-shell.js";

describe("complete-shell", () => {
    test("verb slot: all verbs, filtered by prefix", () => {
        expect(complete(0, [""])).toEqual(
            ["attr", "complete-shell", "help", "parse", "version"],
        );
        expect(complete(0, ["a"])).toEqual(["attr"]);
        expect(complete(0, ["par"])).toEqual(["parse"]);
        expect(complete(0, ["zzz"])).toEqual([]);
    });

    test("inside a verb, empty word offers short flags", () => {
        // attr: -s, -e, -h
        expect(complete(1, ["attr", ""])).toEqual(["-s", "-e", "-h"]);
    });

    test("inside a verb, dash prefix offers long+short", () => {
        const got = complete(1, ["attr", "--s"]);
        expect(got).toEqual(["--space"]);
        // sorted: long flags group before shorts
        expect(complete(1, ["attr", "-"])).toEqual(["--escape", "--help", "--space", "-e", "-h", "-s"]);
    });

    test("after a value-taking flag: no candidates", () => {
        expect(complete(2, ["attr", "--space", ""])).toEqual([]);
        expect(complete(2, ["attr", "-s", ""])).toEqual([]);
    });

    test("unknown verb: no candidates", () => {
        expect(complete(1, ["zzz", ""])).toEqual([]);
    });

    test("parse shares attr's flag set", () => {
        expect(complete(1, ["parse", "--e"])).toEqual(["--escape"]);
    });
});
