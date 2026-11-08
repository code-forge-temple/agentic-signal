# Nodes

A node is a building block on the canvas. Each node is self-contained: its client code, its optional backend module and its optional desktop (Tauri) code live in folders named after it, and the code generators find it by folder. No central list needs editing.

Back to the [overview](../ARCHITECTURE.md). For how nodes run and pass data, see [client.md](client.md#the-workflow-engine).

## Anatomy of a Node

```
client/src/components/nodes/<Name>Node/     required
├── constants.tsx         NODE_TYPE, Icon, TITLE (+ LOCAL_SECRETS / GLOBAL_SECRETS if it has secrets)
├── descriptor.ts         <Name>NodeDescriptor: NodeDescriptor<typeof NODE_TYPE, <Name>Node>
├── types/workflow.ts     zod schema of the node's data, its assertion, and the <Name>Node type
├── <Name>Node.tsx        the React component: renders BaseNode / MonitoredNode and runs the node
├── services/             optional: calls to the backend (graphqlRequest, GraphQLSocketManager)
└── assets/               optional: icons

server/nodes/<Name>Node/                    optional, when the node needs the backend
├── mod.ts                re-exports everything below
├── types.ts              types shared with the client through shared/types.gen.ts (and NODE_TYPE, if defined here)
├── schema.ts             GraphQL: typeDefs, queryDefs, mutationDefs, subscriptionDefs
├── resolver.ts           export const resolver = {Query: ..., Mutation: ...}
├── service.ts            the work itself
└── websocket.ts          optional: registers a subscription type with webSocketManager

src-tauri/src/nodes/<snake_name>/            optional: #[tauri::command] functions for the desktop app
docs/docs/nodes/<category>/<type>.mdx        the user-facing page
```

### The Generators' Naming Rules

The generators build names from the folder name, so these must match exactly (`scripts/client/utils/nodes.ts`):

| For folder `FooNode` | Must exist |
|----------------------|------------|
| `descriptor.ts` | `export const FooNodeDescriptor` |
| `types/workflow.ts` | `export type FooNode` |
| `constants.tsx` | `export const NODE_TYPE` (or `export {FOO_NODE_TYPE as NODE_TYPE} from "@shared/types.gen"`) |
| the descriptor's source | an `order:` field with a literal number: the generator reads it with a regex and fails without it |

A folder without a `descriptor.ts(x)`, such as `BaseNode` or `MonitoredNode`, is a shared building block, not a node.

### The Descriptor

`NodeDescriptor` (`client/src/components/nodes/types.ts`):

| Field | Purpose |
|-------|---------|
| `type` | The node type string saved in workflow files. Never rename it: saved workflows would stop loading. |
| `order` | Position in the nodes dock (ascending). |
| `component`, `icon`, `title` | What the canvas and dock show. |
| `assertion` | Validates the node's data (the zod schema's `parse`). Runs on every data change and on load. |
| `migrate` | Optional. Rewrites older data shapes on load, before `assertion`. Must be pure, and a no-op on current data. |
| `globalSecrets` | Optional. Global store keys the node shares its secrets under ([credentials.md](credentials.md)). |
| `defaultData` | The data a new node starts with. Always includes `title` and `toSanitize`. |
| `metadata.description` | One line describing the node. The AI Buddy's system prompt includes it. |
| `metadata.configSchema` | The zod schema of the node's settings. The AI Buddy prompt and the docs show it. |
| `metadata.ports` | The node's connectors: `flow` (with `inputSchema` / `outputSchema`), `trigger`, `context`, `tool`. |

`defaultData.toSanitize` lists dot paths deleted from the node's data when a workflow is saved. Always include `"input"`, plus every field holding a secret.

### The Component

A node component receives React Flow's `NodeProps`. It calls `assertIsEnhancedNodeData(data)` and its own assertion, then reads its settings and the injected callbacks (`onConfigChange`, `onResultUpdate`, `onFeedbackSend`) from `data`.

Typical shape:

```tsx
export function FooNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsFooNodeData(data);

    const [error, setError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const {title, input, onResultUpdate, onConfigChange} = data;

    const run = async () => {
        await runTask(async () => {
            try {
                const result = await doTheWork(input?.payload);

                onResultUpdate(id, {payload: result});
            } catch (err) {
                setError(errorMessage(err)); // from @shared/utils
            }
        }, setIsRunning);
    };

    // Run whenever the input changes.
    useRunOnTriggerChange({clearError: () => setError(null), clearOutput: () => onResultUpdate(id), runCallback: run}, [input]);

    return (
        <>
            <MonitoredNode id={id} nodeIcon={Icon} title={title} ports={{input: true, output: true}}
                run={() => void run()} running={isRunning} settings={() => setOpenSettings(true)} error={error} />
            {/* settings dialog: BaseDialog open={openSettings}, with the node's fields, writing through onConfigChange */}
        </>
    );
}
```

- Use **`MonitoredNode`** when the node can fail. It shows the logs and reports errors to the command its layer serves. Use plain **`BaseNode`** only for nodes with nothing to log (Workflow Output).
- Pass on the incoming `toolsPayload` unless the node deliberately drops it.
- Settings dialogs use `BaseDialog` and the shared fields (`DebouncedTextField`, `PathField`, `CodeEditor`, ...).

### The Backend Module

When a node needs the backend, `server/nodes/<Name>Node/mod.ts` must export:

- `resolver`, always;
- `queryDefs`, always: the node registry includes every node's `queryDefs` (use an empty string if it has no queries);
- `typeDefs`, `mutationDefs` and `subscriptionDefs` only if it has them: the generator detects them by regex.

Subscriptions go through the backend's own WebSocket manager, not Yoga. Register a factory in `websocket.ts`, and import it from `mod.ts` for its side effect:

```ts
webSocketManager.registerSubscriptionType("fooEvent", (nodeId, handler) => fooService.subscribe(nodeId, handler));
```

The client subscribes through `GraphQLSocketManager.getInstance().subscribe<{fooEvent?: unknown}>(...)` and validates each event before using it.

## Adding a Node

1. **Create the client folder** `client/src/components/nodes/FooNode/` with `constants.tsx`, `types/workflow.ts`, `descriptor.ts` and `FooNode.tsx`, following the [naming rules](#the-generators-naming-rules). Copy a similar node as a starting point: `DataFlowSpyNode` (minimal), `JsonReformatterNode` (settings + transform), `HttpNode` (backend call), `TimerNode` (subscription).
2. **Write the data schema** in `types/workflow.ts` with zod. Give every field a `.describe(...)`: the AI Buddy and the docs read these descriptions.
3. **Fill in the descriptor:** a unique `type`, an `order`, the ports with their schemas, a one-line `metadata.description`, and `defaultData` with `title` and `toSanitize: ["input", ...]`.
4. **Write the component.** Use `MonitoredNode` if it can fail. Run on input with `useRunOnTriggerChange`, wrap the work in `runTask`, and emit with `onResultUpdate`.
5. **If it needs the backend,** add `server/nodes/FooNode/` with `mod.ts`, `schema.ts`, `resolver.ts`, `service.ts` and `types.ts`. If the type string lives in `types.ts` (`export const FOO_NODE_TYPE = "foo"`), re-export it as `NODE_TYPE` from the client's `constants.tsx`.
6. **If it has secrets** (tokens, API keys), follow [credentials.md](credentials.md#adding-a-secret-to-a-node): `LOCAL_SECRETS` / `GLOBAL_SECRETS`, `globalSecrets`, and `toSanitize`.
7. **If the desktop app needs native code,** add `#[tauri::command]` functions under `src-tauri/src/nodes/foo_node/`. The generator registers them.
8. **Regenerate and check:** `bun run precompile`, then `cd client && bunx tsc -b`, `bun run lint` at the root, and `bun run test`.
9. **Document it:** add `docs/docs/nodes/<category>/foo.mdx` (copy a neighbour's layout, with `<NodeSchemaTab nodeType="foo" />`), add it to `docs/sidebars.ts` and `docs/docs/nodes/overview.md`, and add screenshots under `docs/static/img/nodes/`.

### Things That Break Saved Workflows

- Renaming a node's `type`.
- Removing or renaming a data field without a `migrate` that converts older data.
- Making a new data field required without a default in `migrate`.

### Wiring Into the Engine

Most nodes need nothing beyond the steps above. A node that needs special handling in the engine is referenced by type in a few app-level places. Keep that list short:

- `utils/workflowNodes.ts`: the Async Data Aggregator (collects inputs per source) and LLM nodes (receive feedback);
- `components/App/utils/workflowUtils.ts`: which handles may connect;
- `workflows/commands.ts`: Workflow Input (command discovery) and LLM Process (the AI Buddy's model filled into built-in workflows).

## PRO Nodes

The PRO nodes (Slack Input, Slack Output, SMS, Reddit Post) live in the private `agentic-signal-pro` repo. Each has `src/<Name>Node/client/src`, and optionally `server` and `src-tauri`. `link.sh` / `link.bat` there symlink those folders into this repo's `client/src/components/nodes/`, `server/nodes/` and `src-tauri/src/nodes/`, and write `.gitignore` entries so they're never committed here. They follow the same anatomy, so a change to a shared API (`BaseNode`, `MonitoredNode`, the descriptor type, the global store) can break them: check them too.

`eslint .` doesn't follow the symlinked folders, but `bun run lint` lints them too, against the PRO repo's own record of tolerated code-health violations ([build-and-release.md](build-and-release.md#code-health)).
