/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useGlobalConfig} from "../../../../../../stores/globalConfig";
import {globalToolProp} from "../../utils/utils";
import {DebouncedTextField} from "../../../../../DebouncedTextField";

type FetchWeatherDataToolConfigFieldsProps = {
    userConfig: Record<string, any>;
    onConfigChange: (key: string, value: string | number | boolean) => void;
};

export function FetchWeatherDataToolConfigFields ({userConfig, onConfigChange}: FetchWeatherDataToolConfigFieldsProps) {
    const {globalData, setGlobalData} = useGlobalConfig();
    const globalApiKeyKey = globalToolProp("fetch-weather-data", "apiKey");
    const apiKeyValue = globalData[globalApiKeyKey] || userConfig?.apiKey || "";

    return (
        <DebouncedTextField
            label="WeatherAPI.com API Key"
            value={apiKeyValue}
            onChange={(value) => {
                onConfigChange("apiKey", value);
                setGlobalData(globalApiKeyKey, value, true);
            }}
            fullWidth
            sx={{mb: 1}}
            type="password"
            helperText="Your Weather API key is retained globally for this tool."
        />
    );
}
