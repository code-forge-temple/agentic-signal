/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useMemo, FC, useState, useEffect, Suspense} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {oneDark} from "react-syntax-highlighter/dist/esm/styles/prism";
import {CircularProgress, Box} from "@mui/material";
import "./MarkdownRenderer.scss";

interface MarkdownRendererProps {
    content: string;
}

const LoadingSpinner = () => (
    <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        className="markdown-renderer"
    >
        <CircularProgress size={40} />
    </Box>
);

const LazyMarkdownContent = React.memo(({content}: {content: string}) => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // We need to allow the UI to render the loading state first
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    const components = useMemo(() => ({
        pre: PreBlock,
        code: CodeBlock,
        a: LinkRenderer
    }), []);

    if (!isReady) {
        return <LoadingSpinner />;
    }

    return (
        <ReactMarkdown
            className="markdown-renderer"
            children={content}
            remarkPlugins={[remarkGfm]}
            urlTransform={(url: string) =>
                url.startsWith("data:") ? url : url
            }
            components={components}
        />
    );
});

const CodeBlock: FC<any> = React.memo(({inline, className, children, ...props}) => {
    const codeString = useMemo(() => String(children).replace(/\n$/, ""), [children]);
    const match = /language-(\w+)/.exec(className || "");

    if (!inline && match) {
        return (
            <div className="code-wrapper">
                <Suspense fallback={<LoadingSpinner />}>
                    <SyntaxHighlighter style={oneDark} language={match[1]} {...props}>
                        {codeString}
                    </SyntaxHighlighter>
                </Suspense>
            </div>
        );
    }

    return <code className={className} {...props}>{children}</code>;
});

const LinkRenderer: FC<any> = React.memo(({href, children, ...props}) => {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
        </a>
    );
});

const PreBlock: FC<any> = React.memo(({children, ...props}) => <div {...props}>{children}</div>);

export const MarkdownRenderer = React.memo(({content}: MarkdownRendererProps) => {

    return (
        <Suspense fallback={<LoadingSpinner />}>
            <LazyMarkdownContent content={content} />
        </Suspense>
    );
});