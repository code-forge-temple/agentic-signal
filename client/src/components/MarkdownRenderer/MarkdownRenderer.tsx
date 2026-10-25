/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useMemo, useState, useEffect, Suspense, ReactNode, lazy, ComponentProps, ComponentPropsWithoutRef, createContext, useContext} from "react";
import ReactMarkdown, {ExtraProps} from "react-markdown";
import remarkGfm from "remark-gfm";
import {CircularProgress, Box} from "@mui/material";
import "./MarkdownRenderer.scss";


const LazySyntaxHighlighter = lazy(() =>
    Promise.all([
        import("react-syntax-highlighter"),
        import("react-syntax-highlighter/dist/esm/styles/prism")
    ]).then(([syntaxModule, styleModule]) => ({
        default: ({language, children, ...props}: { language?: string; children: string } & Record<string, unknown>) => {
            const SyntaxHighlighter = syntaxModule.Prism;
            const oneDark = styleModule.oneDark;

            return <SyntaxHighlighter style={oneDark} language={language} {...props}>{children}</SyntaxHighlighter>;
        }
    }))
);

interface MarkdownRendererProps {
    content: string;
    style?: React.CSSProperties;
    disableLoadingDelay?: boolean;
    codeBlockSuffix?: (codeBlock: string) => ReactNode;
}

const LoadingSpinner = () => (
    <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        className="markdown-renderer"
    >
        <CircularProgress size={25} />
    </Box>
);

type LazyMarkdownContentProps = {
    content: string;
    disableLoadingDelay?: boolean;
    codeBlockSuffix?: (codeBlock: string) => ReactNode;
};

const LazyMarkdownContent = React.memo(({content, disableLoadingDelay, codeBlockSuffix}: LazyMarkdownContentProps) => {
    const [isReady, setIsReady] = useState(disableLoadingDelay ?? false);

    useEffect(() => {
        if (disableLoadingDelay) return;

        // We need to allow the UI to render the loading state first
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, [disableLoadingDelay]);

    const components = useMemo(() => ({
        pre: PreBlock,
        code: (props: ComponentProps<"code"> & ExtraProps) => <CodeBlock {...props} codeBlockSuffix={codeBlockSuffix} />,
        a: LinkRenderer
    }), [codeBlockSuffix]);

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
}, (prev, next) => prev.content === next.content && prev.disableLoadingDelay === next.disableLoadingDelay && prev.codeBlockSuffix === next.codeBlockSuffix);

// react-markdown 9 no longer tells `code` whether it's inline. A fenced block's <code> is the one
// inside a <pre>, so PreBlock marks its contents as block code through this context.
const InCodeBlockContext = createContext(false);

type CodeBlockProps = ComponentProps<"code"> & ExtraProps & {
    codeBlockSuffix?: (codeBlock: string) => ReactNode;
};

const CodeBlock = React.memo(({className, children, codeBlockSuffix, ...props}: CodeBlockProps) => {
    const isBlock = useContext(InCodeBlockContext);
    const codeString = useMemo(() => String(children).replace(/\n$/, ""), [children]);
    const match = /language-(\w+)/.exec(className || "");

    // react-markdown's syntax-tree node, not a DOM attribute.
    delete props.node;

    if (isBlock) {
        const suffix = codeBlockSuffix ? codeBlockSuffix(codeString) : null;

        if (match) {
            return (
                <div className="code-wrapper">
                    <Suspense fallback={<LoadingSpinner />}>
                        <LazySyntaxHighlighter language={match[1]} {...props}>
                            {codeString}
                        </LazySyntaxHighlighter>
                    </Suspense>
                    {suffix}
                </div>
            );
        }

        if (suffix) {
            return (
                <div className="code-wrapper">
                    <code className={className} {...props}>{children}</code>
                    {suffix}
                </div>
            );
        }
    }

    return <code className={className} {...props}>{children}</code>;
});

const LinkRenderer = React.memo(({href, children, ...props}: ComponentProps<"a"> & ExtraProps) => {
    // react-markdown's syntax-tree node, not a DOM attribute.
    delete props.node;

    return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
        </a>
    );
});

// react-markdown hands this a <pre>'s props but it renders a <div>, so only the children carry over:
// with remark-gfm alone and no raw HTML, the rest is just react-markdown's `node`, which isn't a DOM attribute.
const PreBlock = React.memo(({children}: ComponentPropsWithoutRef<"pre"> & ExtraProps) => (
    <div><InCodeBlockContext.Provider value={true}>{children}</InCodeBlockContext.Provider></div>
));

export const MarkdownRenderer = React.memo(({content, style, disableLoadingDelay, codeBlockSuffix}: MarkdownRendererProps) => {
    return (
        <div style={style} className="markdown-renderer-container">
            <Suspense fallback={<LoadingSpinner />}>
                <LazyMarkdownContent content={content} disableLoadingDelay={disableLoadingDelay} codeBlockSuffix={codeBlockSuffix} />
            </Suspense>
        </div>
    );
});