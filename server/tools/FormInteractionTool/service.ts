/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormInteractionArgs, FormInteractionResult} from "./types.ts";
import {ACTION_TIMEOUT_MS, executeAction} from "./utils/actionExecutor.ts";
import {checkEmptyRequiredFields, extractActionButtons, extractFormFields} from "./utils/fieldExtractor.ts";
import {cleanupTempDir, writeTempFiles} from "./utils/fileUtils.ts";
import {closeSession, getOrCreateSession} from "./utils/sessionManager.ts";

const NAV_TIMEOUT_MS = 20_000;

/** Rejects after `ms` if `promise` hasn't settled — guards against a hung page/action. */
function withTimeout<T> (promise: Promise<T>, ms: number, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export async function interactWithForm (args: FormInteractionArgs): Promise<FormInteractionResult> {
    const {url, actions = [], submitSelector, attachedFiles = [], typingDelay, browserPath, interactionTimeoutSeconds, sessionId, toolName} = args;
    const interactionTimeoutMs = interactionTimeoutSeconds * 1_000;

    console.log(`[FormInteraction] ▶ start  url="${url}"  actions=${actions.length}  attachedFiles=${attachedFiles.length}`);

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

        await withTimeout((async () => {
            const {page, isNew} = await getOrCreateSession(sessionKey, {
                headless: false,
                executablePath: browserPath || undefined,
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
            });

            console.log(`[FormInteraction] ${isNew ? "browser launched" : "reusing existing session"}`);

            if (isNew) {
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, "webdriver", {get: () => undefined});

                    // @ts-expect-error — inject chrome API stub present in real browsers
                    window.chrome = {runtime: {}};

                    Object.defineProperty(navigator, "plugins", {get: () => [1, 2, 3]});
                    Object.defineProperty(navigator, "languages", {get: () => ["en-US", "en"]});
                });

                await page.setExtraHTTPHeaders({"Accept-Language": "en-US,en;q=0.9"});
                await page.setViewportSize({width: 1280, height: 800});

                // --- Navigate (only for a brand-new session — a reused session is
                // already sitting on whatever page/step the previous call left it on). ---
                await page.goto(url, {waitUntil: "load", timeout: NAV_TIMEOUT_MS});
            }

            result.currentUrl = page.url();
            result.pageTitle = await page.title();
            console.log(`[FormInteraction] on → "${result.currentUrl}" ("${result.pageTitle}")`);

            // --- Execute fill actions ---
            const failedActions: string[] = [];

            for (let i = 0; i < actions.length; i++) {
                const action = actions[i];
                const valuePreview = action.value !== undefined ? ` = "${String(action.value).substring(0, 40)}"` : "";

                console.log(`[FormInteraction] [${i + 1}/${actions.length}] ${action.actionType} → ${action.selector}${valuePreview}`);

                await executeAction(page, action, attachedFilePathMap, typingDelay).catch((err) => {
                    const msg = err instanceof Error ? err.message : String(err);

                    console.warn(`[FormInteraction] [${i + 1}/${actions.length}] ✗ ${action.actionType} → ${action.selector}: ${msg}`);
                    failedActions.push(`${action.actionType} ${action.selector}: ${msg}`);
                });

                // Human-like pause between form field interactions.
                // At typingDelay=0 there is no pause; otherwise ±20% jitter around the set value.
                if (typingDelay > 0) {
                    const jitter = 0.8 + Math.random() * 0.4;

                    await new Promise<void>((r) => setTimeout(r, typingDelay * 1_000 * jitter));
                }
            }

            // Guard: refuse to submit if required fields are still empty, and treat any
            // failed fill/select/check action as an error too — both mean the form isn't
            // in the state the LLM asked for, and it should retry with corrected actions.
            const emptyRequired = submitSelector ? await checkEmptyRequiredFields(page) : [];

            if (emptyRequired.length > 0 || failedActions.length > 0) {
                const parts: string[] = [];

                if (emptyRequired.length > 0) {
                    parts.push(`required fields are still empty: [${emptyRequired.join(", ")}]`);
                }

                if (failedActions.length > 0) {
                    parts.push(`${failedActions.length} action(s) failed: [${failedActions.join("; ")}]`);
                }

                // formFields/actionButtons are attached alongside `error` so the LLM can see the
                // current selectors/labels instead of just a bare error string when it retries.
                result.formFields = await extractFormFields(page);
                result.actionButtons = await extractActionButtons(page);
                result.error =
                    `${submitSelector ? "Submit blocked" : "Fill incomplete"} — ${parts.join("; and ")}. ` +
                    `The session for this form stays open between calls — call ${toolName} again with ` +
                    `fixes for just the fields listed above (using the selectors in formFields), ` +
                    `then retry${submitSelector ? " submitSelector" : ""}.`;
                result.success = false;
                console.warn(`[FormInteraction] ✗ blocked — ${parts.join("; ")}`);

                return;
            }

            // --- Click submit / next button ---
            let submitDisabledAfterClick = false;

            if (submitSelector) {
                const submitLocator = page.locator(submitSelector);
                const matchCount = await submitLocator.count();

                console.log(`[FormInteraction] submitSelector "${submitSelector}" matched ${matchCount} element(s)`);

                if (matchCount === 0) {
                    result.formFields = await extractFormFields(page);
                    result.actionButtons = await extractActionButtons(page);
                    result.error = `submitSelector "${submitSelector}" did not match any element on the page. Check the selector against the current formFields or actionButtons.`;
                    result.success = false;
                    console.warn(`[FormInteraction] ✗ submitSelector not found: "${submitSelector}"`);

                    return;
                }

                const urlBeforeClick = page.url();
                const selectorsBeforeClick = (await extractFormFields(page)).map((f) => f.selector).join(",");

                await submitLocator.first().click({timeout: ACTION_TIMEOUT_MS});
                console.log(`[FormInteraction] clicked "${submitSelector}"`);

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

                console.log(
                    `[FormInteraction] after click — url ${urlBeforeClick === result.currentUrl ? "unchanged" : "changed"}, ` +
                    `visible fields ${selectorsBeforeClick === selectorsAfterClick ? "UNCHANGED (click likely had no effect)" : "changed"}`
                );

                // Many forms disable/relabel the submit control after a successful, final
                // submission (to prevent double-submits) without actually removing the
                // fields from the DOM — that's as strong a "done" signal as an empty page.
                submitDisabledAfterClick = await submitLocator.first().isDisabled().catch(() => false);
            }

            // --- Extract form fields and clickable controls from the current (possibly new) page ---
            result.formFields = await extractFormFields(page);
            result.actionButtons = await extractActionButtons(page);
            result.success = true;
            console.log(
                `[FormInteraction] ✓ done — extracted ${result.formFields.length} field(s), ` +
                `${result.actionButtons.length} button(s)`
            );

            // Either no fields left, or the submit control itself got disabled — both
            // strongly suggest a final confirmation/"thank you" state, so free the browser
            // instead of waiting out the idle timeout.
            if (result.submitted && (result.formFields.length === 0 || submitDisabledAfterClick)) {
                console.log("[FormInteraction] form appears complete — closing session");
                await closeSession(sessionKey);
            }
        })(), interactionTimeoutMs, `Form interaction timed out after ${interactionTimeoutMs / 1000}s`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

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
