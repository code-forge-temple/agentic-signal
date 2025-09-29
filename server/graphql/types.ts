/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {DuckDuckGoResult, BraveResult, DuckDuckGoSearchArgs, BraveSearchArgs} from '../../shared/types/search.ts';
import {EmailResult, EmailSearchArgs} from '../../shared/types/email.ts';
import {CloudStorageFileResult, CloudStorageFileSearchArgs} from '../../shared/types/cloudStorage.ts';
import {CalendarEventResult, CalendarEventSearchArgs} from '../../shared/types/calendar.ts';
import {TimezoneResult} from '../../shared/types/timezone.ts';

export type {
    DuckDuckGoResult,
    BraveResult,
    DuckDuckGoSearchArgs,
    BraveSearchArgs,
    EmailResult,
    EmailSearchArgs,
    CloudStorageFileResult,
    CloudStorageFileSearchArgs,
    CalendarEventResult,
    CalendarEventSearchArgs,
    TimezoneResult
};

export interface GraphQLContext {
    services: {
        fetchRenderedHtml: (url: string, browserPath?: string) => Promise<string>;
        fetchDuckDuckGoResults: (query: string, browserPath?: string) => Promise<DuckDuckGoResult[]>;
        fetchGmailEmails: (args: EmailSearchArgs) => Promise<EmailResult[]>;
        fetchGdriveFiles: (args: CloudStorageFileSearchArgs) => Promise<CloudStorageFileResult[]>;
        fetchGcalendarEvents: (args: CalendarEventSearchArgs) => Promise<CalendarEventResult[]>;
        getTimezoneForCity: (city: string) => Promise<TimezoneResult>;
    };
    request?: Request;
}