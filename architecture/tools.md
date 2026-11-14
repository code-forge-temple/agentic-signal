# Tools

A tool is a function an LLM node may call while it works: search the web, read a page, fetch emails, compute a maximum. Tools don't get their own node types. They plug into one generic node, the **AI Tool node** (`ToolNode`), which the user connects to an LLM node's `tool` port and then picks a tool for.

Back to the [overview](../ARCHITECTURE.md). For nodes in general, see [nodes.md](nodes.md).

## Anatomy of a Tool

```
client/src/components/nodes/ToolNode/tools/<Name>Tool/    required
├── descriptor.tsx      export const <Name>ToolDescriptor: ToolDefinition
├── constants.ts        optional: TOOL_SUBTYPE, LOCAL_SECRETS / GLOBAL_SECRETS (tools with secrets)
├── components/         optional: custom settings fields
├── services/           optional: backend calls (graphqlRequest)
└── assets/             optional: icon

server/tools/<Name>Tool/                                    optional, when the tool needs the backend
├── mod.ts              re-exports: resolver, queryDefs (always), typeDefs (if any)
├── types.ts            shared with the client through shared/types.gen.ts
├── schema.ts           GraphQL typeDefs and queryDefs
├── resolver.ts         export const resolver = {Query: ...}
└── service.ts          the work itself

docs/docs/nodes/ai/tools/<subtype>.md                       the user-facing page
```

The client generator picks up every folder with a descriptor and imports `<FolderName>Descriptor` from it (`scripts/client/utils/tools.ts`), so the export's name must match the folder's. Server tool modules support queries only: the tool registry collects `resolver`, `queryDefs` and `typeDefs`, not mutations or subscriptions.

Some tools run entirely in the browser (Max, Min, Sort, CSV to Array); others call the backend (Brave Search, DuckDuckGo, Web Page to Markdown, Form Interaction, the Google tools).

## The Tool Definition

`ToolDefinition` (`client/src/components/nodes/ToolNode/tools/types.ts`):

| Field | Purpose |
|-------|---------|
| `toolSubtype` | The tool's id, saved in workflow files as the AI Tool node's `toolSubtype`. Never rename it. |
| `title`, `icon` | Shown on the node and in Settings → Credentials. |
| `toolSchema` | What the LLM sees: `{name, description, parameters}` (JSON Schema). Name, describe and constrain parameters carefully: the model only knows what's written here. |
| `userConfigSchema` | The settings the user fills in on the node. Wrap it in `extendSystemUserConfigSchema(...)` (`client/src/types/tool.types.ts`, with the other tool types), which adds `requireToolUse`. |
| `handlerFactory(userConfig)` | Returns the handler the LLM's calls go to: `async (params) => result`. Bound to the effective config whenever it changes. |
| `runtimeCleanup(userConfig)` | Optional. Returns `async (sessionId) => void`, called once after each LLM run, for tools that open resources per run (Form Interaction's browser session). |
| `renderConfig(props)` | Optional. Custom settings UI. Without it, `UserConfigFields` renders `userConfigSchema` generically. |
| `toSanitize` | Dot paths into the node's data deleted on save, e.g. `userConfig.apiKey`. Every secret field belongs here. |
| `globalSecrets` | Optional. Global store keys the tool shares secrets under ([credentials.md](credentials.md)). |

### The Handler

`handlerFactory` receives the **effective config**: for each field, the value shared in the global store under `<toolSubtype>.<field>` if there is one, else the node's own `userConfig` value. It also receives `browserPath` from Settings. The handler it returns gets:

- the LLM's arguments, as described by `toolSchema.parameters`;
- `toolsPayload`, from the LLM node's input envelope (files and data meant for tools, not for the model);
- `sessionId`, unique per LLM run.

Return a JSON-serializable result. On failure, return `{error: "..."}` with a message the model can act on rather than throwing: the model sees it and may retry or correct its arguments. Sanitize LLM-provided strings before use (`tools/utils/sanitize.ts`).

## How an LLM Node Calls Tools

1. **The AI Tool node** (`ToolNode.tsx`) looks up its tool in `toolRegistry` by `toolSubtype`. It checks that required config is present, then stores `handler`, `cleanup` and `toolSchema` in its node data.
2. **The LLM node** (`LlmProcessNode`) finds the AI Tool nodes connected to its `tool` port and builds the list of `{schema, handler, systemUserConfigValues}` for the run (`LlmProcessNode/utils/connections.ts`).
3. **The tool loop** (`services/llm/toolLoop.ts`, behind `ollamaService.fetchAIResponse`) sends the schemas with the chat request, executes each tool call through the matching handler, and sends the results back to the model until it answers.
   - Tools with `requireToolUse` are retried, up to the LLM node's `maxToolRetries`, until the model calls them.
   - A call to a tool the agent doesn't have is answered with the list of tools it can call, instead of failing the run.
4. **After the run**, the LLM node calls every connected tool's `cleanup(sessionId)`.

In **orchestration mode**, the LLM node plans tasks and runs each as its own agent with its own subset of tools (`LlmProcessNode/utils/aiOrchestration/`). Tools need nothing special for it.

## Adding a Tool

1. **Create the folder** `client/src/components/nodes/ToolNode/tools/FooTool/` with `descriptor.tsx` exporting `FooToolDescriptor: ToolDefinition`. Copy a similar tool: `MaxTool` (pure client), `DuckDuckGoSearchTool` (backend call, no key), `BraveSearchTool` (backend call with an API key), `GcalendarFetchEventsTool` (a Google API).
   - **A Google API tool** is built with `googleTool({...})` from `tools/utils/google/googleTool.tsx`. It adds what the Google tools share: the Client ID, the OAuth sign-in (Connect button and access token), `maxResults`, `globalSecrets`, `toSanitize` and the settings UI. It also checks the sign-in and `maxResults` before the tool's own `fetch(params, {accessToken, maxResults})` runs. The tool gives its `toolSubtype`, `title`, `icon`, `toolSchema`, the `service` name ("Gmail"), the read-only OAuth `scope` ("gmail.readonly"), its `maxResults` limit and `fetch`. Steps 3, 4 and 6 are then done.
2. **Write `toolSchema`**: a clear `name` (camelCase), a `description` saying when to use it and what it returns, and `parameters` with descriptions and `required`.
3. **Write `userConfigSchema`** with `extendSystemUserConfigSchema({...})`. Mark fields the tool can't work without as `required: true`; the AI Tool node then shows "missing configuration" until they're set.
4. **Write `handlerFactory`.** Validate the config and the arguments, do the work, and return a result or `{error}`.
5. **If it needs the backend,** add `server/tools/FooTool/` (`mod.ts`, `schema.ts`, `resolver.ts`, `service.ts`, `types.ts`), and call it from the client with `graphqlRequest<T>(...)`. A credential (an API key, an access token) goes as the request's `Authorization: Bearer <token>` header, not as a query argument. The resolver reads it with `bearerToken(request)` (`server/utils/bearerToken.ts`).
6. **If it holds secrets,** follow [credentials.md](credentials.md#adding-a-secret-to-a-tool): a `constants.ts` with `TOOL_SUBTYPE`, `LOCAL_SECRETS` and `GLOBAL_SECRETS`; `globalSecrets` and `toSanitize` built from them; settings fields reading the shared value.
7. **If it opens resources per run,** add `runtimeCleanup`, and key the resources by `sessionId`.
8. **Regenerate and check:** `bun run precompile`, `cd client && bunx tsc -b`, `bun run lint`, `bun run test`.
9. **Document it:** add `docs/docs/nodes/ai/tools/foo.md` (copy a neighbour's layout), add it to `docs/sidebars.ts` under "AI Tool Node", and add a screenshot under `docs/static/img/nodes/ai-tool/`.
