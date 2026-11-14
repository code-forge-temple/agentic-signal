---
name: code-health
description: Use for every code change in agentic-signal (features, fixes, refactors) - measure the code health of the files you touch before and after, and refactor instead of finishing when a score drops or a new problem appears.
---

# Code Health for Code Changes

Agentic Signal scores each TypeScript file from 1 to 10 for complexity, nesting and size. The rules are in `eslint.code-health.js`, the scoring in `scripts/code-health.ts`. AI-written code tends to pile up nesting and long functions, and an AI changes such code less safely. So keep what you touch at 9.5 or more, and never lower a score.

## Workflow

1. **Before editing**, score the files you're about to change:

   ```bash
   bun run health --files <file> [<file> ...]
   ```

   It lists each file's problems, worst functions first. Don't add to them. Where you change that code anyway, fix what's cheap to fix.
2. **Make the change.**
3. **After editing**, compare with the last commit:

   ```bash
   bun run health --changed
   ```

   A file marked `✗ worse` has a lower score or a new problem (the `new:` lines).
4. **If a file got worse, refactor before you finish.** Work in small steps and measure after each:
   - guard clauses and early returns instead of nested `if`s;
   - a named function for each chunk of a long function;
   - an options object instead of a fifth parameter;
   - a lookup table instead of a long `if` / `switch` chain;
   - named booleans instead of a long condition.

   Keep the behaviour the same: run the tests that cover the code (`bun run test`, or the file's own test).
5. **Report** each changed file's score in your final message, before → after.

## Rules

- **Never silence a finding.** No `eslint-disable` for the code-health rules, and no hand edits to `eslint-suppressions.json`. If a finding really can't be fixed now, tell the user and let them decide.
- **After fixing a recorded violation, run `bun run lint:prune`.** ESLint fails while the record still lists a violation that's gone.
- **`bun run lint` must pass.** It fails on any new code-health violation, as on any other lint error.
- **The whole picture:** `bun run health` shows the whole repo, and `bun run health --hotspots` the files that change often and score low.

## Project Notes

- **PRO nodes** (Slack, SMS, Reddit Post) are symlinked in from `../agentic-signal-pro`. The scripts follow the links, and the PRO record lives in that repo's own `eslint-suppressions.json`.
- **The LLM layer** is split by job: `client/src/services/ollamaService.ts` is only the entry point; the server's calls are a provider (`services/llm/providers/ollama/`), and the tool loop, leaked-tool-call recovery and streamed replies work with any provider (`services/llm/`). Keep server-specific code in its provider.
- **Tests** have no size or nesting limits, and generated `*.gen.*` files aren't scored.
- **The hooks** in `.claude/settings.json` run the same check after each edit of a TypeScript file and at the end of a turn.
