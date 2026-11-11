/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Page} from "npm:playwright";
import {FormInteractionArgs, FormInteractionResult} from "./types.ts";
import {ACTION_TIMEOUT_MS, executeAction} from "./utils/actionExecutor.ts";
import {checkEmptyRequiredFields, extractActionButtons, extractFormFields} from "./utils/fieldExtractor.ts";
import {cleanupTempDir, writeTempFiles} from "./utils/fileUtils.ts";
import {closeSession, getOrCreateSession} from "./utils/sessionManager.ts";
import {devLog} from "../../utils/logger.ts";
import {withTimeout} from "./utils/withTimeout.ts";
import {disguisedLaunchOptions, disguisePage} from "../../utils/browserUtils.ts";
import {errorMessage} from "../../../shared/utils.ts";

const NAV_TIMEOUT_MS = 20_000;

/** The form's page: the session's, still on the step the last call left it on, or a new browser on the form. */
async function openFormPage (sessionKey: string, url: string, browserPath?: string): Promise<Page> {
    const {page, isNew} = await getOrCreateSession(sessionKey, disguisedLaunchOptions(browserPath));

    devLog(`[FormInteraction] ${isNew ? "browser launched" : "reusing existing session"}`);

    if (isNew) {
        await disguisePage(page);

        // --- Navigate (only for a brand-new session — a reused session is
        // already sitting on whatever page/step the previous call left it on). ---
        await page.goto(url, {waitUntil: "load", timeout: NAV_TIMEOUT_MS});
    }

    return page;
}

/** Human-like pause between form field interactions: none at typingDelay 0, otherwise ±20% jitter around it. */
async function pauseAfterAction (typingDelay: number): Promise<void> {
    if (typingDelay <= 0) return;

    const jitter = 0.8 + Math.random() * 0.4;

    await new Promise<void>((r) => setTimeout(r, typingDelay * 1_000 * jitter));
}

/** Runs the actions in order; a failed one is noted and the rest still run. Returns the failures. */
async function runActions (page: Page, {actions = [], typingDelay}: FormInteractionArgs, attachedFilePathMap: Record<string, string>): Promise<string[]> {
    const failedActions: string[] = [];

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const valuePreview = action.value !== undefined ? ` = "${String(action.value).substring(0, 40)}"` : "";

        devLog(`[FormInteraction] [${i + 1}/${actions.length}] ${action.actionType} → ${action.selector}${valuePreview}`);

        await executeAction(page, action, attachedFilePathMap, typingDelay).catch((err) => {
            const msg = errorMessage(err);

            console.warn(`[FormInteraction] [${i + 1}/${actions.length}] ✗ ${action.actionType} → ${action.selector}: ${msg}`);
            failedActions.push(`${action.actionType} ${action.selector}: ${msg}`);
        });

        await pauseAfterAction(typingDelay);
    }

    return failedActions;
}

/**
 * What keeps the form from the state the LLM asked for: required fields still empty (when it's about to submit) and
 * actions that failed. Empty when nothing does.
 */
async function fillProblems (page: Page, submitSelector: string | undefined, failedActions: string[]): Promise<string[]> {
    const emptyRequired = submitSelector ? await checkEmptyRequiredFields(page) : [];
    const problems: string[] = [];

    if (emptyRequired.length > 0) {
        problems.push(`required fields are still empty: [${emptyRequired.join(", ")}]`);
    }

    if (failedActions.length > 0) {
        problems.push(`${failedActions.length} action(s) failed: [${failedActions.join("; ")}]`);
    }

    return problems;
}

/** The fields and buttons the page shows now. */
async function readPage (page: Page, result: FormInteractionResult): Promise<void> {
    result.formFields = await extractFormFields(page);
    result.actionButtons = await extractActionButtons(page);
}

/**
 * The call fails with the problems, and with the page's current fields and buttons alongside the error, so the LLM
 * sees the selectors and labels instead of just a bare error string when it retries.
 */
async function reportProblems (page: Page, result: FormInteractionResult, {submitSelector, toolName}: FormInteractionArgs, problems: string[]): Promise<void> {
    await readPage(page, result);
    // eslint-disable-next-line max-len
    result.error = `${submitSelector ? "Submit blocked" : "Fill incomplete"} — ${problems.join("; and ")}. The session for this form stays open between calls — call ${toolName} again with fixes for just the fields listed above (using the selectors in formFields), then retry${submitSelector ? " submitSelector" : ""}.`;
    result.success = false;
    console.warn(`[FormInteraction] ✗ blocked — ${problems.join("; ")}`);
}

/**
 * Clicks the submit (or next) control and waits for the page to settle. Null when the selector matches nothing (the
 * result then says so); otherwise whether the control got disabled by the click.
 */
async function clickSubmit (page: Page, submitSelector: string, result: FormInteractionResult): Promise<{disabledAfterClick: boolean} | null> {
    const submitLocator = page.locator(submitSelector);
    const matchCount = await submitLocator.count();

    devLog(`[FormInteraction] submitSelector "${submitSelector}" matched ${matchCount} element(s)`);

    if (matchCount === 0) {
        await readPage(page, result);
        result.error = `submitSelector "${submitSelector}" did not match any element on the page. Check the selector against the current formFields or actionButtons.`;
        result.success = false;
        console.warn(`[FormInteraction] ✗ submitSelector not found: "${submitSelector}"`);

        return null;
    }

    const urlBeforeClick = page.url();
    const selectorsBeforeClick = (await extractFormFields(page)).map((f) => f.selector).join(",");

    await submitLocator.first().click({timeout: ACTION_TIMEOUT_MS});

    devLog(`[FormInteraction] clicked "${submitSelector}"`);

    // Wait for the resulting page to settle.
    await page
        .waitForLoadState("load", {timeout: NAV_TIMEOUT_MS})
        .catch(() => {});

    result.submitted = true;
    result.currentUrl = page.url();
    result.pageTitle = await page.title();

    // For an SPA, currentUrl never changes on a real "page" transition — the field
    // set is the only reliable signal that the click actually did anything.
    const selectorsAfterClick = (await extractFormFields(page)).map((f) => f.selector).join(",");

    devLog(
        `[FormInteraction] after click — url ${urlBeforeClick === result.currentUrl ? "unchanged" : "changed"}, ` +
        `visible fields ${selectorsBeforeClick === selectorsAfterClick ? "UNCHANGED (click likely had no effect)" : "changed"}`
    );

    // Many forms disable/relabel the submit control after a successful, final
    // submission (to prevent double-submits) without actually removing the
    // fields from the DOM — that's as strong a "done" signal as an empty page.
    return {disabledAfterClick: await submitLocator.first().isDisabled().catch(() => false)};
}

/** One call on the form: open its page, run the actions, submit when asked, and read the page that results. */
async function fillForm (args: FormInteractionArgs, sessionKey: string, attachedFilePathMap: Record<string, string>, result: FormInteractionResult): Promise<void> {
    const page = await openFormPage(sessionKey, args.url, args.browserPath);

    result.currentUrl = page.url();
    result.pageTitle = await page.title();

    devLog(`[FormInteraction] on → "${result.currentUrl}" ("${result.pageTitle}")`);

    const failedActions = await runActions(page, args, attachedFilePathMap);
    // Guard: refuse to submit if required fields are still empty, and treat any
    // failed fill/select/check action as an error too — both mean the form isn't
    // in the state the LLM asked for, and it should retry with corrected actions.
    const problems = await fillProblems(page, args.submitSelector, failedActions);

    if (problems.length > 0) return reportProblems(page, result, args, problems);

    const submit = args.submitSelector ? await clickSubmit(page, args.submitSelector, result) : {disabledAfterClick: false};

    if (!submit) return;

    // --- Extract form fields and clickable controls from the current (possibly new) page ---
    await readPage(page, result);
    result.success = true;

    devLog(`[FormInteraction] ✓ done — extracted ${result.formFields.length} field(s), ${result.actionButtons.length} button(s)`);

    // Either no fields left, or the submit control itself got disabled — both
    // strongly suggest a final confirmation/"thank you" state, so free the browser
    // instead of waiting out the idle timeout.
    if (result.submitted && (result.formFields.length === 0 || submit.disabledAfterClick)) {
        devLog("[FormInteraction] form appears complete — closing session");

        await closeSession(sessionKey);
    }
}

export async function interactWithForm (args: FormInteractionArgs): Promise<FormInteractionResult> {
    const {url, actions = [], attachedFiles = [], interactionTimeoutSeconds, sessionId} = args;
    const interactionTimeoutMs = interactionTimeoutSeconds * 1_000;

    devLog(`[FormInteraction] ▶ start  url="${url}"  actions=${actions.length}  attachedFiles=${attachedFiles.length}`);

    const result: FormInteractionResult = {
        success: false,
        currentUrl: url,
        pageTitle: "",
        submitted: false,
        formFields: [],
        actionButtons: [],
    };

    // Unique temp dir for this run — holds binary files forwarded from the client.
    // Deleted unconditionally in the finally block even if Playwright throws.
    let tempDir: string | undefined;
    let attachedFilePathMap: Record<string, string> = {};

    // Sessions are keyed by sessionId + form URL: the LLM is instructed to pass the same `url`
    // on every call for a given form, so reusing the page here (instead of relaunching a fresh
    // browser every call) lets client-side-routed multi-page forms keep their in-page navigation
    // state across separate tool invocations. sessionId scopes this to a single run so two
    // concurrent runs targeting the same URL (e.g. the same workflow launched from two tabs)
    // don't collide on the same browser session.
    const sessionKey = `${sessionId}:${url}`;

    try {
        // Write all forwarded binary files to an isolated temp directory.
        if (attachedFiles.length > 0) {
            ({tempDir, pathMap: attachedFilePathMap} = await writeTempFiles(attachedFiles));
        }

        await withTimeout(
            fillForm(args, sessionKey, attachedFilePathMap, result),
            interactionTimeoutMs,
            `Form interaction timed out after ${interactionTimeoutMs / 1000}s`
        );
    } catch (error) {
        const message = errorMessage(error);

        console.error(`[FormInteraction] ✗ error: ${message}`);
        result.error = `Form interaction failed: ${message}`;
        result.success = false;

        // The session may be in a broken/unknown state (crashed page, hung navigation) —
        // drop it so the next call starts clean rather than repeatedly hitting the same fault.
        await closeSession(sessionKey);
    } finally {
        // Always clean up the temp directory regardless of success or failure.
        await cleanupTempDir(tempDir);
    }

    return result;
}
