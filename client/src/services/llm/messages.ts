/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Message} from "./types";

/** `content` without the images inlined in it as base64 data URLs, and those images' data. */
export function extractImagesAndRemove (content: string): { content: string, images: string[] } {
    const imageRegex = /!\[.*?\]\(data:image\/\w+;base64,([^)]+)\)/g;
    const images: string[] = [];
    let match;
    let cleaned = content;

    while ((match = imageRegex.exec(content)) !== null) {
        images.push(match[1]);
    }

    cleaned = cleaned.replace(imageRegex, "");

    return {content: cleaned, images};
}

/**
 * A message as a request carries it: text content (anything else as JSON), with the images inlined in it moved to
 * `images`. A provider turns `images` into its server's form.
 */
export function toModelMessage (message: Message): Message {
    if (typeof message.content !== "string") {
        return {
            ...message,
            content: JSON.stringify(message.content),
            images: []
        };
    }

    const {content, images} = extractImagesAndRemove(message.content);

    return {
        ...message,
        content,
        images
    };
}
