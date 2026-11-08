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
| `bun run lint` | ESLint over the repo, with type-aware rules (floating and misused promises, unsafe `any` assignments, ...). It doesn't follow the symlinked PRO folders: lint those by path. |
| `bun run test` | `deno task test` (the backend), then the client's Vitest suite. |
| `bun run circular` | Circular imports in `client/src` (madge). |

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
