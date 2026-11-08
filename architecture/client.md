# Client

The client is a React 19 app built with Vite (`client/`). It renders the canvas with React Flow (`@xyflow/react`) and the UI with MUI in a dark theme, and it **runs the workflows**: execution lives in the node components, not on the server.

Back to the [overview](../ARCHITECTURE.md).

## The App Shell

`client/src/main.tsx` mounts `App` (`components/App/App.tsx`), which renders:

- **The docks** (`components/Dock/`):
  - the AI Buddy button (`AIAssistantDock`);
  - the actions dock (`ActionsDock`): Settings, docs, Save, Save to Workflows Folder, Clear, Load;
  - the nodes dock (`NodesDock`): one item per node descriptor, dragged onto the canvas.
- **One `WorkflowLayer` per layer**, each inside its own `ReactFlowProvider` and `ErrorBoundary`.
- **The `LayerSwitcher`**, on the right edge.
- **`useOutsideCommands()`**, mounted once, which relays outside apps' calls to the layers ([commands.md](commands.md)).
- **The `VersionTag`** in the top right corner (`components/App/components/VersionTag/`). When the update check is on, `useUpdateCheck` asks GitHub's `releases/latest` once per start (`services/updateCheck.ts`). If that version is newer, the tag turns green and links to the release page, and a notice says so once per version (`agentic-signal.updateNotified`). The tag keeps its size, since the dock leaves fixed room for it. Nothing installs. A release build (`__RELEASE_BUILD__`, true when Vite runs under GitHub Actions) offers **Download**. Any build made from the code (the web app, Docker, a self-built desktop app, PRO builds) says to pull the latest code and build again, and links to the release only for what's new.

The docks live outside the layers and act on the shown one through `getActiveLayerApi()`, which returns a `WorkflowLayerApi`: `save`, `clear`, `loadWorkflowFromJson`, `replaceWorkflow`, `getWorkflowJson`, `hasNodes`.

## Layers

`context/LayersContext.tsx` holds the list of layers, the shown one, and add / delete / rename. Two kinds exist (`LAYER_KIND`):

- **User layers**, created by the user, named `Layer N` by default.
- **The AI Buddy layer** (`AI_LAYER`): always first, never deleted or renamed, read-only to the user. The chat runs commands on it.

**Every layer stays mounted.** A hidden one only gets the `workflow-layer-hidden` class, so its timers, listeners and running nodes keep working. React Flow binds its keyboard shortcuts per canvas on the whole document, so `WorkflowLayer` disables them on hidden layers.

`context/WorkflowLayerContext.ts` tells every component which layer it renders in: `{isActive, layerId, isAiLayer}`. Context passes through portals, so a node's dialogs know it too. Nodes use `layerId` to report to the `CommandRouter`.

## The Workflow Engine

Each `WorkflowLayer` uses `hooks/useWorkflow.ts`, which holds the layer's `nodes` and `edges` (React Flow state) and gives every node's `data` three callbacks:

| Callback | What it does |
|----------|--------------|
| `onConfigChange(id, partialData)` | Merges settings into the node's `data`, checked by the descriptor's `assertion`. |
| `onResultUpdate(id, envelope?)` | Hands the node's output to every node downstream: it becomes their `data.input`. `undefined` clears it. |
| `onFeedbackSend(id, feedback)` | Sends feedback upstream to the LLM node that produced this node's input (validation loops). |

Data moves in **envelopes** (`types/workflow.ts`): `{payload, toolsPayload?, timerTrigger?}`. The framework never looks inside `payload`. The **Async Data Aggregator** is the one exception to "the latest input replaces the last": it collects one input per source node.

A node reacts to new input in its own component, usually with `hooks/useRunOnTriggerChange.ts`. That hook clears the node's error and output, then runs the node when its input or its Timer trigger changes. `BaseNode/utils.ts`'s `runTask` wraps a run: it marks the node as running, which animates its outgoing edges, and always clears the running state afterwards.

### Ports and Edges

A descriptor's `metadata.ports` declares which connectors a node has (`NodePorts`, `nodes/types.ts`):

| Port | Carries |
|------|---------|
| `flow` | Envelopes between nodes. Its `inputSchema` / `outputSchema` describe them (used by the AI Buddy prompt and the docs). |
| `trigger` | A Timer node's tick, which starts the node's run. |
| `context` | A RAG node's handler, plugged into an LLM node. |
| `tool` | An AI Tool node's handler and schema, plugged into an LLM node. |

`BaseNode` draws the handles and checks connections while dragging. `components/App/utils/workflowUtils.ts` checks a loaded file's edges against the same rules (`getExpectedEdgeHandle`, `assertValidWorkflowEdges`).

### Node Components

Every node renders `BaseNode` (`nodes/BaseNode/`): the icon, title, ports, and header buttons (settings, logs, output, run). `BaseNode` holds no state of its own.

Nodes with an error log render `MonitoredNode` (`nodes/MonitoredNode/`) instead, passing `error`. It owns the logs button and `LogsDialog`, and reports each new error to the `CommandRouter` for the node's layer, so a node's failure fails the command that layer is serving.

## Saving and Loading

**Loading** (`parseWorkflowJson` in `WorkflowLayer.tsx`):

- positions are filled in where a file (often an LLM's) leaves them out;
- each node's data runs through its descriptor's `migrate` and then its `assertion`;
- the descriptor's default title is used;
- edges are validated.

A load into a non-empty layer asks Replace / Add to Existing / Add to New Layer. A layer still named `Layer N` takes the file's name. `replaceWorkflow` skips the question; the AI Buddy uses it.

**Saving** (`getWorkflowJson`): removes React Flow's runtime fields and every injected callback, deletes each node's `data.toSanitize` paths (inputs, tokens, API keys), then drops `toSanitize` itself. The web app downloads the file. The desktop app and **Save to Workflows Folder** write it to the backend-owned workflows folder (`services/workflowsService.ts`).

Workflows are **not** kept across a reload: layers live in memory.

## Settings and App State

| State | Where | Persisted |
|-------|-------|-----------|
| Ollama host, browser path, workflows folder, the update check | `context/SettingsContext.tsx` | `localStorage` keys `ollamaHost`, `browserPath`, `workflowsFolder`, `checkForUpdates` |
| Global key/value store (selected model, model settings, outside connections, shared secrets for the session, ...) | `stores/globalConfig.ts` (zustand) | Only keys written with `persist: true`, under `agentic-signal.globalData.<key>`; kept in sync across tabs |
| Saved credentials and outside connections' tokens | `stores/vault.ts` | Encrypted, in the `agentic-signal.vault` entry ([credentials.md](credentials.md#the-vault)) |

Settings (`ActionsDock/components/Settings/`) has five tabs: General, Ollama, Workflows, Credentials, Vault. **Clear App Data** removes every persisted setting, every global key and the vault, then reloads.

## Talking to the Backend

| Module | Use |
|--------|-----|
| `utils/graphqlRequest.ts` | `graphqlRequest<T>(query, variables)`: one GraphQL POST, typed result, errors thrown with GraphQL's messages. |
| `services/graphQLSocketManager.ts` | One shared `graphql-ws` client for subscriptions (Timer ticks, Slack events, outside command requests). It connects to the page's own host at `/graphql`; Vite proxies HTTP and WebSocket to the backend, so the app also works from another computer. |
| `services/ollamaService.ts` | Every Ollama call (chat, streaming, tool calls, model management), straight from the browser with `ollama-js`. A request with an `AbortSignal` gets a client of its own, so cancelling it never cancels other streams. |

Pages served over plain HTTP on a network address lack `crypto.subtle`, `crypto.randomUUID` and `navigator.clipboard`. `@noble/hashes` and `@noble/ciphers` (SHA-256, and the vault's PBKDF2 and AES-GCM), uuid's v4 and `utils/clipboard.ts` provide fallbacks.

## Rendering Notes

- **`MarkdownRenderer`** renders chat replies and payloads. Code is highlighted with Prism through CSS classes (`prismOneDark.scss`, `useInlineStyles={false}`): inline styles cost a full theme scan per token. A block shows as plain text at once and is coloured in the background (`useDeferredValue`); blocks over 20,000 characters stay plain. The `components` map and the code-block callbacks are stable (a static map plus a context), because a new map remounts and re-highlights every block.
- **Long-lived lists** (the chat log) render memoized items with stable callbacks (`hooks/useLatestValue.ts`).

## Tests

`client/` uses Vitest with jsdom (`vitest.config.ts`). Tests sit next to the code (`*.test.ts(x)`). Vitest runs without `globals`, so component tests call `cleanup()` in `afterEach`. The typecheck is `bunx tsc -b` (the root `tsconfig.json` has `files: []`, so `tsc --noEmit -p .` checks nothing).
