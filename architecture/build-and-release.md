# Build and Release

How to run Agentic Signal in development, check it, and ship it as a web app, a desktop app or a Docker image. Also covers the docs site and the PRO repo.

Back to the [overview](../ARCHITECTURE.md).

## Toolchain

| Tool | Used for |
|------|----------|
| Bun | Package manager and script runner (root, `client/`, `docs/`) |
| Deno | The backend: run, test, and compile to standalone binaries |
| Vite | The client's dev server (port 8080) and production build |
| Rust + Tauri 2 | The desktop app (`src-tauri/`) |
| Docusaurus | The docs site (`docs/`) |

## Development

```bash
bun install && (cd client && bun install)
bun run dev          # backend (deno task dev, with --watch) + client (vite) together
```

- `bun run dev` runs `server:dev` and `client:dev` at once. Both run `bun run precompile` first, which regenerates every `*.gen.*` file ([ARCHITECTURE.md](../ARCHITECTURE.md#generated-code)). Run `bun run precompile` yourself after adding or renaming a node, a tool, or a server module.
- The client is at `http://localhost:8080`. Vite proxies `/graphql`, HTTP and WebSocket, to the backend on port 8000, so the page only ever talks to its own host.
- Ollama runs separately; its host is set in Settings.

## Checks

| Command | What it checks |
|---------|----------------|
| `cd client && bunx tsc -b` | The client's types (the build's own typecheck). `tsc --noEmit -p .` checks nothing: the root config has `files: []`. |
| `bun run lint` | ESLint over the repo, with type-aware rules (floating and misused promises, unsafe `any` assignments, ...) and the code-health limits (below). `scripts/lint.ts` runs it twice: on the repo, then on the linked PRO folders, which `eslint .` never enters because it doesn't follow symlinks. |
| `bun run lint:prune` | Shrinks the record of tolerated code-health violations after some were fixed. Lint fails until it's run. |
| `bun run health` | The code-health score of each file (below). |
| `bun run test` | The backend's tests (`scripts/test-server.ts`: `deno task test`, plus the linked PRO server folders, which `deno test server/` doesn't enter because it doesn't follow symlinks), the scripts' tests (`bun test ./scripts/`), then the client's Vitest suite (which does follow them). |
| `bun run circular` | Circular imports in `client/src` (madge). |

## Code Health

Limits on complexity, nesting and size, and a score per file, so code stays easy to change, for people and for AI assistants alike.

- **The limits** are in `eslint.code-health.js`:
  - complexity 10, cognitive complexity 15, nesting 4, 4 parameters, callbacks 3 deep, 3 operators in a condition;
  - 70 lines a function (150 in `.tsx`), 400 a file;
  - no identical functions or duplicated branches.

  Tests have no size or nesting limits.
- **The ratchet:** `eslint.config.js` makes the limits errors. The violations that existed when the limits came in are recorded in `eslint-suppressions.json` (ESLint's bulk suppressions), so only new ones fail. A recorded one that's fixed fails too, until `bun run lint:prune` drops it, so the record only shrinks. The PRO folders' record is `eslint-suppressions.json` in the PRO repo, which keeps their file names out of this one. Never add to the records by hand.
- **The score** (`scripts/code-health.ts`, `bun run health`):
  - Each file starts at 10 and loses points for every broken limit, scaled by how far over it is, plus a "brain method" penalty for a function that's complex, long and deeply nested at once. It never goes below 1.
  - 9.5 and up counts as healthy.
  - `--changed` compares changed files with the last commit, `--files` the files named, and `--hotspots` ranks low scores by how often git saw the file change.
  - It lints without type information, so a file takes milliseconds.
- **For Claude Code:** the `code-health` skill (`.claude/skills/code-health/`) says to measure before and after a change and to refactor instead of finishing when a score drops. The hooks in `.claude/settings.json` run `bun run health --hook after-edit` after each edit and `--hook stop` at the end of a turn. Each exits 2 when a file got worse, which hands the findings back to Claude. The end-of-turn check blocks at most once a turn.

## The Desktop App (Tauri)

```bash
bun run dev:windows      # or dev:linux / dev:macos
bun run build:windows    # or build:linux / build:macos
```

A desktop build:

1. syncs the Tauri version with `package.json` (`sync:tauri-version`);
2. writes `src-tauri/LICENSE.txt` from `LICENSE.md` (`sync:license`): plain ASCII, without the Markdown or emoji, for the license page the installers show before installing (`bundle.licenseFile`). It's git-ignored and remade at each build, so edit `LICENSE.md` only;
3. builds the client;
4. compiles the backend into a standalone binary (`deno task compile:<platform>` → `server/dist/agentic-signal-backend[-linux|-macos][.exe]`);
5. copies it into `src-tauri/bin/` (bundled as a resource);
6. runs `tauri build`.

At start, the app launches that binary from its `bin/` folder (`src-tauri/src/main.gen.rs`) and keeps the process handle. **Close App** kills it (the `kill_backend_process` command).

Native features come from Tauri plugins (`shell`, `dialog`, `fs`, `log`) and from `#[tauri::command]` functions under `src-tauri/src/nodes`, `tools` and `utils`. The generator registers those commands in `main.gen.rs`. Examples: the Google and Reddit OAuth windows, the native file dialogs for the workflows folder.

The npm `@tauri-apps/plugin-*` packages and the Rust `tauri-plugin-*` crates must be on matching minor versions. Pin the npm ones with `~`.

## Docker

`dockerfile` builds an image that runs `bun run dev` with Bun and Deno inside. It sets `AGENTIC_SIGNAL_HOST=0.0.0.0` and exposes 8080 (the app), 8000 (the backend) and 8001 (outside commands):

```bash
docker run -it -p 8080:8080 -p 8000:8000 -p 8001:8001 agentic-signal
```

`dockerfile.pro` adds the PRO repo as a second build context (`agentic-signal-pro`). `docker-build.sh` / `docker-build.bat` build with it when `../agentic-signal-pro` exists, and without it otherwise.

## CI and Releases

`.github/workflows/`:

- **`build.yml`** builds the desktop app on Windows, macOS and Linux (Bun + Deno). It uploads the artifacts and creates a GitHub Release named after `package.json`'s version.
- **`deploy-docs.yml`** builds the docs site and deploys it to GitHub Pages whenever a push or a pull request to `main` touches `docs/` (the job has no condition separating the two).

Bump `package.json`'s `version` for a release; the Tauri version follows it. The app's update check compares its own version with the tag of the latest GitHub release (`v<version>`, as this workflow writes it), so a release published another way must keep that tag format, and must not be a draft or a pre-release.

## The Docs Site

```bash
cd docs && bun install
bun run start     # regenerates the node schemas, then serves the site
bun run build     # production build; fails on broken links
```

- **Node pages** (`docs/docs/nodes/…`) embed each node's settings schema with `<NodeSchemaTab nodeType="…" />`. The schemas come from `docs/src/data/nodeSchemas.gen.json`, which `scripts/generate-docs-schemas.ts` builds from each node's `types/workflow.ts`. It runs as the docs' `precompile`, before `bun run start` only. After changing a node's schema, run `bun run scripts/generate-docs-schemas.ts` from the root and commit the file: `bun run build`, and the deploy workflow, use it as committed.
- **The sidebar** is `docs/sidebars.ts`.
- **Screenshots** live in `docs/static/img/`.

## The PRO Repo

The PRO nodes live in the private `agentic-signal-pro` repo, next to this one (`../agentic-signal-pro`).

- **`link.sh` / `link.bat`** there symlink each PRO node's `client/src`, `client/public`, `server` and `src-tauri` parts into this repo's folders, and list them in `.gitignore` files there, so they never end up in this repo's commits.
- **After linking,** the generators pick them up like any other node.
- **Changes to the PRO nodes are committed in the PRO repo.**
