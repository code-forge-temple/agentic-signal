/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/theme-terminal";
import "ace-builds/src-noconflict/mode-html";

type CodeEditorProps = {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    mode?: "json" | "javascript" | "markdown" | "html";
    height?: string;
    width?: string;
    showLineNumbers?: boolean;
};

export function CodeEditor ({
    value = "",
    onChange,
    placeholder = "",
    readOnly = false,
    mode = "json",
    height = "500px",
    width = "100%",
    showLineNumbers = false
}: CodeEditorProps) {
    return (
        <AceEditor
            placeholder={placeholder}
            mode={mode}
            theme="terminal"
            fontSize={14}
            lineHeight={19}
            showPrintMargin={true}
            showGutter={true}
            highlightActiveLine={true}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            width={width}
            height={height}
            setOptions={{
                enableBasicAutocompletion: false,
                enableLiveAutocompletion: false,
                enableSnippets: false,
                enableMobileMenu: true,
                showLineNumbers,
                tabSize: 4,
                useWorker: false,
            }}
        />
    );
}