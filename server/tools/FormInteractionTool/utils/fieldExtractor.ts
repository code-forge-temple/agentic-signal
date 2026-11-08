/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Page} from "npm:playwright";
import {FormInteractionButton, FormInteractionField} from "../types.ts";


/*
 * The functions down to evaluateWith run inside the page. page.evaluate sends one function's source and nothing it refers
 * to, so evaluateWith sends the helpers along as source too: each may call the others, and nothing outside them.
 */

// checkVisibility() walks the ancestor chain, so a field in a hidden step of a multi-step form isn't visible;
// getComputedStyle only reflects the element's own styles, so it's the fallback for browsers without it.
function isVisible (el: Element): boolean {
    const element = el as HTMLElement & {checkVisibility?: (options: object) => boolean};

    if (typeof element.checkVisibility === "function") return element.checkVisibility({visibilityProperty: true});

    return element.offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden";
}

// A selector that finds exactly this element: its id, its tag and name, or its position among the page's elements that
// match those (Playwright's `>> nth=`, counted over the whole page, unlike CSS's :nth-child and :nth-of-type).
function selectorOf (el: Element): string {
    if (el.id) return `#${CSS.escape(el.id)}`;

    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    const base = name ? `${tag}[name="${CSS.escape(name)}"]` : tag;
    const matches = Array.from(document.querySelectorAll(base));

    return matches.length === 1 ? base : `${base} >> nth=${matches.indexOf(el)}`;
}

function labelElementFor (el: Element): HTMLElement | null {
    return el.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`) : null;
}

function ariaLabelOf (el: Element): string {
    const labelledBy = el.getAttribute("aria-labelledby");

    return el.getAttribute("aria-label")?.trim() || (labelledBy ? document.getElementById(labelledBy)?.innerText?.trim() ?? "" : "");
}

// A <label> in the ancestor that isn't the field's own, or the ancestor's loose text.
function labelIn (ancestor: Element, el: Element): string {
    const label = ancestor.querySelector("label");

    if (label && !label.contains(el)) return label.innerText.trim();

    return Array.from(ancestor.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ")
        .trim();
}

// Up to four levels up.
function nearbyLabelOf (el: Element): string {
    let ancestor = el.parentElement;

    for (let depth = 0; depth < 4 && ancestor; depth++, ancestor = ancestor.parentElement) {
        const label = labelIn(ancestor, el);

        if (label) return label;
    }

    return "";
}

function labelOf (el: Element): string {
    const input = el as HTMLInputElement;
    const described = labelElementFor(el)?.innerText.trim() || ariaLabelOf(el) || input.placeholder?.trim();
    const found = described || nearbyLabelOf(el);

    return found || input.name || el.id || "";
}

function fieldTypeOf (el: Element): string {
    return el.getAttribute("contenteditable") === "true" ? "contenteditable" : (el as HTMLInputElement).type ?? el.tagName.toLowerCase();
}

function optionsOf (el: Element): string[] | undefined {
    if (!(el instanceof HTMLSelectElement)) return undefined;

    const options = Array.from(el.options).filter(option => option.value && option.text.trim()).map(option => option.text.trim());

    return options.length > 0 ? options : undefined;
}

// A checkbox's value is always "on", so it's reported only when checked; a radio's, only for the selected one.
function currentValueOf (el: Element, type: string): string | undefined {
    const input = el as HTMLInputElement;

    if (type === "contenteditable") return (el as HTMLElement).innerText?.trim() || undefined;

    if (type === "checkbox") return input.checked ? "on" : undefined;

    if (type === "radio") return input.checked ? input.value : undefined;

    return input.value || undefined;
}

// Each radio button is a field of its own, so the LLM gets every option's exact selector instead of guessing one for
// the group.
function fieldOf (el: Element): FormInteractionField | null {
    const type = fieldTypeOf(el);

    if (!isVisible(el) || ["hidden", "submit", "button", "reset", "image"].includes(type)) return null;

    const input = el as HTMLInputElement;

    return {
        label: labelOf(el).substring(0, 120),
        name: (input.name || el.id || "").substring(0, 120),
        type,
        selector: selectorOf(el),
        required: input.required || el.getAttribute("aria-required") === "true" || false,
        options: optionsOf(el),
        currentValue: currentValueOf(el, type),
        placeholder: input.placeholder || el.getAttribute("placeholder") || undefined,
    };
}

function readFormFields (): FormInteractionField[] {
    return Array.from(document.querySelectorAll('input, select, textarea, [contenteditable="true"]'))
        .map(fieldOf)
        .filter((field): field is FormInteractionField => field !== null);
}

function buttonOf (el: Element): FormInteractionButton | null {
    if (!isVisible(el) || (el as HTMLButtonElement).disabled) return null;

    const text = el.tagName.toLowerCase() === "button" ? (el as HTMLElement).innerText?.trim() : (el as HTMLInputElement).value?.trim();
    const label = text || el.getAttribute("aria-label")?.trim() || "";

    return {label: label.substring(0, 120) || "(unlabeled)", selector: selectorOf(el)};
}

function readActionButtons (): FormInteractionButton[] {
    return Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]'))
        .map(buttonOf)
        .filter((button): button is FormInteractionButton => button !== null);
}

function withoutStar (el: HTMLElement | null): string {
    return el?.innerText?.replace("*", "").trim() ?? "";
}

function missingFieldName (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null {
    const filled = el.type === "checkbox" ? (el as HTMLInputElement).checked : el.value.trim() !== "";

    if (!isVisible(el) || filled) return null;

    return withoutStar(labelElementFor(el)) || el.name || el.id || "unknown";
}

function missingRichTextName (el: HTMLElement): string | null {
    if (!isVisible(el) || el.innerText?.trim()) return null;

    const labelledBy = el.getAttribute("aria-labelledby");
    const labelled = withoutStar(labelElementFor(el)) || withoutStar(labelledBy ? document.getElementById(labelledBy) : null);

    return labelled || el.getAttribute("aria-label") || el.id || "Rich text field";
}

// Hidden steps of a multi-step form don't block the step on screen.
function readMissingRequired (): string[] {
    const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input[required], select[required], textarea[required]"
    )).map(missingFieldName);
    const richText = Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"][aria-required="true"]')).map(missingRichTextName);

    return [...fields, ...richText].filter((name): name is string => name !== null);
}

type InPage = (...args: never[]) => unknown;

const evaluateWith = async <T> (page: Page, main: () => T, helpers: InPage[]): Promise<T> =>
    await page.evaluate<T>(`(() => {\n${helpers.map(String).join("\n")}\nreturn (${String(main)})();\n})()`);

const LABEL_HELPERS = [labelElementFor, ariaLabelOf, labelIn, nearbyLabelOf, labelOf];

/** The labels (or names) of the visible required fields still empty; none means the form can be submitted. */
export async function checkEmptyRequiredFields (page: Page): Promise<string[]> {
    return await evaluateWith(page, readMissingRequired, [isVisible, labelElementFor, withoutStar, missingFieldName, missingRichTextName]);
}

/** Every visible, interactive form field on the page. */
export async function extractFormFields (page: Page): Promise<FormInteractionField[]> {
    return await evaluateWith(page, readFormFields, [isVisible, selectorOf, ...LABEL_HELPERS, fieldTypeOf, optionsOf, currentValueOf, fieldOf]);
}

/** Every visible, enabled clickable control on the page: buttons and submit / button / reset inputs. */
export async function extractActionButtons (page: Page): Promise<FormInteractionButton[]> {
    return await evaluateWith(page, readActionButtons, [isVisible, selectorOf, buttonOf]);
}
