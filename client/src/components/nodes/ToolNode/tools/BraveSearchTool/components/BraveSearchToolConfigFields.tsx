/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useGlobalConfig} from "../../../../../../stores/globalConfig";
import {globalToolProp} from "../../utils/utils";
import {DebouncedTextField} from "../../../../../DebouncedTextField";

type BraveSearchToolConfigFieldsProps = {
    userConfig: Record<string, any>;
    onConfigChange: (key: string, value: string | number | boolean) => void;
};

export function BraveSearchToolConfigFields ({userConfig, onConfigChange}: BraveSearchToolConfigFieldsProps) {
    const {globalData, setGlobalData} = useGlobalConfig();
    const globalApiKeyKey = globalToolProp("brave-search", "apiKey");
    const apiKeyValue = globalData[globalApiKeyKey] || userConfig?.apiKey || "";

    return (
        <DebouncedTextField
            label="Brave Search API Key"
            value={apiKeyValue}
            onChange={(value) => {
                onConfigChange("apiKey", value);
                setGlobalData(globalApiKeyKey, value);
            }}
            fullWidth
            sx={{mb: 1}}
            type="password"
            helperText="Your Brave Search API key is retained globally for this tool."
        />
    );
}
