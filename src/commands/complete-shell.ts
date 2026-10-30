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

/** candidates for one completion request */
export function complete(pos: number, words: string[]): string[] {
    const word = words[pos] ?? "";
    const verb = words[0] ?? "";

    // completing the verb slot
    if (pos === 0) {
        return VERBS.filter((v) => v.startsWith(word)).sort();
    }

    // completing inside a known verb: flags (value-taking flags get
    // completed only as names, never as their argument — the argument
    // is free-form)
    if (!(FLAGS as Record<string, unknown>)[verb]) return [];
    const flags = FLAGS[verb] ?? [];
    if (word.startsWith("-")) {
        const out: string[] = [];
        for (const [long, short] of flags) {
            if (long.startsWith(word)) out.push(long);
            if (short.startsWith(word)) out.push(short);
        }
        return out.sort();
    }
    // after a value-taking flag: no candidates (the user is typing a
    // value); otherwise: another flag only when nothing has been given
    const prev = words[pos - 1] ?? "";
    const takesValue = flags.some(
        ([long, short, tv]) => tv && (prev === long || prev === short),
    );
    if (!takesValue && !word.startsWith("-")) {
        return flags.filter(([, s]) => !s.startsWith("--")).map(([, s]) => s);
    }
    return [];
}

export default {
    name: "complete-shell",
    description: "Shell-completion candidates (mirrors herbstclient complete_shell)",
    handler: async ({ positional }: { positional: string[] }) => {
        const pos = Number.parseInt(positional[0] ?? "0", 10);
        const words = positional.slice(1);
        const candidates = Number.isFinite(pos)
            ? complete(pos, words)
            : [];
        if (candidates.length > 0) console.log(candidates.join("\n"));
        process.exit(0); // never fail the completion (hlwm -q contract)
    },
};
