// scripts/completion.ts — install/uninstall the shell completion
// files (the share/ mirrors of hlwm's herbstclient completion):
//
//   bun scripts/completion.ts install     (npm run completion:install)
//   bun scripts/completion.ts uninstall   (npm run completion:uninstall)
//   bun scripts/completion.ts print       (print the scripts to stdout)
//
// Destinations (user-level, no sudo):
//   bash: ~/.local/share/bash-completion/completions/herbstutil
//   zsh:  ~/.local/share/zsh/site-functions/_herbstutil
//         (add that dir to fpath if your zsh doesn't scan it yet)

import { mkdirSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const root = join(import.meta.dir, "..");
const BASH_SRC = join(root, "share", "herbstutil-completion.bash");
const ZSH_SRC = join(root, "share", "_herbstutil");
const BASH_DST = join(
    process.env.HOME!, ".local/share/bash-completion/completions/herbstutil",
);
const ZSH_DST = join(
    process.env.HOME!, ".local/share/zsh/site-functions/_herbstutil",
);

const action = process.argv[2] ?? "install";

switch (action) {
    case "install": {
        mkdirSync(dirname(BASH_DST), { recursive: true });
        mkdirSync(dirname(ZSH_DST), { recursive: true });
        copyFileSync(BASH_SRC, BASH_DST);
        copyFileSync(ZSH_SRC, ZSH_DST);
        console.log(`completion: bash  -> ${BASH_DST}`);
        console.log(`completion: zsh   -> ${ZSH_DST}`);
        console.log(
            "completion: note — zsh picks this up when " +
            "~/.local/share/zsh/site-functions is in fpath",
        );
        break;
    }
    case "uninstall": {
        for (const dst of [BASH_DST, ZSH_DST]) {
            rmSync(dst, { force: true });
            console.log(`completion: removed ${dst}`);
        }
        break;
    }
    case "print": {
        console.log(readFileSync(BASH_SRC, "utf8"));
        console.log(readFileSync(ZSH_SRC, "utf8"));
        break;
    }
    default:
        console.error(`completion: unknown action '${action}' (install|uninstall|print)`);
        process.exit(1);
}
