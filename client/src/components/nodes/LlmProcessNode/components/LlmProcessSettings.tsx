/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {BaseDialog} from "../../../BaseDialog";
import {modelOptions} from "../../../../hooks/useFetchModels";
import {ChangeLlmProcessNodeData, LlmProcessNodeData} from "../types/workflow";
import {RunOptions} from "./RunOptions";
import {PromptTabs} from "./PromptTabs";
import {usePromptFields} from "../hooks/usePromptFields";


const LLM_MODEL_LABEL = "LLM Model";

type LlmProcessSettingsProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    data: LlmProcessNodeData;
    change: ChangeLlmProcessNodeData;
    models: string[];
    isFetchingModels: boolean;
    currentLoop: number;
};

/**
 * The LLM node's settings dialog. It stays mounted while closed, so a prompt text still being typed gets saved; the
 * count fields live inside the dialog, which drops an edit made just before closing.
 */
export function LlmProcessSettings ({open, onClose, title, data, change, models, isFetchingModels, currentLoop}: LlmProcessSettingsProps) {
    const fields = usePromptFields(data, change);

    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            <Box sx={{display: "flex", flexDirection: "column", height: "100%", minHeight: 0}}>
                <FormControl fullWidth size="small" sx={{mb: 2, mt: 1}}>
                    <InputLabel id="llm-label">{LLM_MODEL_LABEL}</InputLabel>
                    <Select
                        labelId="llm-label"
                        label={LLM_MODEL_LABEL}
                        value={data.model || ""}
                        onChange={event => change({model: event.target.value})}
                        disabled={isFetchingModels}
                    >
                        <MenuItem value="" disabled>
                            {isFetchingModels ? "Loading models..." : "Select a model..."}
                        </MenuItem>
                        {modelOptions(data.model, models).map(model => <MenuItem key={model} value={model}>{model}</MenuItem>)}
                    </Select>
                </FormControl>
                <RunOptions data={data} change={change} currentLoop={currentLoop} />
                <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
                    <PromptTabs fields={fields} />
                </Box>
            </Box>
        </BaseDialog>
    );
}
