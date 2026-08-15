/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import FormIcon from "./assets/form.svg";
import {Box, Slider, Typography} from "@mui/material";
import {ToolDefinition} from "../types";
import {GraphQLService} from "./services/graphqlService";
import {extendSystemUserConfigSchema} from "../../../../../types/ollama.types";
import {isTauri} from "../../../../../utils";
import {UserConfigFields} from "../../UserConfigFields";
import {excludeKeysFromObject} from "../../../../../utils";


export const FormInteractionToolDescriptor: ToolDefinition = {
    toolSubtype: "form-interaction",
    title: "Form Interaction Tool",
    icon: <FormIcon />,
    toolSchema: {
        name: "formInteraction",
        // eslint-disable-next-line max-len
        description: "Navigates to a web form, reads its fields (labels, types, selectors, options) and its clickable buttons (actionButtons: label + selector, e.g. 'Next' or 'Submit'). Call without actions first to discover both. Then call again with fill actions and submitSelector set to the selector of the matching button from actionButtons — never guess a selector such as '#submitBtn' or 'button[type=submit]'. For multi-page/multi-step forms only the current page's fields and buttons are returned; after each click the tool returns the resulting page's fields and actionButtons, so repeat discover-or-fill, then click, using the newly returned selectors, until submitted is true or there are no more required fields. A single discovery call does not fill or submit anything — keep calling this tool with real actions until it returns submitted: true. Never write out field values, actions, or a submission result as plain text/markdown instead of calling the tool.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "URL of the web page containing the form to interact with.",
                },
                actions: {
                    type: "array",
                    description:
                        "List of fill actions to perform. Omit or pass an empty array to only read the form. " +
                        "Each action targets a field by its CSS selector.",
                    items: {
                        type: "object",
                        properties: {
                            selector: {type: "string", description: "CSS selector of the target element."},
                            type: {
                                type: "string",
                                enum: ["fill", "select", "check", "uncheck", "click", "upload"],
                                description:
                                    "fill=type text, select=choose dropdown option by label or value, " +
                                    "check/uncheck=toggle checkbox, click=click any element, " +
                                    "upload=attach a pre-configured file (requires fileKey).",
                            },
                            value: {
                                type: "string",
                                description: "Text to type (fill), option label/value to choose (select), or ignored for check/uncheck/click.",
                            },
                            fileKey: {
                                type: "string",
                                description:
                                    "Name of the file to upload. Use the original filename of a binary file " +
                                    "attached in DataSourceNode (e.g. 'my-cv.pdf'), or a key from the tool's " +
                                    "Configured Files setting for pre-existing server-side files. " +
                                    "Required when type is 'upload'.",
                            },
                        },
                        required: ["selector", "type"],
                    },
                },
                submitSelector: {
                    type: "string",
                    description:
                        "CSS selector of the submit or 'Next' button to click after filling — use the " +
                        "selector of the matching entry from actionButtons (returned by a prior call), " +
                        "never a guessed selector. Omit if you only want to fill without advancing.",
                },
            },
            required: ["url"],
        },
    },
    userConfigSchema: extendSystemUserConfigSchema({
        typingDelay: {
            type: "number",
            description: "Seconds between each field action (0 = instant fill, no pauses; 1 = default human-like pace)",
            required: false,
            default: 1,
        },
        interactionTimeoutSeconds: {
            type: "number",
            description: "Max seconds for one tool call (raise if a high typing delay + long text fields time out)",
            required: false,
            default: 300,
            minimum: 30,
            maximum: 1800,
        },
    }),
    renderConfig: function ({userConfig, onConfigChange}) {
        const delay = (userConfig.typingDelay as number) ?? 1;

        return (
            <>
                <Box sx={{display: "flex", alignItems: "center", gap: 2, mb: 2}}>
                    <Typography variant="body2">Typing delay</Typography>
                    <Slider
                        size="small"
                        min={0}
                        max={2}
                        step={0.2}
                        marks
                        value={delay}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v: number) => v === 0 ? "Off" : `${v}s`}
                        onChange={(_, value) => onConfigChange("typingDelay", Number(value))}
                        sx={{flex: 1}}
                    />
                    <Typography variant="body2" sx={{minWidth: 28, textAlign: "right"}}>
                        {delay === 0 ? "Off" : `${delay.toFixed(1)}s`}
                    </Typography>
                </Box>
                <UserConfigFields
                    userConfigSchema={excludeKeysFromObject(this.userConfigSchema, ["typingDelay"])}
                    userConfig={userConfig}
                    onConfigChange={onConfigChange}
                />
            </>
        );
    },
    toSanitize: [],
    handlerFactory: (userConfig: {typingDelay?: number; browserPath?: string; interactionTimeoutSeconds?: number}) =>
        async (params: {
            url: string;
            actions?: any[];
            submitSelector?: string;
            /** Injected by LlmProcessNode from structured DataSourceNode output. */
            toolsPayload?: Array<{name: string; base64: string; mimeType: string}>;
            /**
             * Injected by LlmProcessNode — unique per run-trigger, so two concurrent runs
             * (e.g. the same workflow launched from two tabs) get isolated browser sessions
             * on the server instead of colliding on the same form URL.
             */
            sessionId: string;
        }) => {
            if(!userConfig.browserPath && isTauri()){
                return {error: "Browser executable path must be specified. Please set Browser Executable Path in the app Settings."};
            }

            if (!params.url) {
                return {error: "`url` parameter is required."};
            }

            try {
                // LLMs generate { type, selector, value } but the GraphQL field is 'actionType'
                // (renamed to avoid the GraphQL SDL reserved-keyword collision).
                const normalizedActions = params.actions?.map((a: any) => {
                    const isUpload = (a.actionType ?? a.type) === "upload";

                    return {
                        selector: a.selector,
                        actionType: a.actionType ?? a.type,
                        value: a.value,
                        // For upload actions: fall back to value if fileKey is absent (LLMs sometimes
                        // use value for the filename). For other actions: only include fileKey if
                        // explicitly provided (prevents "Jane" etc. leaking into fileKey).
                        ...(isUpload
                            ? {fileKey: a.fileKey ?? a.value}
                            : a.fileKey !== undefined ? {fileKey: a.fileKey} : {}),
                    };
                });

                console.log(
                    "[FormInteraction] handler — raw actions[0]:", JSON.stringify(params.actions?.[0]),
                    "| normalized actions[0]:", JSON.stringify(normalizedActions?.[0]),
                    "| total:", normalizedActions?.length ?? 0
                );

                return await GraphQLService.formInteraction({
                    url: params.url,
                    actions: normalizedActions,
                    submitSelector: params.submitSelector,
                    attachedFiles: params.toolsPayload,
                    typingDelay: userConfig.typingDelay ?? 1,
                    browserPath: userConfig.browserPath,
                    interactionTimeoutSeconds: userConfig.interactionTimeoutSeconds ?? 300,
                    sessionId: params.sessionId,
                    toolName: FormInteractionToolDescriptor.toolSubtype,
                });
            } catch (error) {
                console.error("FormInteraction error:", error);

                return {error: error instanceof Error ? error.message : "Unknown error"};
            }
        },
    // A single run may open a browser session per form URL it visits (e.g. one per
    // orchestrated agent task); this sweeps all of them once the run ends, instead of
    // leaving any that didn't hit the tool's own auto-close heuristic open until the
    // server's idle timeout.
    runtimeCleanup: () => async (sessionId: string) => {
        await GraphQLService.closeFormSessions(sessionId).catch((error) => {
            console.error("FormInteraction cleanup error:", error);
        });
    },
};
