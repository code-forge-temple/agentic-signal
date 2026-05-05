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
};