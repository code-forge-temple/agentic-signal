# Credentials and the Global Store

Nodes and tools need secrets: Slack tokens, API keys, OAuth client IDs. They share them through the client's **global store**, and **Settings → Credentials** keeps them across reloads, encrypted in the **vault**. Workflow files never contain them.

Back to the [overview](../ARCHITECTURE.md). User-facing docs: the Credentials section of `docs/docs/getting-started/configuration.mdx`.

## The Global Store

`client/src/stores/globalConfig.ts` is a zustand store of string values, `globalData[key]`, read with `useGlobalConfig()`.

- `setGlobalData(key, value)` changes the value **for the session** (memory only).
- `setGlobalData(key, value, true)` also **persists** it in `localStorage` under `agentic-signal.globalData.<key>`. An empty value removes it.
- On start, every persisted key is loaded. A `storage` listener keeps tabs in sync.
- `getPersistedValue(key)` reads `localStorage` directly, for read-modify-write merges that must not lose another tab's change.
- `clearPersistedGlobalData()` (Clear App Data) removes every persisted key.

The store also holds non-secret app state: the selected model, model settings, outside connections.

## The Rule: One Value per Key

Every node and tool that declares a key shows the same value and runs with it:

- **Typing it into any node** sets the shared value for the session, so every other node using it updates too.
- **Only Settings → Credentials keeps it,** in the vault. After a reload, a typed value is gone, and a saved one is back once the vault is unlocked.
- **A node's own data field is only a seed.** When a node mounts, and the shared value is empty, a value in its data (from an older workflow file, saved before secrets were stripped) is copied into the shared value once.
- **Clearing counts as an edit:** an empty shared value means "no key" for every node.

Two kinds of node have no per-node secret: a RAG node on a local Weaviate can't use "no key" while another uses one, and two Reddit nodes can't post through different apps. That trade-off was chosen deliberately.

### Session-Only Secrets

Sign-ins that expire within the hour are shared for the session but never offered in Credentials, and never saved:

- the Google tools' access tokens, under `<toolSubtype>.accessToken` (one per Google tool kind);
- Reddit Post's access token, under `redditAccessToken`.

Connecting in one node connects every node of the same kind, and disconnecting does the opposite.

## Declaring Secrets

Each node or tool with secrets names them in its `constants`:

```ts
/** The node's data fields that hold its secrets. */
export const LOCAL_SECRETS = {
    BOT_TOKEN: "botToken",
    APP_TOKEN: "appToken",
} as const;

/** The global store keys for the same secrets, which Settings → Credentials can save. */
export const GLOBAL_SECRETS = {
    BOT_TOKEN: "slackBotToken",
    APP_TOKEN: "slackAppToken",
} as const satisfies Record<keyof typeof LOCAL_SECRETS, string>;
```

The descriptor then uses both:

```ts
globalSecrets: Object.values(GLOBAL_SECRETS),
defaultData: {
    ...,
    toSanitize: ["input", ...Object.values(LOCAL_SECRETS)],
},
```

The `satisfies` check makes every local field name a store key. Slack Input and Slack Output each keep their own copy of the constants, on purpose, so each node stays self-contained. Both copies name the same `slackBotToken`.

### Current Keys

| Store key | Declared by |
|-----------|-------------|
| `slackBotToken` | Slack Input, Slack Output |
| `slackAppToken` | Slack Input |
| `redditClientId`, `redditClientSecret` | Reddit Post |
| `weaviateApiKey` | RAG |
| `brave-search.apiKey` | Brave Search tool |
| `fetch-weather-data.apiKey` | Weather tool |
| `googleClientId` | Google Calendar, Drive and Gmail tools |

## Tools

The generic `ToolNode` can't know each tool's fields, so a tool's shared keys follow a pattern: `<toolSubtype>.<field>`, built by `globalToolProp(toolSubtype, field)` (`ToolNode/tools/utils/utils.ts`, typed as the exact string).

```ts
// BraveSearchTool/constants.ts
export const TOOL_SUBTYPE = "brave-search";
export const LOCAL_SECRETS = {API_KEY: "apiKey"} as const;
export const GLOBAL_SECRETS = {
    API_KEY: globalToolProp(TOOL_SUBTYPE, LOCAL_SECRETS.API_KEY),
} as const satisfies Record<keyof typeof LOCAL_SECRETS, string>;
```

- **ToolNode** builds each handler's config with `configValue`: the shared value if it is set (even to empty), else the node's own `userConfig` value. It uses the same rule for its "missing configuration" check.
- **A tool's settings fields** show `shared ?? own` and write both.
- **The Google tools** share one Client ID under `googleClientId` (`GOOGLE_CLIENT_ID_KEY` in `tools/utils/oauth.ts`), which doesn't follow the pattern. ToolNode never passes it on, which is fine: no handler uses it, only the Connect button does. Their access tokens do follow the pattern, and `TOOL_SUBTYPE` keeps the key Connect writes the same as the one ToolNode reads.

## Settings → Credentials

- `client/src/services/credentials.ts`:
  - groups the declared keys from `nodeRegistry` and `toolRegistry` (`knownCredentials`), each with the descriptors that declare it, for their icons;
  - stores custom keys under `credential.<name>`, so they can never overwrite an app setting.
- `client/src/hooks/useCredentials.ts`: the saved list (the vault's readable key names), save and remove. Both go through the vault, asking for the password if it's locked, and set or clear the session value.
- `ActionsDock/components/Settings/components/`: `Credentials.tsx` (the list; each row copies its `{{name}}` placeholder, never the value), `AddCredentialForm.tsx` (an Autocomplete of the declared keys, with icons, also accepting custom names), `CredentialIcons.tsx`.

## The Vault

Saved credentials and outside connections' tokens are encrypted with the user's password. The password is never stored.

- **Crypto** (`services/vault/crypto.ts`): PBKDF2-SHA256 (600,000 rounds, a random 16-byte salt) makes an AES-GCM-256 key from the password.
  - Web Crypto is used where the page has it.
  - Browsers drop `crypto.subtle` on a plain-HTTP network address, so there the same algorithms run in code (`@noble/hashes`, `@noble/ciphers`): about 3.5 s to derive the key instead of 0.5 s. A vault written by either opens with the other.
  - A wrong password fails AES-GCM's own check (`WrongPasswordError`), so no password check value is stored.
- **Format** (`services/vault/vault.ts`): one localStorage entry, `agentic-signal.vault`, kept apart from the global store's keys so it never loads as plain text:
  - `{version, salt, iterations, iv, ciphertext, credentialKeys}`;
  - the ciphertext holds `{credentials: {storeKey: value}, connectionTokens: {connectionId: token}}`;
  - `credentialKeys` (names only) stays readable, so Settings can list saved keys while locked;
  - every save re-encrypts the whole vault with a new IV.
- **State** (`stores/vault.ts`): the file, the key and the decrypted secrets (both in memory only, until a reload or Lock Now), and the popup's prompt.
  - `requestVaultAccess()` resolves once the vault is open, opening the popup to unlock it (or, with no vault yet, to create it). It resolves false if the user closes the popup.
  - Unlocking puts the saved credentials into the global store as **session** values, filling only keys that are empty, so a value typed before unlocking wins. Nodes need no change.
  - `updateVault`, `changeVaultPassword` (opens with the old password, re-creates with a new salt, and leaves the vault open: on a locked vault it does what unlocking does), `lockVault` (also clears the saved keys' session values), `resetVault` (deletes the vault, clears the saved keys' values, and removes the outside connections, whose tokens are gone).
  - Another tab changing the vault (a `storage` event) locks this one, which keeps its session values: its key may no longer fit, and saving with it would overwrite the change.
- **UI:**
  - `components/VaultDialog`, mounted once in `App`, is the create / unlock popup, with **Forgot password?** → reset.
  - `hooks/useVaultStartup.ts` opens it at startup when a vault exists.
  - Settings → Vault (`ActionsDock/components/Settings/components/Vault.tsx`) holds the status, Unlock / Lock Now, Change Password and Reset Vault.
  - Clear App Data deletes the vault entry.
- **Outside connections** keep `{id, name, commands, tokenHash}` in the global store, and the token in the vault. Outside calls need only the hash, so they work while locked; adding a connection or copying a token asks to unlock. Removing one never does, so an app can always be cut off; its token leaves the vault at the next save.
- **Plain-text leftovers:** creating the vault (`createVaultKeepingSaved`, `services/vault/migration.ts`) takes along any credentials still persisted in plain text, such as Slack tokens that Slack nodes used to save that way, and any connection still holding its token. It then removes the plain-text copies.

The vault protects secrets at rest: a copied browser profile or app data. Once unlocked, the values are in memory, in node data and in requests, as in any app.

## Credentials in URLs

`client/src/services/credentialPlaceholders.ts` fills `{{NAME}}` in the URLs of GET Data and Fetch Web Page.

- `fillCredentialPlaceholders(text, saved)` reads only credentials saved in Settings:
  - NAME must be in the vault's readable `credentialKeys`, either as a declared key or as `credential.<NAME>`;
  - the value comes from the decrypted vault, not the global store, so app settings and values typed into nodes are out of reach;
  - a name that isn't saved, or a locked vault, throws an error naming the placeholder;
  - values go in as saved, not URL-encoded, so a whole secret URL works.
- `withCredentials(text, task)` runs the request with the filled text. In a thrown error's message, it replaces each value with its placeholder, plain or percent-encoded. That matters because errors repeat URLs: the backend's `renderHtml` does.
- Nodes fill the URL at the last moment, inside the request. Node data, workflow files and the payloads between nodes keep the placeholders.
- GET Data also fills a URL that comes from upstream. Whatever builds that URL picks both the key and the host.

## Adding a Secret to a Node

1. Add `LOCAL_SECRETS` and `GLOBAL_SECRETS` to the node's `constants.tsx`. Reuse an existing store key when the secret is the same one another node uses.
2. In the descriptor: `globalSecrets: Object.values(GLOBAL_SECRETS)`, and add `...Object.values(LOCAL_SECRETS)` to `defaultData.toSanitize`.
3. In the component, read and write the shared value, and seed it once from the node's data:

```tsx
const {apiKey: savedApiKey} = data;
const {globalData, setGlobalData} = useGlobalConfig();
const apiKey = globalData[GLOBAL_SECRETS.API_KEY] || "";
const setApiKey = (value: string) => setGlobalData(GLOBAL_SECRETS.API_KEY, value);

// A key in an older workflow file becomes the shared one, if none is set yet.
useEffect(() => {
    if (!apiKey && savedApiKey) setApiKey(savedApiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

4. Bind the settings field to `apiKey` / `setApiKey` (`type="password"`). Credentials lists the key automatically.

## Adding a Secret to a Tool

1. Add `constants.ts` with `TOOL_SUBTYPE`, `LOCAL_SECRETS` and `GLOBAL_SECRETS` built with `globalToolProp`.
2. In the descriptor:
   - `toolSubtype: TOOL_SUBTYPE`;
   - `globalSecrets: Object.values(GLOBAL_SECRETS)`;
   - ``toSanitize: Object.values(LOCAL_SECRETS).map(field => `userConfig.${field}`)``;
   - key the `userConfigSchema` entries with `[LOCAL_SECRETS.X]`;
   - exclude them from the generic `UserConfigFields`.
3. Give the tool its own settings field: show `globalData[GLOBAL_SECRETS.X] ?? userConfig.x ?? ""`, and on change call both `onConfigChange(LOCAL_SECRETS.X, value)` and `setGlobalData(GLOBAL_SECRETS.X, value)`. ToolNode then runs with the shared value.
