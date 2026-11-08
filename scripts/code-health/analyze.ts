/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ESLint, type Rule} from "eslint";
import tseslint from "typescript-eslint";
import {codeHealthConfig} from "../../eslint.code-health.js";


/** One code-health rule broken: where, by how much, and in which function. */
export type Finding = {
    rule: string;
    line: number;
    /** The measured value (complexity 14, 92 lines, ...); 1 for rules without one (a duplicated function). */
    value: number;
    /** The rule's limit, when it has one. */
    limit: number;
    /** The innermost function the finding belongs to; null for a file-level one. */
    fn: string | null;
};

export type Analysis = {findings: Finding[]; lines: number};

type FunctionRange = {name: string; line: number; endLine: number};

const RANGE_RULE = "health/function-range";

// `useEffect(() => ...)` → "useEffect", `page.evaluate(() => ...)` → "evaluate".
const calleeName = (call: Rule.Node): string | null => {
    if (call.type !== "CallExpression") return null;

    if (call.callee.type === "Identifier") return call.callee.name;

    return call.callee.type === "MemberExpression" && call.callee.property.type === "Identifier" ? call.callee.property.name : null;
};

const KEYED = new Set(["MethodDefinition", "Property", "PropertyDefinition"]);

// The name a function is held under: `const f = ...`, or a method's or property's key.
const heldName = (holder: Rule.Node): string | null => {
    if (holder.type === "VariableDeclarator") return holder.id.type === "Identifier" ? holder.id.name : null;

    return KEYED.has(holder.type) && "key" in holder && holder.key.type === "Identifier" ? holder.key.name : null;
};

// `function f`, `const f = () =>`, `const f = useCallback(() =>`, methods, class fields, `(useEffect callback)`.
function functionName (node: Rule.Node): string {
    if ("id" in node && node.id?.type === "Identifier") return node.id.name;

    const parent = node.parent;
    const callee = calleeName(parent);

    return heldName(parent.type === "CallExpression" ? parent.parent : parent) ?? (callee ? `(${callee} callback)` : "(anonymous)");
}

// Reports every function with its path ("interactWithForm › (evaluate callback)"), so findings can be grouped by the
// function they're in. A path, unlike a line number, stays the same when lines above it move.
const functionRangeRule: Rule.RuleModule = {
    meta: {type: "suggestion", schema: [], messages: {range: "{{name}}"}},
    create: (context) => {
        const path: string[] = [];
        const enter = (node: Rule.Node) => {
            path.push(functionName(node));
            context.report({node, messageId: "range", data: {name: path.join(" › ")}});
        };
        const exit = () => {
            path.pop();
        };

        return {
            "FunctionDeclaration": enter,
            "FunctionExpression": enter,
            "ArrowFunctionExpression": enter,
            "FunctionDeclaration:exit": exit,
            "FunctionExpression:exit": exit,
            "ArrowFunctionExpression:exit": exit,
        };
    },
};

let eslint: ESLint | undefined;

// No type information: the code-health rules don't need it, and a file takes milliseconds instead of seconds.
const linter = (root: string): ESLint => eslint ??= new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
        {
            files: ["**/*.{ts,tsx}"],
            languageOptions: {parser: tseslint.parser, parserOptions: {ecmaFeatures: {jsx: true}}},
            plugins: {health: {rules: {"function-range": functionRangeRule}}},
            rules: {[RANGE_RULE]: "warn"},
        },
        ...codeHealthConfig,
    ],
});

// The duplication rules measure nothing: their messages hold line numbers.
const UNMEASURED = new Set(["sonarjs/no-identical-functions", "sonarjs/no-duplicated-branches"]);

// "has a complexity of 14. Maximum allowed is 10" → 14 and 10; "from 21 to the 15 allowed" → 21 and 15.
const measures = (rule: string, message: string): {value: number; limit: number} => {
    if (UNMEASURED.has(rule)) return {value: 1, limit: 0};

    const [value = 1, limit = 0] = (message.match(/\d+/g) ?? []).map(Number);

    return {value, limit};
};

// The innermost function holding the line; a function-level rule reports on the function's own first line.
const innermost = (ranges: FunctionRange[], line: number): string | null => {
    const holding = ranges.filter(range => range.line <= line && line <= range.endLine);

    holding.sort((a, b) => (a.endLine - a.line) - (b.endLine - b.line));

    return holding[0]?.name ?? null;
};

/** The code-health findings in `text`, linted as if it were the file at `filePath`. */
export async function analyzeText (root: string, filePath: string, text: string): Promise<Analysis> {
    const [result] = await linter(root).lintText(text, {filePath});
    const messages = result?.messages ?? [];
    const ranges = messages
        .filter(message => message.ruleId === RANGE_RULE)
        .map(message => ({name: message.message, line: message.line, endLine: message.endLine ?? message.line}));
    const findings = messages
        .filter(message => message.ruleId !== null && message.ruleId !== RANGE_RULE)
        .map(message => ({
            rule: message.ruleId ?? "",
            line: message.line,
            ...measures(message.ruleId ?? "", message.message),
            fn: message.ruleId === "max-lines" ? null : innermost(ranges, message.line),
        }));

    return {findings, lines: text.split("\n").filter(line => line.trim() !== "").length};
}
