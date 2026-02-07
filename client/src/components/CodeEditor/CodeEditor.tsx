/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-scss";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-xml";
import "ace-builds/src-noconflict/mode-csv";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/mode-ini";
import "ace-builds/src-noconflict/mode-sh";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-java";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-batchfile";
import "ace-builds/src-noconflict/theme-terminal";
import {AceEditorMode} from "./types";

type CodeEditorProps = {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    mode?: AceEditorMode;
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