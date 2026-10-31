// complete-shell — the completion verb, mirroring herbstclient's
// complete_shell (hlwm's completion.cpp + share/herbstclient-completion.bash):
//
//   herbstutil complete-shell <position> <words...>
//
// <position> indexes the word being completed within <words...>
// (0 = the first word after the binary name). The verb prints the
// candidate words, one per line, and ALWAYS exits 0 quietly — shell
// completion must never fail the command line. The installed
// completion scripts (share/) are thin: they only call this verb and
// feed the result to bash's COMPREPLY / zsh's compadd.
//
// The `attr` verb's positional completes LIVE attribute paths: the
// request is delegated to `herbstclient -q complete_shell` itself —
// the same live-tree query hlwm's own completion performs (the word
// indexes align because the verb is position 0 in both command
// lines). No WM / WM down → no candidates, still exit 0.

// the static completion tree (hlwm keeps its own in completion.cpp —
// same idea: the program knows its own grammar)
const VERBS = ["attr", "parse", "complete-shell", "help", "version"] as const;

// per-verb flags: [long, short, takesValue]
const FLAGS: Record<string, [string, string, boolean][]> = {
    attr: [
        ["--space", "-s", true],
        ["--escape", "-e", false],
        ["--help", "-h", false],
    ],
    parse: [
        ["--space", "-s", true],
        ["--escape", "-e", false],
        ["--help", "-h", false],
    ],
    "complete-shell": [["--help", "-h", false]],
    help: [],
    version: [],
};

type Runner = (args: string[]) => string[];

/** the live delegate: herbstclient -q complete_shell POS attr ... */
function liveRun(args: string[]): string[] {
    let proc: Bun.Subprocess;
    try {
        proc = Bun.spawn(["herbstclient", "-q", ...args], {
            stdout: "pipe",
            stderr: "ignore", // quiet: completion never surfaces errors
        });
    } catch {
        return [];
    }
    return new Response(proc.stdout).text().then((t) =>
        t.split("\n").map((l) => l.trim()).filter(Boolean),
    ) as unknown as string[];
}

// NOTE: Bun.spawn + Response text is async; the completion function
// is therefore async end-to-end (bash/zsh scripts just capture stdout,
// they don't care).

/** candidates for one completion request */
export async function complete(
    pos: number,
    words: string[],
    run: Runner = liveRun,
): Promise<string[]> {
    const word = words[pos] ?? "";
    const verb = words[0] ?? "";

    // completing the verb slot
    if (pos === 0) {
        return VERBS.filter((v) => v.startsWith(word)).sort();
    }

    if (!(FLAGS as Record<string, unknown>)[verb]) return [];
    const flags = FLAGS[verb] ?? [];

    // flag-name completion
    if (word.startsWith("-")) {
        const out: string[] = [];
        for (const [long, short] of flags) {
            if (long.startsWith(word)) out.push(long);
            if (short.startsWith(word)) out.push(short);
        }
        return out.sort();
    }

    // the value of a value-taking flag: no candidates (free-form)
    const prev = words[pos - 1] ?? "";
    const takesValue = flags.some(
        ([long, short, tv]) => tv && (prev === long || prev === short),
    );
    if (takesValue) return [];

    // positional of the attr verb: LIVE hlwm object-path completion —
    // delegate to herbstclient itself (POS is unchanged: the verb is
    // word 0 in both command lines). A failing delegate (WM down, spawn
    // error) yields no candidates — completion stays resolvable.
    if (verb === "attr") {
        try {
            return await run(["complete_shell", String(pos), verb, ...words.slice(1)]);
        } catch {
            return [];
        }
    }

    // parse reads stdin; its positional has no candidates
    return [];
}

export default {
    name: "complete-shell",
    description: "Shell-completion candidates (mirrors herbstclient complete_shell)",
    handler: async ({ positional }: { positional: string[] }) => {
        const pos = Number.parseInt(positional[0] ?? "0", 10);
        const words = positional.slice(1);
        const candidates = Number.isFinite(pos)
            ? await complete(pos, words)
            : [];
        if (candidates.length > 0) console.log(candidates.join("\n"));
        process.exit(0); // never fail the completion (hlwm -q contract)
    },
};
