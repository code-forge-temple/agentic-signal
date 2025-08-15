/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {searchResolvers} from './searchResolvers.ts';
import {browserResolvers} from './browserResolvers.ts';
import {emailResolvers} from './emailResolvers.ts'
import {cloudStorageResolvers} from './cloudStorageResolvers.ts';
import {calendarResolvers} from './calendarResolvers.ts';
import {timezoneResolvers} from './timezoneResolvers.ts';

export const resolvers = {
    Query: {
        ...searchResolvers,
        ...browserResolvers,
        ...emailResolvers,
        ...cloudStorageResolvers,
        ...calendarResolvers,
        ...timezoneResolvers,
    },
};