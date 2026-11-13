/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, beforeEach, describe, expect, it, Mock, vi} from 'vitest';
import {FetchWeatherDataToolDescriptor} from './descriptor';


const handler = FetchWeatherDataToolDescriptor.handlerFactory({apiKey: 'k3y'});

const PLACE = {name: 'Tokyo', region: 'Tokyo', country: 'Japan'};
const LOCATION = {...PLACE, localtime: '2026-11-12 19:00'};
const DAY_FIELDS = {maxtemp_c: 15, maxtemp_f: 59, mintemp_c: 8, mintemp_f: 46, condition: {text: 'Rain'}, avghumidity: 80, maxwind_kph: 20, maxwind_mph: 12};
const DAY = {...DAY_FIELDS, uv: 1};
const CURRENT = {temp_c: 10, temp_f: 50, condition: {text: 'Sunny'}, wind_kph: 5, wind_mph: 3, wind_dir: 'N', humidity: 70, feelslike_c: 9, feelslike_f: 48, uv: 2};
const ANSWER = {location: LOCATION, current: CURRENT, forecast: {forecastday: [{date: '2026-11-13', day: DAY}, {date: '2026-11-14', day: DAY}]}};

let fetchMock: Mock;

const answerWith = (status: number, body: unknown = ANSWER, statusText = '') =>
    fetchMock.mockResolvedValue({ok: status === 200, status, statusText, json: async () => body});

const requestedUrl = () => String(fetchMock.mock.calls[0][0]);

beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-11-12T10:00:00'));
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    answerWith(200);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('Fetch Weather Data tool', () => {
    it('needs an API key and a city', async () => {
        expect(await FetchWeatherDataToolDescriptor.handlerFactory({})({city: 'Tokyo'}))
            .toEqual({error: 'API key must be specified. Please set apiKey in the configuration.'});
        expect(await handler({city: '  '})).toEqual({error: '`city` tool parameter must be specified'});
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('asks for the current weather with no date, a word for none, and for today', async () => {
        for (const date of [undefined, '', '  ', 'today', 'Now', 'none', 'null', '2026-11-12', 'Nov 12, 2026']) {
            fetchMock.mockClear();

            const result: unknown = await handler({city: ' New York ', date});

            expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/current.json?key=k3y&q=New%20York');
            expect(result).toEqual({
                location: LOCATION,
                current: {...CURRENT, condition: 'Sunny'},
            });
        }
    });

    it('turns down a date it cannot read (an impossible day too), so the LLM can send another', async () => {
        // V8 would read "day 3", "week 2" and "+1" as days in 2001.
        for (const date of ['soon', '2026-13-45', '2026-11-31', '2026-11-131', 'tomorrow', 'day 3', 'week 2', '+1']) {
            expect(await handler({city: 'Tokyo', date})).toEqual({error: `\`date\` tool parameter "${date}" is not a date: send it as YYYY-MM-DD`});
        }

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the day it read, as YYYY-MM-DD, whatever form the date came in', async () => {
        await handler({city: 'Tokyo', date: 'Nov 13, 2026'});
        expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/forecast.json?key=k3y&q=Tokyo&dt=2026-11-13');
    });

    it('sends the day a YYYY-MM-DD names as written, a time and zone after it notwithstanding', async () => {
        // Midnight UTC is still the 14th west of UTC, and 23:00 UTC already the 16th east of it: the 15th is sent either way.
        for (const date of ['2026-11-15T00:00:00Z', '2026-11-15T23:00:00Z', '11/15/2026 23:30 UTC', 'Nov 15, 2026 23:00 GMT']) {
            fetchMock.mockClear();
            await handler({city: 'Tokyo', date});
            expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/forecast.json?key=k3y&q=Tokyo&dt=2026-11-15');
        }
    });

    it('asks for the forecast for a later day, with that day\'s fields', async () => {
        const result: unknown = await handler({city: 'Tokyo', date: '2026-11-13'});

        expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/forecast.json?key=k3y&q=Tokyo&dt=2026-11-13');
        expect(result).toEqual({location: LOCATION, forecast: {date: '2026-11-13', ...DAY, condition: 'Rain'}});
    });

    it('asks for the history of an earlier day, without the local time and the uv index', async () => {
        const result: unknown = await handler({city: 'Tokyo', date: '2026-11-11'});

        expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/history.json?key=k3y&q=Tokyo&dt=2026-11-11');
        expect(result).toEqual({location: PLACE, history: {date: '2026-11-13', ...DAY_FIELDS, condition: 'Rain'}});
    });

    it('gives a null day when the answer has none, and leaves out what the answer leaves out', async () => {
        answerWith(200, {forecast: {forecastday: []}});

        expect(await handler({city: 'Tokyo', date: '2026-11-13'})).toEqual({location: {}, forecast: null});
        expect(await handler({city: 'Tokyo', date: '2026-11-11'})).toEqual({location: {}, history: null});
    });

    it('explains a request WeatherAPI.com turned down', async () => {
        answerWith(400);
        expect(await handler({city: 'Nowhere', date: '2027-03-01'})).toEqual({error: 'Invalid request. Check city name "Nowhere" or date "2027-03-01".'});
        // No day sent (today's weather): the city is all there is to check.
        expect(await handler({city: 'Tokio'})).toEqual({error: 'Invalid request. Check city name "Tokio".'});
        expect(await handler({city: 'Tokio', date: '2026-11-12'})).toEqual({error: 'Invalid request. Check city name "Tokio".'});

        answerWith(401);
        expect(await handler({city: 'Tokyo'}))
            .toEqual({error: 'Invalid API key. Please check your WeatherAPI.com API key in the configuration.'});

        answerWith(503, ANSWER, 'Service Unavailable');
        expect(await handler({city: 'Tokyo'})).toEqual({error: 'Weather API error: 503 Service Unavailable'});
    });

    it('keeps the request to its own parameters: the key encoded, the day the one it read', async () => {
        await FetchWeatherDataToolDescriptor.handlerFactory({apiKey: 'a&b#c'})({city: 'Tokyo', date: '2026-11-13'});
        expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/forecast.json?key=a%26b%23c&q=Tokyo&dt=2026-11-13');

        // V8 reads this as 13 November (it skips the part in brackets); the tool takes only a date, nothing after it.
        fetchMock.mockClear();
        expect(await handler({city: 'Tokyo', date: '2026-11-13 (&q=London)'}))
            .toEqual({error: '`date` tool parameter "2026-11-13 (&q=London)" is not a date: send it as YYYY-MM-DD'});
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('turns down an answer of the wrong shape, naming the field', async () => {
        answerWith(200, {current: {temp_c: 'warm'}});

        const {error} = await handler({city: 'Tokyo'}) as {error: string};

        expect(error).toMatch(/^Unexpected response from WeatherAPI\.com \(current\.temp_c: /);
    });

    it('reports a request that fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        expect(await handler({city: 'Tokyo'})).toEqual({error: 'Failed to fetch'});

        fetchMock.mockRejectedValue('offline');

        expect(await handler({city: 'Tokyo'})).toEqual({error: 'Failed to fetch weather data'});
    });
});
