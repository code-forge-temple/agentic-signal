/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormInteractionButton, FormInteractionField} from "../types.ts";

/**
 * Returns the names/labels of required fields that are still empty.
 * An empty array means the form is ready to submit.
 */
export async function checkEmptyRequiredFields (page: any): Promise<string[]> {
    return page.evaluate((): string[] => {
        // getComputedStyle(el) only reflects the element's OWN display/visibility —
        // it does not account for an ancestor having display:none (e.g. a hidden page
        // of a multi-step form), so a field inside a hidden step still reads as visible.
        // checkVisibility() correctly walks the whole ancestor chain.
        const isVisible = (el: Element): boolean =>
            typeof (el as any).checkVisibility === "function"
                ? (el as any).checkVisibility({visibilityProperty: true})
                : (el as HTMLElement).offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden";

        const missing: string[] = [];

        document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            "input[required], select[required], textarea[required]"
        ).forEach((el) => {
            // Only validate visible fields — hidden pages of multi-step forms
            // must not block submission of the current page.
            if (!isVisible(el)) return;

            const isCheckbox = (el as HTMLInputElement).type === "checkbox";
            const isEmpty = isCheckbox
                ? !(el as HTMLInputElement).checked
                : !el.value.trim();

            if (isEmpty) {
                const lbl = el.id
                    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`)
                    : null;

                missing.push(lbl?.innerText?.replace("*", "").trim() || el.name || el.id || "unknown");
            }
        });

        // Also check contenteditable rich-text fields marked aria-required.
        document.querySelectorAll<HTMLElement>('[contenteditable="true"][aria-required="true"]').forEach((el) => {
            if (!isVisible(el)) return;

            if (!el.innerText?.trim()) {
                const lbl = el.id
                    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`)
                    : null;
                const labelledBy = el.getAttribute("aria-labelledby");
                const labelByRef = labelledBy ? document.getElementById(labelledBy) : null;

                missing.push(
                    lbl?.innerText?.replace("*", "").trim() ||
                    labelByRef?.innerText?.replace("*", "").trim() ||
                    el.getAttribute("aria-label") ||
                    el.id ||
                    "Rich text field"
                );
            }
        });

        return missing;
    });
}

/** Extracts all visible, interactive form fields from the current page. */
export async function extractFormFields (page: any): Promise<FormInteractionField[]> {
    const fields: FormInteractionField[] = await page.evaluate((): FormInteractionField[] => {
        // getComputedStyle(el) only reflects the element's OWN display/visibility —
        // it does not account for an ancestor having display:none (e.g. a hidden page
        // of a multi-step form), so a field inside a hidden step still reads as visible.
        // checkVisibility() correctly walks the whole ancestor chain.
        const isVisible = (el: Element): boolean =>
            typeof (el as any).checkVisibility === "function"
                ? (el as any).checkVisibility({visibilityProperty: true})
                : (el as HTMLElement).offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden";

        const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);
        const results: FormInteractionField[] = [];

        const inputs = Array.from(
            document.querySelectorAll('input, select, textarea, [contenteditable="true"]')
        ) as Element[];

        for (const el of inputs) {
            // Skip invisible elements.
            if (!isVisible(el) || (el as HTMLInputElement).type === "hidden") continue;

            const isContentEditable = el.getAttribute("contenteditable") === "true";
            const inputType = isContentEditable
                ? "contenteditable"
                : ((el as HTMLInputElement).type ?? el.tagName.toLowerCase());

            if (SKIP_TYPES.has(inputType)) continue;

            // Do NOT deduplicate radio buttons — return each one individually so
            // the LLM receives the exact selector for each option (#workOnsite,
            // #workHybrid, #workRemote) rather than a single group entry that
            // forces it to guess a combined selector.

            // --- Label resolution ---
            let label = "";

            if (el.id) {
                const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`);

                if (lbl) label = lbl.innerText.trim();
            }

            if (!label) {
                label =
                    el.getAttribute("aria-label")?.trim() ||
                    (el.getAttribute("aria-labelledby")
                        ? document.getElementById(el.getAttribute("aria-labelledby")!)?.innerText?.trim() ?? ""
                        : "") ||
                    (el as HTMLInputElement).placeholder?.trim() ||
                    "";
            }

            if (!label) {
                // Walk up a few levels looking for a <label> or visible text node.
                let ancestor: Element | null = el.parentElement;

                for (let depth = 0; depth < 4 && ancestor && !label; depth++) {
                    const lbl = ancestor.querySelector("label");

                    if (lbl && !lbl.contains(el)) {
                        label = lbl.innerText.trim();
                    } else {
                        const textNodes = Array.from(ancestor.childNodes)
                            .filter((n) => n.nodeType === Node.TEXT_NODE)
                            .map((n) => n.textContent?.trim() ?? "")
                            .filter(Boolean);

                        if (textNodes.length) label = textNodes.join(" ").trim();
                    }

                    ancestor = ancestor.parentElement;
                }
            }

            if (!label) label = (el as HTMLInputElement).name || el.id || "";

            // --- Selector building ---
            let selector = "";

            if (el.id) {
                selector = `#${CSS.escape(el.id)}`;
            } else if ((el as HTMLInputElement).name) {
                const tag = el.tagName.toLowerCase();
                const elName = (el as HTMLInputElement).name;
                const candidates = document.querySelectorAll(`${tag}[name="${elName}"]`);

                if (candidates.length === 1) {
                    selector = `${tag}[name="${elName}"]`;
                } else {
                    const idx = Array.from(candidates).indexOf(el as Element);

                    selector = `${tag}[name="${elName}"]:nth-of-type(${idx + 1})`;
                }
            } else {
                const tag = el.tagName.toLowerCase();
                const all = Array.from(document.querySelectorAll(tag));
                const idx = all.indexOf(el as Element);

                selector = `${tag}:nth-child(${idx + 1})`;
            }

            // --- Options for <select> ---
            let options: string[] | undefined;

            if (el instanceof HTMLSelectElement) {
                options = Array.from(el.options)
                    .filter((o) => o.value && o.text.trim())
                    .map((o) => o.text.trim());
            }

            // --- Current value (type-aware) ---
            // Checkboxes: use .checked, not .value (always "on").
            // Radio buttons: report value only when this specific radio is selected.
            // Everything else: .value as before.
            let currentValue: string | undefined;

            if (inputType === "contenteditable") {
                currentValue = (el as HTMLElement).innerText?.trim() || undefined;
            } else if (inputType === "checkbox") {
                currentValue = (el as HTMLInputElement).checked ? "on" : undefined;
            } else if (inputType === "radio") {
                currentValue = (el as HTMLInputElement).checked ? (el as HTMLInputElement).value : undefined;
            } else {
                currentValue = (el as HTMLInputElement).value || undefined;
            }

            results.push({
                label: label.substring(0, 120),
                name: ((el as HTMLInputElement).name || el.id || "").substring(0, 120),
                type: inputType,
                selector,
                required: (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || false,
                options: options?.length ? options : undefined,
                currentValue,
                placeholder: (el as HTMLInputElement).placeholder || el.getAttribute("placeholder") || undefined,
            });
        }

        return results;
    });

    return fields as FormInteractionField[];
}

/** Extracts all visible, enabled clickable controls (buttons, submit/reset inputs) from the current page. */
export async function extractActionButtons (page: any): Promise<FormInteractionButton[]> {
    const buttons: FormInteractionButton[] = await page.evaluate((): FormInteractionButton[] => {
        const isVisible = (el: Element): boolean =>
            typeof (el as any).checkVisibility === "function"
                ? (el as any).checkVisibility({visibilityProperty: true})
                : (el as HTMLElement).offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden";

        const results: FormInteractionButton[] = [];

        const controls = Array.from(
            document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]')
        ) as Element[];

        for (const el of controls) {
            if (!isVisible(el) || (el as HTMLButtonElement).disabled) continue;

            const label =
                (el.tagName.toLowerCase() === "button"
                    ? (el as HTMLElement).innerText?.trim()
                    : (el as HTMLInputElement).value?.trim()) ||
                el.getAttribute("aria-label")?.trim() ||
                "";

            let selector = "";

            if (el.id) {
                selector = `#${CSS.escape(el.id)}`;
            } else {
                const tag = el.tagName.toLowerCase();
                const all = Array.from(document.querySelectorAll(tag));
                const idx = all.indexOf(el as Element);

                selector = `${tag}:nth-of-type(${idx + 1})`;
            }

            results.push({label: label.substring(0, 120) || "(unlabeled)", selector});
        }

        return results;
    });

    return buttons;
}
