/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeDescriptor} from "../types";
import {JobSearchNode as component} from "./JobSearchNode";
import {Icon, NODE_TYPE, TITLE} from "./constants";
import {assertIsJobSearchNodeData, JobSearchNode, JobSearchNodeDataSchema} from "./types/workflow";
import {JobSearchNodeInputSchema} from "./types/input.types";
import {JobSearchOutputSchema} from "./types/output.types";
import {ALL_SEED_KEYS} from "./seedCompanies";
import {NodeEnvelopeSchema} from "../../../types/workflow";
import {NODE_PORT_IDS} from '../../../constants';


export const JobSearchNodeDescriptor: NodeDescriptor<typeof NODE_TYPE, JobSearchNode> = {
    type: NODE_TYPE,
    order: 6,
    component,
    icon: Icon,
    title: TITLE,
    assertion: assertIsJobSearchNodeData,
    metadata: {
        // eslint-disable-next-line max-len
        description: "Pulls job postings straight from company ATS boards (Greenhouse, Lever, Ashby, Workable) for a list of companies you choose, plus a selectable built-in ~138-company starter set. No API key. Returns a normalized, de-duplicated list where every job has a direct `applyUrl` to the employer's application form. It does NOT search the whole market — only the companies listed. Filters (keywords, remote, employment type, date, seniority) run locally. Pairs well with a downstream LLM Process node that screens or ranks the postings.",
        ports: {
            [NODE_PORT_IDS.FLOW]: {
                inputSchema: NodeEnvelopeSchema.extend({
                    payload: JobSearchNodeInputSchema.optional().describe("Optional upstream override for companies / keywords / candidate region."),
                }),
                outputSchema: NodeEnvelopeSchema.extend({
                    payload: JobSearchOutputSchema.describe("Normalized, de-duplicated postings with direct apply links, plus counts and per-company errors."),
                }),
            },
            [NODE_PORT_IDS.TRIGGER]: true,
        },
        configSchema: JobSearchNodeDataSchema,
    },
    defaultData: {
        title: TITLE,
        companies: "",
        seedCompanies: ALL_SEED_KEYS,
        keywords: "",
        remoteOnly: true,
        employmentTypes: [],
        datePosted: "month",
        seniority: "any",
        candidateRegion: "",
        filterByEligibility: false,
        maxCompanies: 60,
        resultsLimit: 100,
        dataProvidedByUpstream: false,
        toSanitize: ["input"],
    }
};
