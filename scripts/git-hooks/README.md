# Git hooks (opt-in)

This folder ships portable git hooks for contributors who want their local
commits to keep `graphify-out/` automatically up to date — useful when you
work outside the Kiro IDE (plain terminal, JetBrains, Cursor, etc.).

## Install once

From the repository root:

```sh
git config core.hooksPath scripts/git-hooks
```

That's it. Every subsequent `git commit` will run `graphify update .` and
re-stage `graphify-out/` so the committed graph matches the working tree.

## Skip when needed

```sh
git commit --no-verify -m "..."
```

## Hooks provided

| Hook | What it does |
|------|--------------|
| `pre-commit` | Runs `npm run graphify:update` (falls back to `uvx --from graphifyy graphify.exe update .`). Stages any updates under `graphify-out/`. Never aborts a commit on its own. |

## Why this isn't enabled by default

`core.hooksPath` is a per-clone setting. Forcing it through CI would surprise
contributors who haven't installed `uv`/`uvx`. Each contributor opts in
explicitly with the command above.
