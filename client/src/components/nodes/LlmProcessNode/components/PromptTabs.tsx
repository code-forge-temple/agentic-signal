/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CodeEditor} from "../../../CodeEditor";
import {AceEditorMode} from "../../../CodeEditor/types";
import {BasicTabs} from "../../../Tabs/Tabs";
import {PromptField, PromptFields} from "../hooks/usePromptFields";


const editor = ([value, onChange]: PromptField, mode: AceEditorMode, placeholder: string) => (
    <CodeEditor mode={mode} placeholder={placeholder} value={value} onChange={onChange} showLineNumbers={true} />
);

/** System prompt, user message (prefix and suffix) and structured output (on success, on error). */
export function PromptTabs ({fields}: {fields: PromptFields}) {
    return (
        <BasicTabs tabs={[
            {
                title: "System Prompt",
                content: editor(fields.systemPrompt, "markdown", "System prompt that will be used to guide the AI model"),
            },
            {
                title: "User Message",
                content: (
                    <BasicTabs key="user-message-tabs" tabs={[
                        {title: "Message Prefix", content: editor(fields.prefix, "markdown", "Prefix (optional) that will be added to the node input before processing")},
                        {title: "Message Suffix", content: editor(fields.suffix, "markdown", "Suffix (optional) that will be added to the node input before processing")},
                    ]} />
                ),
            },
            {
                title: "Structured Output",
                content: (
                    <BasicTabs key="structured-output-tabs" tabs={[
                        {title: "ON SUCCESS", content: editor(fields.onSuccess, "json", "Optional JSON schema for structured output on success")},
                        {title: "ON ERROR", content: editor(fields.onError, "json", "Optional JSON schema for structured output for on error")},
                    ]} />
                ),
            },
        ]} />
    );
}
