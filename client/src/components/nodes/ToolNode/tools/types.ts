import {ReactNode} from "react";
import {ToolSchema, UserConfigSchema} from "../../../../types/ollama.types";

export type RenderConfigProps = {
    userConfig: Record<string, any>;
    onConfigChange: (key: string, value: string | number | boolean) => void;
};

export type ToolDefinition = {
    toolSubtype: string;
    title: string;
    icon: any;
    toolSchema: ToolSchema;
    userConfigSchema: UserConfigSchema;
    handlerFactory: (userConfig: any) => (params: any) => Promise<any>;
    toSanitize: string[];
    renderConfig?: (props: RenderConfigProps) => ReactNode;
    /**
     * Optional per-tool cleanup, bound to userConfig at config-time like handlerFactory.
     * Invoked once by LlmProcessNode after a run ends (success or failure), passing only
     * that run's sessionId — lets a tool release resources it may have opened during the
     * run (e.g. a browser session) without LlmProcessNode knowing anything tool-specific.
     */
    runtimeCleanup?: (userConfig: any) => (sessionId: string) => Promise<void>;
};