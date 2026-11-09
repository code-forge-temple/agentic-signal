/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ConfirmDialog} from '../../../../ConfirmDialog';
import {AI_LAYER_READ_ONLY_HINT} from '../../../../../context/LayersContextBase';
import {LoadQuestion} from '../hooks/useWorkflowLoading';


/** Asked when a workflow is loaded over another one: add to it, replace it, or open the loaded one in a new layer. */
export function LoadWorkflowQuestion ({question, readOnly}: {question: LoadQuestion; readOnly: boolean}) {
    return (
        <ConfirmDialog
            open={question.open}
            onClose={question.close}
            title="Load Workflow"
            width={700}
            maximizable={false}
            message={readOnly
                ? `Can't import into this layer: ${AI_LAYER_READ_ONLY_HINT}. Import it into a new layer instead?`
                : "A workflow is already loaded. Would you like to add to the existing workflow, replace it, or open the loaded one in a new layer?"}
            confirmLabel="Add to New Layer"
            onConfirm={question.loadIntoNewLayer}
            extraActions={readOnly ? undefined : [
                {label: "Replace Existing", onClick: question.replace},
                {label: "Add to Existing", onClick: question.merge},
            ]}
        />
    );
}
