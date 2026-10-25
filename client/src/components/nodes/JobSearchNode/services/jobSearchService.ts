/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlRequest} from "../../../../utils";
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
        const data = await graphqlRequest<{ searchJobs: string | null }>(
            /* GraphQL */ `
                query SearchJobs($config: String!) {
                    searchJobs(config: $config)
                }
            `,
            {config: JSON.stringify(config)}
        );

        if (!data.searchJobs) {
            throw new Error("No response from job search backend");
        }

        return JSON.parse(data.searchJobs) as JobSearchOutput;
    }
}
