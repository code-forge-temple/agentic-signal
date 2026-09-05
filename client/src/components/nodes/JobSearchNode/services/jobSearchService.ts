/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlBaseUrl} from "../../../../utils";
import {JobSearchOutput} from "../types/output.types";


export type JobSearchConfig = {
    companies: string;
    seedCompanies: string[];
    keywords: string;
    remoteOnly: boolean;
    employmentTypes: string[];
    datePosted: string;
    seniority: string;
    candidateRegion: string;
    filterByEligibility: boolean;
    maxCompanies: number;
    resultsLimit: number;
};

export class JobSearchService {
    static async search (config: JobSearchConfig): Promise<JobSearchOutput> {
        const response = await fetch(graphqlBaseUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query SearchJobs($config: String!) {
                        searchJobs(config: $config)
                    }
                `,
                variables: {config: JSON.stringify(config)},
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const {data, errors} = await response.json();

        if (errors?.length) {
            throw new Error(errors.map((e: {message: string}) => e.message).join("\n"));
        }

        if (!data?.searchJobs) {
            throw new Error("No response from job search backend");
        }

        return JSON.parse(data.searchJobs) as JobSearchOutput;
    }
}
