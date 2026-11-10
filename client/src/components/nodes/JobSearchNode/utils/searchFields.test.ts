/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {clampLimit, hasNoCompanies, searchFields, searchRequest} from './searchFields';


const own = {companies: 'greenhouse:stripe', keywords: 'developer', candidateRegion: 'EU'};

describe('searchFields', () => {
    it('takes the node\'s own fields when they are not provided by upstream', () => {
        expect(searchFields(own, {companies: 'lever:vercel'}, false)).toEqual(own);
    });

    it('takes each field the input gives when provided by upstream, and keeps the node\'s for the rest', () => {
        expect(searchFields(own, {companies: 'lever:vercel', keywords: '', candidateRegion: null}, true))
            .toEqual({companies: 'lever:vercel', keywords: 'developer', candidateRegion: 'EU'});
    });

    it('keeps the node\'s fields when the input is not an object', () => {
        expect(searchFields(own, 'text', true)).toEqual(own);
        expect(searchFields(own, undefined, true)).toEqual(own);
    });
});

describe('searchRequest', () => {
    it('gives the service the node\'s settings with this run\'s fields, and nothing else', () => {
        const data = {
            ...own, seedCompanies: ['lever:vercel'], remoteOnly: true, employmentTypes: ['full_time'], datePosted: 'week', seniority: 'senior',
            filterByEligibility: false, maxCompanies: 60, resultsLimit: 100, dataProvidedByUpstream: true, title: 'Job Search',
        } as unknown as Parameters<typeof searchRequest>[0];

        expect(searchRequest(data, {companies: 'ashby:linear', keywords: 'rust', candidateRegion: 'US'})).toEqual({
            companies: 'ashby:linear', keywords: 'rust', candidateRegion: 'US', seedCompanies: ['lever:vercel'], remoteOnly: true,
            employmentTypes: ['full_time'], datePosted: 'week', seniority: 'senior', filterByEligibility: false, maxCompanies: 60, resultsLimit: 100,
        });
    });
});

describe('hasNoCompanies', () => {
    it('is true only with no built-in company picked and none typed', () => {
        expect(hasNoCompanies([], '  ')).toBe(true);
        expect(hasNoCompanies([], 'stripe')).toBe(false);
        expect(hasNoCompanies(['lever:vercel'], '')).toBe(false);
    });
});

describe('clampLimit', () => {
    it('keeps a typed limit within its range', () => {
        expect(clampLimit('50', 1, 400, 60)).toBe(50);
        expect(clampLimit('999', 1, 400, 60)).toBe(400);
        expect(clampLimit('-5', 1, 400, 60)).toBe(1);
    });

    it('gives the fallback for text that is not a number, and for 0', () => {
        expect(clampLimit('', 1, 400, 60)).toBe(60);
        expect(clampLimit('abc', 1, 400, 60)).toBe(60);
        expect(clampLimit('0', 1, 400, 60)).toBe(60);
    });
});
