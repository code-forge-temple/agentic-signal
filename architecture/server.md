# Server

The backend (`server/`) is a Deno program. It runs the work a browser can't do: scraping with Playwright, OAuth-protected APIs, Slack's Socket Mode, serial ports, the workflows folder on disk. It also relays outside apps' calls to the open app. The client reaches it over GraphQL: queries and mutations over HTTP, subscriptions over a WebSocket.

Back to the [overview](../ARCHITECTURE.md).

## Entry Point

`server/main.ts`:

- creates the GraphQL Yoga server from `graphql/schema.ts` (with GraphiQL at `/graphql`, and CORS for the dev server, the desktop app and `localhost:8080`);
- serves port **8000** (`BACKEND_PORT`) with `Deno.serve`, sending every request through `webSocketManager.handleRequest`. WebSocket upgrades are handled there; everything else goes to Yoga;
- starts the **commands listener** on port **8001** ([commands.md](commands.md));
- swallows unhandled promise rejections (logging them), so a stray background error can't take the backend down.

Both ports bind `127.0.0.1` unless `AGENTIC_SIGNAL_HOST` is set (Docker sets `0.0.0.0`). `AGENTIC_SIGNAL_COMMANDS_HOST` sets port 8001's address on its own.

Permissions come from the Deno tasks in `deno.json`: net, read, write, env, run (the browser), sys and ffi. `deno task compile:*` builds the standalone backend binaries the desktop app ships ([build-and-release.md](build-and-release.md)).

## The GraphQL Schema

`graphql/schema-generator.ts` assembles the schema from three sources:

1. **Tools:** `server/tools/toolsRegistry.gen.ts`, generated from every `server/tools/<Name>/mod.ts`. A tool contributes `typeDefs`, `queryDefs` and a `resolver`.
2. **Nodes:** `server/nodes/nodesRegistry.gen.ts`, generated from every `server/nodes/<Name>/mod.ts`. A node may also contribute `mutationDefs` and `subscriptionDefs`.
3. **App modules**, wired by hand because they belong to no node or tool: `workflows/`, `commands/` and `browser/`.

`queryDefs` / `mutationDefs` / `subscriptionDefs` are field definitions, which the generator places inside `type Query { … }` and its siblings. `typeDefs` hold whole types. Resolvers are merged into one object. [nodes.md](nodes.md#the-backend-module) lists exactly what a module must export.

A module usually builds its GraphQL types from its TypeScript field lists with `utils/graphqlUtils.ts`'s `generateGraphQLType`, so the schema and the types in `types.ts` stay in step.

**Error messages:** Yoga replaces an ordinary error's message with "Unexpected error." To show the real message to the user, throw `createGraphQLError(message)`, as `workflows/resolver.ts` does.

## Subscriptions

Subscriptions don't go through Yoga. `ws/webSocketManager.ts` implements the `graphql-transport-ws` handshake (`connection_init`, `subscribe`, `complete`, `ping`) itself and dispatches each subscription to a registered factory:

```ts
webSocketManager.registerSubscriptionType("timerTrigger", (nodeId, handler) => timerService.subscribe(nodeId, handler));
```

- The subscription's root field (`timerTrigger`) selects the factory.
- By default a subscription is **node-scoped**: it must name a `nodeId`, and events go only to that node's subscribers.
- `registerSubscriptionType(type, factory, {nodeScoped: false})` registers an app-wide one, such as the outside commands' `commandRequests`.
- A client's `complete` really tears its subscription down.

Modules register their factories in a `websocket.ts`, which `mod.ts` imports for its side effect.

## App Modules

| Module | What it does |
|--------|--------------|
| `workflows/` | The workflows folder: `AGENTIC_SIGNAL_WORKFLOWS_DIR`, else `~/.agentic-signal/workflows`, or the folder named in Settings. Lists, reads and saves `.json` files directly in it, never outside it. The desktop and web apps both use it, which is why the backend owns it. |
| `commands/` | The outside commands gateway: the HTTP listener on port 8001, tokens checked by SHA-256 hash, the `commandRequests` subscription the app listens on, and the mutation it answers with. It also keeps the "accept calls from the network" switch in `~/.agentic-signal/settings.json`. See [commands.md](commands.md). |
| `browser/` | Finds Chrome's executable when Settings leaves the browser path empty. |

## Node and Tool Modules

| Module | Backend work |
|--------|--------------|
| `nodes/TimerNode` | Interval and scheduled timers; ticks go out on the `timerTrigger` subscription. |
| `nodes/HttpNode`, `nodes/JobSearchNode` | Pages rendered with a real browser, job searches. |
| `nodes/RagNode` | Chunking, embedding (through Ollama) and Weaviate ingestion / retrieval. |
| `nodes/SlackInputNode`, `SlackOutputNode`, `SmsNode` (PRO) | Slack Socket Mode listeners and messages, SMS over a serial modem. |
| `tools/*` | Brave and DuckDuckGo search, Web Page to Markdown, Form Interaction (Playwright), Date/Time Now, Gmail / Drive / Calendar. |

**The browser.** Fetch Web Page, DuckDuckGo Search and Web Page to Markdown open Chrome through `utils/browserUtils.ts`'s `launchBrowser`; Form Interaction keeps its own sessions (`tools/FormInteractionTool/utils/sessionManager.ts`). Both run a visible Chrome (`headless: false`), which sites block less, and both open its page with `newMinimizedPage`:

- **Created minimized:** the page is made through CDP (`Target.createTarget` with `windowState: "minimized"`) in a context without a viewport, so the window waits in the taskbar instead of jumping in front. Minimizing a normal window afterwards would still take the focus for about a second.
- **Created off-screen:** Chrome still shows the new window for a moment before minimizing it, holding the focus for about 0.1 s. So it's made at `-32000, -32000`, where that moment is out of sight. Restored from the taskbar, it would come back there, so `bringOnScreenWhenRestored` checks the window every 500 ms and moves a restored one to `80, 80`.
- **If Chrome refuses,** it falls back to a normal window.
- **Size pages with `setPageSize`** (a CDP device-metrics override, kept attached), never `page.setViewportSize`. In a visible browser, Playwright's call also resizes the window, which would restore it.
- **Kept drawing:** a minimized window draws about one frame a second, and Playwright waits for two frames before each click, check or hover (about 2 s each). `keepDrawing` runs a tiny screencast (64×64, frames dropped), which makes Chrome draw as if the window were shown: about 50 frames a second, clicks back to tens of milliseconds. It survives navigations. Timers, loading, IntersectionObserver and page visibility behave as usual either way; Playwright's default flags turn off background throttling.

`shared/types.gen.ts` re-exports every module's `types.ts`, so the client imports the same types (`@shared/types.gen`). A node whose type string lives in its server `types.ts` re-exports it as its client `NODE_TYPE`.

## Tests

`deno task test` runs `deno test` over `server/`. Tests sit next to the code (`service.test.ts`, `listener.test.ts`). The root `bun run test` runs them, followed by the client's tests.
