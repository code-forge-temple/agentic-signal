/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeEnvelope} from "../../../../../types/workflow";
import {Message, MessageRole} from "../../../../../types/ollama.types";
import {CommandError} from "../../../../../services/commandRouter";
import {AI_ASSISTANT_TITLE, ChatEntry, NOTICE_ROLE} from "../constants";
import {errorMessage} from "@shared/utils";


// How much of the model's context window a result may take, leaving the rest to the conversation
// and the reply; and a rough characters-per-token, since nothing here counts tokens exactly.
const RESULTS_SHARE_OF_CONTEXT = 0.5;
const CHARS_PER_TOKEN = 3;

/** The language of the fenced block in which the AI Buddy suggests a command. */
export const COMMAND_SUGGESTION_LANGUAGE = "command";

/**
 * Added to the AI Buddy's instructions: the commands it may suggest, and how. It answers first, then offers
 * a command when more could be looked up; the user runs it, as if they had typed it, or skips it. Leans
 * towards offering one: a needless offer costs a click, a missing one leaves a poorer answer.
 */
export function chatCommandsPrompt (commands: {command: string; description: string}[]): string {
    const list = commands.map(({command, description}) => `- /${command}${description ? `: ${description}` : ""}`).join("\n");
    const fence = "```";

    /* eslint-disable max-len */
    return `

---

## Commands you can suggest

The user has commands: workflows that look things up and come back with fresh results. You can't run them, but you can suggest one at the end of a reply: the user sees it with a Run button, and running it is like typing it.

The commands:
${list}

- Suggest one when the user asks for something the conversation can't fully answer: a new angle or aspect of a topic, a comparison with something earlier results didn't cover, a different place, or more recent information. Answer first from what you have, saying what it doesn't cover, then suggest the command that would find out. Don't stretch earlier results to a question they weren't about, and don't present your own memory as if it had been looked up.
- Don't suggest one when the question is about the conversation itself (summarising or explaining earlier results, rewording an answer) or about this app and its workflows, nor to build or change a workflow.
- Suggest at most one, as the very last thing in the reply, in exactly this form: the command and its input on one line, the input a complete request worded from the conversation (for research, the topic together with the angle asked about).

${fence}${COMMAND_SUGGESTION_LANGUAGE}
/research universal basic income and AI-driven job displacement
${fence}`;
    /* eslint-enable max-len */
}

/**
 * A fenced block the AI Buddy wrote to suggest a command, as the message running it sends: one `/command input`
 * line in a `command` block, naming one of `commands`. Null for any other block, which stays code.
 */
export function parseCommandSuggestion (code: string, language: string | undefined, commands: string[]): {command: string; text: string; message: string} | null {
    const message = code.trim();

    if (language?.toLowerCase() !== COMMAND_SUGGESTION_LANGUAGE || message.includes("\n")) return null;

    const parsed = parseCommandMessage(message);

    return parsed && commands.includes(parsed.command) ? {...parsed, message} : null;
}

/** "/research failed at **GET Data**: HTTP 404": a failed run, naming the node it failed at when known. */
export function commandFailureText (command: string, error: unknown): string {
    const failedNode = error instanceof CommandError ? error.node : undefined;
    const reason = failedNode?.message ?? (errorMessage(error));

    return `/${command} failed${failedNode ? ` at **${failedNode.nodeTitle}**` : ""}: ${reason}`;
}

/** `/command rest of the message` → the command and the text after it, or null for an ordinary message. */
export function parseCommandMessage (message: string): {command: string; text: string} | null {
    const match = /^\s*\/([a-z0-9][a-z0-9-]*)(?:\s+([\s\S]*))?$/i.exec(message);

    return match ? {command: match[1].toLowerCase(), text: (match[2] ?? "").trim()} : null;
}

/**
 * The command a message starts with, the text after it, and the workflow that answers to it (none when no workflow
 * does); null for an ordinary message.
 */
export function resolveCommand<W extends {command: string}> (message: string, workflows: W[]): {command: string; text: string; workflow: W | undefined} | null {
    const parsed = parseCommandMessage(message);

    return parsed && {...parsed, workflow: workflows.find(workflow => workflow.command === parsed.command)};
}

export const commandResultsLabel = (command: string) => `Results of /${command}`;

/**
 * For the reply to a command: the workflow-building system prompt has nothing to say here. It names the
 * request, since with an earlier question in the chat some models (gpt-oss) answered that one instead.
 */
export function commandReplySystemPrompt (command: string, description: string, text: string): string {
    const what = description ? ` (${description.replace(/\.$/, "")})` : "";
    const request = [`/${command}`, text].filter(Boolean).join(" ");

    // eslint-disable-next-line max-len
    return `You are ${AI_ASSISTANT_TITLE}. You ran the workflow /${command}${what} for the user's request "${request}", and its result is in the last message. Answer that request from it: clear and well structured, in Markdown, keeping any sources (with their URLs) the result cites. Say nothing the result doesn't support.`;
}

/** The workflow's result as the message the AI Buddy's model reads, cut to fit a `contextLimit`-token window. */
export function commandResultsMessage (command: string, text: string, result: NodeEnvelope, contextLimit: number): string {
    const raw = typeof result.payload === "string" ? result.payload : JSON.stringify(result.payload, null, 2) ?? "";
    const maxChars = Math.floor(contextLimit * RESULTS_SHARE_OF_CONTEXT * CHARS_PER_TOKEN);
    const body = raw.length > maxChars
        ? `${raw.slice(0, maxChars)}\n\n[… cut to fit the model's context window]`
        : raw;
    const asked = text ? ` for "${text}"` : "";

    return `Results of /${command}${asked}, from the workflow you ran on the ${AI_ASSISTANT_TITLE} layer:\n\n${body}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "GMT+2", "GMT+5:30", "GMT-4", or "GMT": a time zone `minutesEast` of Greenwich. */
export function formatUtcOffset (minutesEast: number): string {
    if (minutesEast === 0) return "GMT";

    const minutes = Math.abs(minutesEast);
    const rest = minutes % 60;

    return `GMT${minutesEast > 0 ? "+" : "-"}${Math.floor(minutes / 60)}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** "[Sun 1 Nov 2026, 14:03 GMT-5]": when a message was sent, in the user's time zone, weekday included. */
export function messageTimeStamp (sentAt: number): string {
    const date = new Date(sentAt);
    const time = [date.getHours(), date.getMinutes()].map(part => String(part).padStart(2, "0")).join(":");

    return `[${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${time} ${formatUtcOffset(-date.getTimezoneOffset())}]`;
}

/**
 * Added to the end of the AI Buddy's instructions, where it keeps them unchanged from one message to the next:
 * what the stamp on each of the user's messages is. Without it, models don't know today's date (one suggested
 * "/holidays Cyprus 2024" in 2026), and some comment on the stamp. "Trust it" because gpt-oss sometimes went
 * by its own sense of the date instead ("Monday, 3 November 2024").
 */
// eslint-disable-next-line max-len
export const MESSAGE_TIME_NOTE = "\n\nEach user message starts with when it was sent, in the user's time zone, for example [Sun 1 Nov 2026, 14:03 GMT-5]. The stamp on the latest message is the current date and time: trust it over anything you remember. Use it for dates and times such as today, tomorrow, this weekend or this year, and for how long ago something was said. Don't repeat it in your replies.";

/**
 * The chat as the model reads it: the user's messages stamped with when they were sent, a command reply's
 * results as a user message just before the reply, and notices (a model switch) left out. A stamp never
 * changes once written, so earlier messages read the same on every request.
 */
export function toModelMessages (messages: ChatEntry[]): Message[] {
    return messages.flatMap((message): Message[] => message.role === NOTICE_ROLE ? [] : [
        ...(message.commandResults ? [{role: MessageRole.USER, content: message.commandResults.content}] : []),
        // A reply still to come (or one that never got any text) has nothing for the model yet.
        ...(message.content
            ? [{role: message.role, content: message.sentAt === undefined ? message.content : `${messageTimeStamp(message.sentAt)} ${message.content}`}]
            : []),
    ]);
}
