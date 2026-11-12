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

    it('asks for the current weather with no date, for today and for a date it cannot read (an impossible day too)', async () => {
        for (const date of [undefined, '2026-11-12', 'soon', '2026-13-45']) {
            fetchMock.mockClear();

            const result: unknown = await handler({city: ' New York ', date});

            expect(requestedUrl()).toBe('https://api.weatherapi.com/v1/current.json?key=k3y&q=New%20York');
            expect(result).toEqual({
                location: LOCATION,
                current: {...CURRENT, condition: 'Sunny'},
            });
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
        expect(await handler({city: 'Nowhere', date: '2026-13-45'}))
            .toEqual({error: 'Invalid request. Check city name "Nowhere" or date format "2026-13-45".'});

        answerWith(401);
        expect(await handler({city: 'Tokyo'}))
            .toEqual({error: 'Invalid API key. Please check your WeatherAPI.com API key in the configuration.'});

        answerWith(503, ANSWER, 'Service Unavailable');
        expect(await handler({city: 'Tokyo'})).toEqual({error: 'Weather API error: 503 Service Unavailable'});
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
