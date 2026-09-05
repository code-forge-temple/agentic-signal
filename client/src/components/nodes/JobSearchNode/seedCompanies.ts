/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import seedCompaniesJson from "./data/seed-companies.json";

export type SeedCompany = { ats: string; token: string };

/**
 * Mirrors `server/nodes/JobSearchNode/data/seed-companies.json` so the settings
 * UI can render/search the built-in list without a round trip. Keep the two in
 * sync if the seed is ever regenerated.
 */
export const SEED_COMPANIES: SeedCompany[] = seedCompaniesJson as SeedCompany[];

export const seedKeyOf = (c: SeedCompany): string => `${c.ats}:${c.token}`;

export const ALL_SEED_KEYS: string[] = SEED_COMPANIES.map(seedKeyOf);
