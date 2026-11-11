/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {attachedFilePath, unescaped} from "./actionExecutor.ts";
import {isAttachedFile} from "../types.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

function thrownMessage (run: () => unknown): string {
    try {
        run();
    } catch (error) {
        return (error as Error).message;
    }

    return "(nothing thrown)";
}

const FILES = {"cv.pdf": "/tmp/run-1/cv.pdf", "photo.png": "/tmp/run-1/photo.png"};

Deno.test("makes double-escaped newlines, returns and tabs real, and leaves real ones alone", () => {
    assertEquals(unescaped("one\\ntwo\\r\\nthree\\tfour"), "one\ntwo\r\nthree\tfour");
    assertEquals(unescaped("already\nreal\ttext"), "already\nreal\ttext");
});

Deno.test("finds an upload's file by its fileKey, or by its value when the model put the name there", () => {
    assertEquals(attachedFilePath({actionType: "upload", selector: "#cv", fileKey: "cv.pdf"}, FILES), "/tmp/run-1/cv.pdf");
    assertEquals(attachedFilePath({actionType: "upload", selector: "#cv", value: "photo.png"}, FILES), "/tmp/run-1/photo.png");
});

Deno.test("says what's wrong with an upload that names no file, or one that wasn't attached", () => {
    assertEquals(thrownMessage(() => attachedFilePath({actionType: "upload", selector: "#cv"}, FILES)), "Upload action requires a fileKey (one of the names in availableFiles).");
    assertEquals(
        thrownMessage(() => attachedFilePath({actionType: "upload", selector: "#cv", fileKey: "missing.pdf"}, FILES)),
        "Upload: no file found for key \"missing.pdf\". Attached files: [cv.pdf, photo.png]. Make sure the file is attached via the DataSourceNode with bypass-LLM mode enabled."
    );
    assertEquals(thrownMessage(() => attachedFilePath({actionType: "upload", selector: "#cv", fileKey: "cv.pdf"}, {})).includes("Attached files: [(none)]"), true);
});

Deno.test("recognises an attached file only when its name, contents and type are all text", () => {
    assertEquals(isAttachedFile({name: "cv.pdf", base64: "JVBERi0=", mimeType: "application/pdf"}), true);
    assertEquals(isAttachedFile({name: "cv.pdf", base64: "JVBERi0=", mimeType: "application/pdf", extra: 1}), true);

    for (const notAFile of [null, undefined, "cv.pdf", {name: "cv.pdf", base64: "JVBERi0="}, {name: "cv.pdf", base64: 42, mimeType: "application/pdf"}]) {
        assertEquals(isAttachedFile(notAFile), false);
    }
});
