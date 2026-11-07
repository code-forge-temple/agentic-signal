/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Chip, Tooltip} from '@mui/material';
import {Sparks} from 'iconoir-react';
import {useLayers} from '../../../../../../../../../hooks/useLayers';
import {AI_LAYER} from '../../../../../../../../../context/LayersContextBase';


/** The AI Buddy layer as a tag in the chat, with the layer switcher's icon: clicking it shows that layer. */
export function AiLayerChip () {
    const {setActiveLayer} = useLayers();

    return (
        <Tooltip title={`Show the ${AI_LAYER.name} layer`}>
            <Chip
                className="chat-log-layer-chip"
                size="small"
                variant="outlined"
                icon={<Sparks />}
                label={`${AI_LAYER.name} layer`}
                onClick={() => setActiveLayer(AI_LAYER.id)}
            />
        </Tooltip>
    );
}
