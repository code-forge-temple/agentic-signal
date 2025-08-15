/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const TimezoneResultFields = {
    iso: "String!",
    locale: "String!",
    unix: "Int!",
    timezone: "String!",
    city: "String!",
    utc_offset: "String",
    error: "String"
};

export interface TimezoneResult {
    iso: string;
    locale: string;
    unix: number;
    timezone: string;
    city: string;
    utc_offset?: string;
    error?: string;
}