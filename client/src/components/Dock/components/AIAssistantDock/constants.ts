import {ROLE} from "../../../../constants";

export type ChatMessage = {
    role: typeof ROLE.USER | typeof ROLE.ASSISTANT;
    content: string;
    thinking?: string;
};

export const AI_ASSISTANT_TITLE = "AI Buddy";