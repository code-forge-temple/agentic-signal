/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useGlobalConfig} from "../../../../../../stores/globalConfig";
import {GLOBAL_SECRETS, LOCAL_SECRETS} from "../constants";
import {DebouncedTextField} from "../../../../../DebouncedTextField";

type FetchWeatherDataToolConfigFieldsProps = {
    userConfig: { apiKey?: string };
    onConfigChange: (key: string, value: string | number | boolean) => void;
};

export function FetchWeatherDataToolConfigFields ({userConfig, onConfigChange}: FetchWeatherDataToolConfigFieldsProps) {
    const {globalData, setGlobalData} = useGlobalConfig();
    const apiKeyValue = globalData[GLOBAL_SECRETS.API_KEY] ?? userConfig?.apiKey ?? "";

    return (
        <DebouncedTextField
            label="WeatherAPI.com API Key"
            value={apiKeyValue}
            onChange={(value) => {
                onConfigChange(LOCAL_SECRETS.API_KEY, value);
                setGlobalData(GLOBAL_SECRETS.API_KEY, value);
            }}
            fullWidth
            sx={{mb: 1}}
            type="password"
            helperText="Your Weather API key is retained globally for this tool."
        />
    );
}
