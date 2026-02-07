/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CodeEditor} from '../../../CodeEditor';
import {useDebouncedState} from '../../../../hooks/useDebouncedState';


type JsonInputProps = {
    value?: string;
    onChange: (value: string) => void;
};

export const JsonInput = ({value, onChange}: JsonInputProps) => {
    const [debouncedDataSource, setDebouncedDataSource] = useDebouncedState({
        callback: onChange,
        delay: 300,
        initialValue: value || ""
    });

    return (
        <CodeEditor
            mode={"json"}
            value={debouncedDataSource}
            onChange={setDebouncedDataSource}
            showLineNumbers={true}
        />
    );
};
