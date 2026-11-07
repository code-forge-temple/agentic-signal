/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/**
 * Copies `text`, rejecting if the browser won't. Browsers only offer navigator.clipboard on secure pages (https,
 * or localhost), so on the app opened over plain http from another computer this copies from a hidden field.
 */
export async function copyText (text: string): Promise<void> {
    if (typeof navigator.clipboard !== "undefined") {
        await navigator.clipboard.writeText(text);

        return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const field = document.createElement("textarea");

    field.value = text;
    field.setAttribute("readonly", "");
    Object.assign(field.style, {position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none"});
    // Beside what was clicked, so inside an open dialog: a dialog takes focus back from a field outside it.
    (previousFocus?.parentElement ?? document.body).appendChild(field);
    field.focus();
    field.select();

    try {
        // Deprecated, but the only way to copy on a page without the clipboard API.
        if (!document.execCommand("copy")) throw new Error("The browser didn't copy.");
    } finally {
        field.remove();
        previousFocus?.focus();
    }
}
