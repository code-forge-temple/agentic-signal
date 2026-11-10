/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ALL_SEED_KEYS, SEED_COMPANIES, SeedCompany, seedKeyOf} from "../seedCompanies";


const SEED_BY_KEY = new Map(SEED_COMPANIES.map(company => [seedKeyOf(company), company]));
const ATS_LIST = ["greenhouse", "lever", "ashby", "workable"] as const;

/** Each ATS that has built-in companies, with their keys. */
export const SEED_GROUPS = ATS_LIST
    .map(ats => ({ats, keys: SEED_COMPANIES.filter(company => company.ats === ats).map(seedKeyOf)}))
    .filter(group => group.keys.length > 0);

/** The built-in companies the keys name; a key no longer in the list is skipped. */
export const seedCompaniesOf = (keys: string[]): SeedCompany[] =>
    keys.map(key => SEED_BY_KEY.get(key)).filter((company): company is SeedCompany => Boolean(company));

/** Whether every key of the group is chosen. A Set, built once by the caller for all the groups it checks. */
export const isGroupSelected = (chosen: ReadonlySet<string>, group: string[]): boolean => group.every(key => chosen.has(key));

/** A group of built-in companies: taken out when all of it is selected, else added in full. */
export const toggleGroup = (selected: string[], group: string[]): string[] => (isGroupSelected(new Set(selected), group)
    ? selected.filter(key => !group.includes(key))
    : [...new Set([...selected, ...group])]);

/** Every built-in company, or none when every one is selected already. */
export const toggleAll = (selected: string[]): string[] => (isGroupSelected(new Set(selected), ALL_SEED_KEYS) ? [] : ALL_SEED_KEYS);

/** The value added to the list, or taken out when it's there. */
export const toggle = <T, >(list: T[], value: T): T[] => (list.includes(value) ? list.filter(entry => entry !== value) : [...list, value]);
