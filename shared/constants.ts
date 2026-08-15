export const BACKEND_PORT = 8000;

export const TRIPLE_BACKTICK = "```";

export const IMAGE_FILE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"]);

/** Extensions that must be read as binary (base64) rather than UTF-8 text. */
export const BINARY_FILE_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "gz", "rar", "tar", "7z"]);

export const CODE_BLOCK_LANG_BY_EXTENSION: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    xml: "xml",
    csv: "csv",
    yaml: "yaml",
    yml: "yaml",
    ini: "ini",
    sh: "bash",
    sql: "sql",
    py: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    bat: "bat",
    txt: "text",
    log: "text",
    env: "text"
};

export const SUPPORTED_FILE_EXTENSIONS = new Set([
    ...Object.keys(CODE_BLOCK_LANG_BY_EXTENSION),
    ...IMAGE_FILE_EXTENSIONS,
    ...BINARY_FILE_EXTENSIONS,
]);