import {ToolSchema, UserConfigSchema} from "../../../../types/ollama.types";

export type ToolDefinition = {
    toolSubtype: string;
    title: string;
    icon: any;
    toolSchema: ToolSchema;
    userConfigSchema: UserConfigSchema;
    handlerFactory: (userConfig: any) => (params: any) => Promise<any>;
    toSanitize: string[];
};