/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useMemo, useState, useEffect, Suspense, ReactNode, lazy, ComponentProps, ComponentPropsWithoutRef, createContext, useContext, useDeferredValue} from "react";
import ReactMarkdown, {ExtraProps} from "react-markdown";
import remarkGfm from "remark-gfm";
import {CircularProgress, Box} from "@mui/material";
import "./MarkdownRenderer.scss";
import "./prismOneDark.scss";


const LazySyntaxHighlighter = lazy(() =>
    Promise.all([
        import("react-syntax-highlighter"),
        import("react-syntax-highlighter/dist/esm/styles/prism")
    ]).then(([syntaxModule, styleModule]) => ({
        default: ({language, children, ...props}: { language?: string; children: string } & Record<string, unknown>) => {
            const SyntaxHighlighter = syntaxModule.Prism;
            const oneDark = styleModule.oneDark;

            // Colours come from classes (prismOneDark.scss): with inline styles the highlighter scans the whole
            // theme for every token, seconds of work for a long workflow. The theme still styles the <code> tag.
            return <SyntaxHighlighter style={oneDark} useInlineStyles={false} language={language} {...props}>{children}</SyntaxHighlighter>;
        }
    }))
);

/** Draws a fenced code block itself, given its text and language, or returns undefined to leave it code. */
type CodeBlockRenderer = (codeBlock: string, language: string | undefined) => ReactNode | undefined;

interface MarkdownRendererProps {
    content: string;
    style?: React.CSSProperties;
    disableLoadingDelay?: boolean;
    codeBlockSuffix?: (codeBlock: string) => ReactNode;
    codeBlockRenderer?: CodeBlockRenderer;
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
};

const keepUrl = (url: string) => url;

// Re-parses only when the text changes: the code-block callbacks reach the blocks through context instead.
const LazyMarkdownContent = React.memo(({content, disableLoadingDelay}: LazyMarkdownContentProps) => {
    const [isReady, setIsReady] = useState(disableLoadingDelay ?? false);

    useEffect(() => {
        if (disableLoadingDelay) return;

        // We need to allow the UI to render the loading state first
        const timer = setTimeout(() => {
            setIsReady(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, [disableLoadingDelay]);

    if (!isReady) {
        return <LoadingSpinner />;
    }

    return (
        <ReactMarkdown
            className="markdown-renderer"
            children={content}
            remarkPlugins={REMARK_PLUGINS}
            urlTransform={keepUrl}
            components={MARKDOWN_COMPONENTS}
        />
    );
});

// react-markdown 9 no longer tells `code` whether it's inline. A fenced block's <code> is the one
// inside a <pre>, so PreBlock marks its contents as block code through this context.
const InCodeBlockContext = createContext(false);

type CodeBlockCallbacks = {
    codeBlockSuffix?: (codeBlock: string) => ReactNode;
    codeBlockRenderer?: CodeBlockRenderer;
};

// Through context rather than a `components` entry made per render: a new entry is a new component type, so
// React remounted, and re-highlighted, every code block whenever a callback changed.
const CodeBlockCallbacksContext = createContext<CodeBlockCallbacks>({});

// Longer blocks stay uncoloured: colouring and drawing every token of 50 KB of JSON took seconds.
const MAX_HIGHLIGHTED_CHARS = 20_000;

// The text uncoloured, in the theme's base colours (prismOneDark.scss).
const PlainCode = ({language, code}: {language: string; code: string}) => (
    <pre className="prismjs"><code className={`language-${language}`}>{code}</code></pre>
);

// Colouring depends on the text alone, so a block redrawn for a new suffix keeps it as it was. It runs as a
// deferred update: a new block shows at once as plain text, and while a reply streams in, a click or a key press
// is handled before the next colouring; until it's ready, the last one stays.
const HighlightedCode = React.memo(({language, code}: {language: string; code: string}) => {
    const deferredCode = useDeferredValue(code, "");

    const highlighted = useMemo(() => (deferredCode && deferredCode.length <= MAX_HIGHLIGHTED_CHARS ? (
        <Suspense fallback={<PlainCode language={language} code={deferredCode} />}>
            <LazySyntaxHighlighter language={language}>{deferredCode}</LazySyntaxHighlighter>
        </Suspense>
    ) : null), [language, deferredCode]);

    return highlighted && code.length <= MAX_HIGHLIGHTED_CHARS ? highlighted : <PlainCode language={language} code={code} />;
});

const CodeBlock = React.memo(({className, children, ...props}: ComponentProps<"code"> & ExtraProps) => {
    const isBlock = useContext(InCodeBlockContext);
    const {codeBlockSuffix, codeBlockRenderer} = useContext(CodeBlockCallbacksContext);
    const codeString = useMemo(() => String(children).replace(/\n$/, ""), [children]);
    const match = /language-(\w+)/.exec(className || "");

    // react-markdown's syntax-tree node, not a DOM attribute.
    delete props.node;

    if (isBlock) {
        const drawn = codeBlockRenderer?.(codeString, match?.[1]);

        if (drawn !== undefined) return <>{drawn}</>;

        const suffix = codeBlockSuffix ? codeBlockSuffix(codeString) : null;

        if (match) {
            return (
                <div className="code-wrapper">
                    <HighlightedCode language={match[1]} code={codeString} />
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

const MARKDOWN_COMPONENTS = {pre: PreBlock, code: CodeBlock, a: LinkRenderer};

const REMARK_PLUGINS = [remarkGfm];

export const MarkdownRenderer = React.memo(({content, style, disableLoadingDelay, codeBlockSuffix, codeBlockRenderer}: MarkdownRendererProps) => {
    const callbacks = useMemo(() => ({codeBlockSuffix, codeBlockRenderer}), [codeBlockSuffix, codeBlockRenderer]);

    return (
        <div style={style} className="markdown-renderer-container">
            <CodeBlockCallbacksContext.Provider value={callbacks}>
                <Suspense fallback={<LoadingSpinner />}>
                    <LazyMarkdownContent content={content} disableLoadingDelay={disableLoadingDelay} />
                </Suspense>
            </CodeBlockCallbacksContext.Provider>
        </div>
    );
});