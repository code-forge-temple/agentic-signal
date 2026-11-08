# AI Buddy

The AI Buddy is the chat assistant in `client/src/components/Dock/components/AIAssistantDock/`. It talks to the user's Ollama models straight from the browser. It can build workflows, explain or change the shown one, and run workflows as commands.

Back to the [overview](../ARCHITECTURE.md). User-facing docs: `docs/docs/getting-started/ai-buddy.md`.

## Parts

| Part | Role |
|------|------|
| `AIAssistantDock.tsx` | The dock button; opens and closes the panel. |
| `components/ChatPanel/ChatPanel.tsx` | The conversation (component state; not kept across a reload), sending, streaming, `/command` runs. |
| `.../ChatHeader/` | The model picker, the per-model settings dialog (`LlmSettingsDialog`: thinking, temperature, context window), and the ⚠ warnings (cloud model, context window too small). |
| `.../ChatLog/` | The messages. Each is a memoized `ChatLogMessage`; thinking folds into `ThinkingAccordion`; a prepared workflow gets a **Load Workflow** button. |
| `.../ChatInput/` | The message box, with suggestions for the `@` keywords and the `/` commands (and their descriptions). |
| `hooks/useAiLayerRun.ts` | Loads a command's workflow onto the AI Buddy layer and runs it through the `CommandRouter` ([commands.md](commands.md#calls-from-the-chat)). |
| `utils/` | Model settings and context-window math (`llmSettings.ts`, `modelContext.ts`), the command prompt and suggestion parsing (`chatCommands.ts`), finding a workflow in a reply (`workflowJson.ts`), the model-switch line (`modelSwitch.ts`). |

The selected model and the per-model settings live in the global store, persisted: `selectedModel`, `aiAssistantLlmSettings` (thinking, temperature) and `aiAssistantModelContext` (context window), the last two as JSON maps keyed by model.

## The System Prompt

`client/src/services/buildSystemPrompt.ts` builds the prompt from the registries, so it grows with every node and tool:

- the node types, each with its `metadata.description`, ports and settings, with zod schemas converted to JSON Schema (`zod-to-json-schema`);
- the tools, from `toolRegistry`;
- the workflow JSON format, and the rule to output a workflow **only** when the message contains `@prepare-workflow`.

Each request appends:

- `chatCommandsPrompt(commands)`: the current commands and their descriptions, and how to suggest one;
- `MESSAGE_TIME_NOTE`, which explains the time stamps.

Every user message is sent with a `[Sun 1 Nov 2026, 14:03 GMT-5]`-style stamp of when it was written, never shown in the chat, so the model knows "today". The AI Buddy's own messages aren't stamped, because models copy the pattern.

`minimumContextWindow(systemPrompt)` estimates the context the prompt needs (characters / 4, plus an 8K reserve, rounded up to 8K; about 32K today). `contextWindowWarning` shows the ⚠ when the selected model's window (`resolveContextLimit`: the model's setting, Ollama's default, or a cloud model's maximum) is smaller. When a local model's window overflows, Ollama silently drops the oldest messages, and then the start of the system prompt.

## Keywords

| Keyword | Effect |
|---------|--------|
| `@current-workflow` | Replaced, before sending, by the shown layer's workflow JSON (`getWorkflowJson`). |
| `@prepare-workflow` | Allows the model to answer with a workflow JSON block. `findWorkflowJson` finds it in the reply (`JSON.parse` first, `dirty-json` only as a fallback; remembered per block), and **Load Workflow** loads it into whichever layer is shown when pressed. |

## Commands in the Chat

- **Typed:** `/research <topic>` runs the command ([commands.md](commands.md#calls-from-the-chat)). The model then answers from the result (`commandReplySystemPrompt`). The reply holds the folded result, the thinking, then the answer.
- **Rewind & resend** (`handleResendMessage`): on a user message, drops every entry after it and sends it again through the same paths as a new message, `respond(history)` or `handleCommand(…, history)`, so a command runs again. It uses the stored text, so an expanded `@current-workflow` stays the workflow as it was. If a model-switch notice is among the dropped entries, the switch is redrawn before the resent message with `withModelSwitch`, which merges it with a notice already there, as switching models does. The button is disabled while a reply or a command runs.
- **Suggested:** the model may end a reply with a ` ```command ` block holding one command. `MarkdownRenderer`'s `codeBlockRenderer` hook draws it as a card with **Run** / **Skip** (`parseCommandSuggestion`). **Run** sends the command as the user's own message. Nothing runs without the user, by design: an LLM must not run tools unasked. There is no Ollama tool calling here: the model knows the commands from the prompt.

## Ollama Calls

`client/src/services/ollamaService.ts` handles every model call: the chat, the LLM nodes, tool loops, model pulls and deletes.

- **`think` is always sent explicitly.** `think: false` is safe on every model, and leaving it out silently breaks a "thinking off" setting.
- **A request with an `AbortSignal` gets its own Ollama client,** so Stop cancels that stream only. The shared client's `abort()` would cancel every stream in the app.

## Rendering Performance

Fast models stream many large replies (workflow JSON, command results). These rules keep the UI responsive:

- code highlighting through CSS classes, not inline styles (see [client.md](client.md#rendering-notes));
- code blocks shown plain at once and coloured in the background; huge blocks stay plain;
- memoized chat messages with stable callbacks, and a static Markdown `components` map;
- folded sections (thinking, results) mount their content only while open or closing;
- the Load Workflow button's JSON check tries `JSON.parse` before the slow `dirty-json`.

Measured on a production build with six 15 KB workflows: a layer switch during a streamed reply went from 3–9 s to 0.1–0.2 s.
