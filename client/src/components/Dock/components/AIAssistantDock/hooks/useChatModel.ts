/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useState} from 'react';
import {useGlobalConfig} from '../../../../../stores/globalConfig';
import {useFetchModels} from '../../../../../hooks/useFetchModels';


const NO_MODEL = '';

/**
 * The model the chat talks to: the saved one if Ollama still has it; otherwise none, and the saved choice is cleared.
 * While Ollama can't be reached nothing is known about the model, so the saved choice stays for next time.
 */
export function useChatModel () {
    const {globalData, setGlobalData} = useGlobalConfig();
    const storedModel: string = globalData['selectedModel'] || '';
    const [selectedModel, setSelectedModel] = useState<string>(NO_MODEL);
    const {models, reachable, isFetchingModels, fetchModels} = useFetchModels();

    useEffect(() => {
        void fetchModels().then((names) => {
            if (names === null) return;

            if (storedModel && names.includes(storedModel)) return setSelectedModel(storedModel);

            setSelectedModel(NO_MODEL);

            if (storedModel) setGlobalData('selectedModel', NO_MODEL, true);
        });
    }, [storedModel, setGlobalData, fetchModels]);

    // The list is the app's: a model deleted elsewhere (Settings → Ollama) stops being the chat's too, by the same rule.
    useEffect(() => {
        if (!reachable || selectedModel === NO_MODEL || models.includes(selectedModel)) return;

        setSelectedModel(NO_MODEL);
        setGlobalData('selectedModel', NO_MODEL, true);
    }, [models, reachable, selectedModel, setGlobalData]);

    // A model chosen in the chat is saved for next time.
    const chooseModel = useCallback((model: string) => {
        setSelectedModel(model);
        setGlobalData('selectedModel', model, true);
    }, [setGlobalData]);

    return {selectedModel, models, isFetchingModels, chooseModel};
}
