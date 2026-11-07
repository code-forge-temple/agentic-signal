/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactFlowProvider} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.scss';
import {useCallback, useRef, useState} from 'react';
import {Dock} from '../Dock';
import {useSnackbar} from 'notistack'
import {useFullscreen} from '../../hooks/useFullscreen';
import {Chip} from '@mui/material';
import {ErrorBoundary} from '../ErrorBoundary/ErrorBoundary';
import {LayersProvider} from '../../context/LayersContext';
import {LAYER_KIND} from '../../context/LayersContextBase';
import {useLayers} from '../../hooks/useLayers';
import {WorkflowLayer} from './components/WorkflowLayer';
import {LayerSwitcher} from './components/LayerSwitcher';
import {ConfirmDialog} from '../ConfirmDialog';
import {useSettings} from '../../hooks/useSettings';
import {useOutsideCommands} from '../../hooks/useOutsideCommands';
import {listWorkflowsFolder, saveWorkflowFile} from '../../services/workflowsService';
import {findWorkflowCommand, workflowFileName, WORKFLOWS_CHANGED_EVENT} from '../../workflows';


type PendingFolderSave = {
    name: string;
    content: string;
};

function AppLayers () {
    const {layers, activeLayer, getLayerApi} = useLayers();
    const {settings} = useSettings();
    const {enqueueSnackbar} = useSnackbar();
    const dockRef = useRef<HTMLDivElement>(null);
    // Kept after the dialog closes, so its message doesn't go blank while it fades out.
    const [pendingFolderSave, setPendingFolderSave] = useState<PendingFolderSave | null>(null);
    const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);

    useFullscreen();
    useOutsideCommands();

    const getActiveLayerApi = useCallback(() => getLayerApi(activeLayer.id), [getLayerApi, activeLayer.id]);

    const handleSave = useCallback(() => getActiveLayerApi()?.save(), [getActiveLayerApi]);

    const handleClear = useCallback(() => getActiveLayerApi()?.clear(), [getActiveLayerApi]);

    const handleLoadWorkflow = useCallback((json: string, onError?: (error: string) => void) => {
        getActiveLayerApi()?.loadWorkflowFromJson(json, {onError});
    }, [getActiveLayerApi]);

    const handleLoadWorkflowFile = useCallback((json: string, fileName: string) => {
        getActiveLayerApi()?.loadWorkflowFromJson(json, {fileName});
    }, [getActiveLayerApi]);

    const handleGetWorkflowJson = useCallback(() => getActiveLayerApi()?.getWorkflowJson() ?? '', [getActiveLayerApi]);

    const handleLoad = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            handleLoadWorkflowFile(e.target?.result as string, file.name);
            event.target.value = '';
        };
        reader.readAsText(file);
    }, [handleLoadWorkflowFile]);

    const writeToWorkflowsFolder = useCallback(async ({name, content}: PendingFolderSave) => {
        try {
            const path = await saveWorkflowFile(settings.workflowsFolder, name, content);
            const found = findWorkflowCommand(JSON.parse(content));

            window.dispatchEvent(new Event(WORKFLOWS_CHANGED_EVENT));

            enqueueSnackbar(found ? `Saved to ${path}. Call it in the chat as /${found.command}.` : `Saved to ${path}.`, {variant: 'success'});
        } catch (error) {
            enqueueSnackbar(`Couldn't save to the workflows folder: ${error instanceof Error ? error.message : String(error)}`, {variant: 'error'});
        }
    }, [settings.workflowsFolder, enqueueSnackbar]);

    const handleSaveToFolder = useCallback(async () => {
        const layerApi = getActiveLayerApi();

        if (!layerApi?.hasNodes()) {
            enqueueSnackbar('Nothing to save.', {variant: 'info'});

            return;
        }

        const content = layerApi.getWorkflowJson();
        const command = activeLayer.kind === LAYER_KIND.AI ? findWorkflowCommand(JSON.parse(content))?.command : undefined;
        const save = {name: workflowFileName(command ?? activeLayer.name), content};

        try {
            const {files} = await listWorkflowsFolder(settings.workflowsFolder);

            if (files.some(file => file.name === save.name)) {
                setPendingFolderSave(save);
                setIsReplaceConfirmOpen(true);

                return;
            }
        } catch (error) {
            enqueueSnackbar(`Couldn't open the workflows folder: ${error instanceof Error ? error.message : String(error)}`, {variant: 'error'});

            return;
        }

        await writeToWorkflowsFolder(save);
    }, [getActiveLayerApi, activeLayer.name, activeLayer.kind, settings.workflowsFolder, enqueueSnackbar, writeToWorkflowsFolder]);

    return (
        <>
            <Dock
                ref={dockRef}
                readOnly={activeLayer.kind === LAYER_KIND.AI}
                onSave={handleSave}
                onSaveToFolder={() => void handleSaveToFolder()}
                onLoad={handleLoad}
                onClear={handleClear}
                onLoadWorkflow={handleLoadWorkflow}
                onLoadWorkflowFile={handleLoadWorkflowFile}
                getWorkflowJson={handleGetWorkflowJson}
            />
            <ConfirmDialog
                open={isReplaceConfirmOpen}
                onClose={() => setIsReplaceConfirmOpen(false)}
                title="Replace Workflow"
                message={`"${pendingFolderSave?.name}" is already in your workflows folder. Replace it?`}
                confirmLabel="Replace"
                maximizable={false}
                onConfirm={() => {
                    if (pendingFolderSave) void writeToWorkflowsFolder(pendingFolderSave);
                }}
            />
            {layers.map(layer => (
                <ReactFlowProvider key={layer.id}>
                    <ErrorBoundary onError={(error) => enqueueSnackbar(
                        `An unexpected error occurred in ${layer.name}: ` + error.message,
                        {variant: 'error'}
                    )}>
                        <WorkflowLayer layer={layer} isActive={layer.id === activeLayer.id} dockRef={dockRef} />
                    </ErrorBoundary>
                </ReactFlowProvider>
            ))}
            <LayerSwitcher />
        </>
    );
}

export function App () {
    return (
        <div style={{width: '100vw', height: '100vh', position: 'relative'}}>
            <Chip
                label={`v${__APP_VERSION__}`}
                size="small"
                className="version-tag"
            />
            <LayersProvider>
                <AppLayers />
            </LayersProvider>
        </div>
    );
}
