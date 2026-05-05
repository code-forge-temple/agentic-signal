/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from 'react';
import {ThemeProvider} from '@mui/material';
import {Sparks} from 'iconoir-react';
import {darkTheme} from '../../../../utils';
import {DockItem} from '../DockItem';
import {ChatPanel} from './components/ChatPanel/ChatPanel';
import './AIAssistantDock.scss';
import {AI_ASSISTANT_TITLE} from './constants';


export const AIAssistantDock = ({onLoadWorkflow, getWorkflowJson}: {onLoadWorkflow: (json: string, onError?: (error: string) => void) => void; getWorkflowJson: () => string}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <ThemeProvider theme={darkTheme}>
            <div className="ai-buddy-dock">
                <div className="dock-items">
                    <DockItem
                        title={AI_ASSISTANT_TITLE}
                        icon={<Sparks />}
                        onClick={() => setIsOpen(prev => !prev)}
                        ariaLabel={`Toggle ${AI_ASSISTANT_TITLE} chat`}
                    />
                </div>
            </div>
            {isOpen && <ChatPanel onClose={() => setIsOpen(false)} onLoadWorkflow={onLoadWorkflow} getWorkflowJson={getWorkflowJson} />}
        </ThemeProvider>
    );
};
