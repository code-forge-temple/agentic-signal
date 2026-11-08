/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect} from 'react';
import {useSettings} from '../../../../../../hooks/useSettings';
import {IconButton, Box, List, ListItem, ListItemText, FormControlLabel, Switch, Typography} from '@mui/material';
import {Trash} from 'iconoir-react';
import {OllamaService} from '../../../../../../services/ollamaService';
import {DebouncedTextField} from '../../../../../DebouncedTextField';
import {BasicTabs} from '../../../../../Tabs/Tabs';
import {PathField} from '../../../../../PathField';
import {listWorkflowsFolder} from '../../../../../../services/workflowsService';
import {OutsideConnections} from './components/OutsideConnections';
import {AddModelField} from './components/AddModelField';
import {Credentials} from './components/Credentials';
import {Vault} from './components/Vault';

const WORKFLOW_COMMANDS_HINT = "A saved workflow with a Workflow Input becomes a chat command.";

// macOS hands over the app bundle ("Google Chrome.app"); Playwright needs the program inside it.
function toBrowserExecutable (path: string): string {
    const bundle = /([^\\/]+)\.app[\\/]?$/.exec(path);

    return bundle ? `${path.replace(/[\\/]$/, "")}/Contents/MacOS/${bundle[1]}` : path;
}

export const Settings = () => {
    const {settings, setSetting} = useSettings();
    const [models, setModels] = useState<string[]>([]);
    const [isOllamaHostValid, setIsOllamaHostValid] = useState(false);
    const [workflowsFolderError, setWorkflowsFolderError] = useState<string | null>(null);
    const [defaultWorkflowsFolder, setDefaultWorkflowsFolder] = useState<string | null>(null);

    const fetchModels = async (): Promise<string[]> => {
        const res = await OllamaService.getInstance().fetchModels();
        const names = res.success ? res.models.map(m => m.name) : [];

        setModels(names);
        setIsOllamaHostValid(res.success);

        return names;
    };

    useEffect(() => {
        setModels([]);
        void fetchModels();
    }, [settings.ollamaHost]);

    // Checks the chosen folder, or learns the default one's path, which the field then shows.
    useEffect(() => {
        let cancelled = false;

        listWorkflowsFolder(settings.workflowsFolder)
            .then(({path}) => {
                if (cancelled) return;

                setWorkflowsFolderError(null);

                if (!settings.workflowsFolder) setDefaultWorkflowsFolder(path);
            })
            .catch((error: unknown) => {
                if (!cancelled) setWorkflowsFolderError(error instanceof Error ? error.message : String(error));
            });

        return () => {
            cancelled = true;
        };
    }, [settings.workflowsFolder]);

    // Checks the freshly fetched names, not `models` state (a closure would only ever see the old list).
    // Sequential, so a slow fetch can't overlap the next attempt.
    const pollForModel = async (modelName: string, maxAttempts = 15, interval = 1000) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const names = await fetchModels();

            // an untagged pull ("llama3") is listed under Ollama's default tag ("llama3:latest")
            if (names.includes(modelName) || names.includes(`${modelName}:latest`)) return;

            await new Promise(resolve => setTimeout(resolve, interval));
        }
    };

    const handleDeleteModel = async (model: string) => {
        await OllamaService.getInstance().deleteModel(model);
        await fetchModels();
    };

    // Filled in with Chrome's own path when found (SettingsProvider); empty means it wasn't.
    const generalTab = (
        <>
            <PathField
                kind="file"
                label="Browser Executable Path *"
                pickerTitle="Choose the browser executable"
                value={settings.browserPath}
                onChange={(path) => setSetting("browserPath", toBrowserExecutable(path))}
                error={!settings.browserPath}
                helperText={settings.browserPath
                    ? "Path to your Chrome Browser executable for Playwright (required for scraping tools like 'Fetch Web Page' Node, etc.)"
                    : "Chrome wasn't found where it's usually installed: enter the path to its executable. Playwright needs it for scraping tools like 'Fetch Web Page' Node, etc."}
            />
            <Box sx={{mt: 2}}>
                <FormControlLabel
                    control={<Switch checked={settings.checkForUpdates} onChange={(_event, checked) => setSetting("checkForUpdates", checked)} />}
                    label="Check for updates at startup"
                />
                <Typography variant="caption" color="text.secondary" component="p">
                    Asks GitHub for the latest release&apos;s version number, nothing more. When a newer version is out, the version tag in the top right corner
                    turns green and links to the release.
                </Typography>
            </Box>
        </>
    );

    // An empty setting means the default folder, shown by its path; entering that folder, or leaving the
    // field empty, keeps it the default.
    const workflowsTab = (
        <>
            <PathField
                kind="folder"
                label="Workflows Folder"
                pickerTitle="Choose the workflows folder"
                value={settings.workflowsFolder || defaultWorkflowsFolder || ""}
                onChange={(path) => setSetting("workflowsFolder", path === defaultWorkflowsFolder ? "" : path)}
                error={workflowsFolderError !== null}
                helperText={workflowsFolderError
                    ?? (settings.workflowsFolder ? WORKFLOW_COMMANDS_HINT : `The default folder. ${WORKFLOW_COMMANDS_HINT}`)}
                reset={settings.workflowsFolder ? {label: "Use the default folder", onReset: () => setSetting("workflowsFolder", "")} : undefined}
            />
            <OutsideConnections />
        </>
    );

    const ollamaTab = (
        <>
            <DebouncedTextField
                label="Ollama Host *"
                variant="outlined"
                fullWidth
                value={settings.ollamaHost}
                onChange={(value) => setSetting("ollamaHost", value)}
            />
            <AddModelField enabled={isOllamaHostValid} onPulled={(model) => pollForModel(model)} />
            <Box sx={{mt: 3, maxHeight: '100%', overflowY: 'auto'}}>
                <List>
                    {
                        models.map((model) => (
                            <ListItem
                                key={model}
                                // CSS hover, not state: a state change per row entered would redraw the whole dialog.
                                sx={{
                                    '&:hover': {backgroundColor: 'action.hover'},
                                    transition: 'background 0.2s'
                                }}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        aria-label="delete"
                                        onClick={() => void handleDeleteModel(model)}
                                        size="small"
                                    >
                                        <Trash style={{fontSize: 16}} />
                                    </IconButton>
                                }
                            >
                                <ListItemText primary={model} />
                            </ListItem>
                        ))
                    }
                </List>
            </Box>
        </>
    );

    return (
        // One height for every tab, so the dialog doesn't jump when switching; it still grows when maximized.
        // On a short screen, what's left of it: MUI caps the dialog at the window less 64px, and its title,
        // margins and buttons take about 170px more.
        <Box sx={{display: 'flex', flexDirection: 'column', flex: '1 0 auto', height: 'min(680px, calc(100vh - 230px))'}}>
            <BasicTabs
                keepMounted
                tabs={[
                    {title: "General", content: generalTab},
                    {title: "Ollama", content: ollamaTab},
                    {title: "Workflows", content: workflowsTab},
                    {title: "Credentials", content: <Credentials />},
                    {title: "Vault", content: <Vault />},
                ]}
            />
        </Box>
    );
};