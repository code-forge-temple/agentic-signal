/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// Dates as the tools read them. V8 reads far more as dates than people mean: "10", "Item 1" and "May 5" all fall in
// 2001, "2023-02-29" rolls over to 1 March, and a bare 2024-01-02 is midnight UTC (the evening before, west of UTC).
// So only text that looks like a date counts as one:
// - numeric: 2024-01-02, 2024/1/2 and 2024.01.02 (year first); 01/02/2024, 1/2/24 and 12-31-2024 (month first, as
//   JavaScript reads them; a day-first 02.01.2024 is text, as it means 2 January in some countries and 1 February here);
// - text with a month name and a 4-digit year: Jan 2, 2024; 2 January 2024; Tue, 02 Jan 2024 10:30:00 GMT;
// each with a time after it or not ("10:30", "9:00:00 AM", ", 10:30:00 AM") and a zone JavaScript knows (Z, UT, UTC,
// GMT, EST/EDT, CST/CDT, MST/MDT, PST/PDT, +02:00, +00).

const CLOCK = String.raw`\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s?[ap]m)?`;
const ZONE = String.raw`(?:z|ut|utc|gmt|[ecmp][sd]t|[+-]\d{2}(?::?\d{2})?)`;
const TIME = String.raw`(?:(?:,\s*|\s+|T)${CLOCK})?(?:\s?${ZONE})?`;
const NUMERIC_DATE = new RegExp(String.raw`^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2}))${TIME}$`, "i");
const MONTH_NAME = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![a-z])/i;
const YEAR = /\b\d{4}\b/;
// A time (and zone) at the end of a date, or a zone alone after a space: what's left is the day.
const TRAILING_TIME = new RegExp(String.raw`(?:(?:,\s*|\s+|T)${CLOCK}(?:\s?${ZONE})?|\s+${ZONE})$`, "i");
const BARE_YEAR_FIRST_DAY = /^\d{4}-\d{1,2}-\d{1,2}$/;

type DayParts = {year: string; month: string; day: string};

// The numeric forms a day starts with, and where its parts are (the day must not run on into more digits).
const NUMERIC_DAYS: {pattern: RegExp; parts: (match: string[]) => DayParts}[] = [
    {pattern: /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/, parts: ([year, month, day]) => ({year, month, day})},
    {pattern: /^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)/, parts: ([month, day, year]) => ({year, month, day})},
];

// A 2-digit year as JavaScript reads it (00-49 in the 2000s, 50-99 in the 1900s); a 4-digit one as it is, 0099 too.
function fullYear (year: string): number {
    const value = Number(year);

    if (year.length > 2) return value;

    return value < 50 ? 2000 + value : 1900 + value;
}

// The day at midnight here; null when it doesn't exist (2023-02-29). setFullYear keeps a year under 100 itself.
function dayHere ({year, month, day}: DayParts): Date | null {
    const [fullYearValue, monthValue, dayValue] = [fullYear(year), Number(month), Number(day)];
    const local = new Date(0);

    local.setFullYear(fullYearValue, monthValue - 1, dayValue);
    local.setHours(0, 0, 0, 0);

    return local.getFullYear() === fullYearValue && local.getMonth() === monthValue - 1 && local.getDate() === dayValue ? local : null;
}

/**
 * The day a text starting with a numeric date names, at midnight here, as written (a time or zone after it doesn't move
 * it): null when that day doesn't exist, undefined when the text doesn't start with a numeric date.
 */
export function numericDay (text: string): Date | null | undefined {
    for (const {pattern, parts} of NUMERIC_DAYS) {
        const match = pattern.exec(text.trim());

        if (match) return dayHere(parts(match.slice(1)));
    }

    return undefined;
}

const looksLikeDate = (text: string) => NUMERIC_DATE.test(text) || (MONTH_NAME.test(text) && YEAR.test(text));

/** Text that looks like a date (see the top of this file), that JavaScript can read as one, on a day that exists. */
export function isDateString (value: unknown): boolean {
    if (typeof value !== "string") return false;

    const text = value.trim();

    return looksLikeDate(text) && !Number.isNaN(Date.parse(text)) && numericDay(text) !== null;
}

/** A date's time, to compare by: a bare 2024-01-02 as that day here (as a date with a time and no zone is read). */
export function dateTime (value: unknown): number {
    const text = String(value).trim();

    if (BARE_YEAR_FIRST_DAY.test(text)) return numericDay(text)?.getTime() ?? NaN;

    return new Date(text).getTime();
}

/**
 * The day a date names, as written, at midnight here: a numeric date's own day, or the day of a date with a month
 * name once its time and zone are set aside (Nov 13, 2026 23:00 GMT is 13 November everywhere). Null when the text
 * isn't a date.
 */
export function dayAsWritten (value: string): Date | null {
    const text = String(value).trim();
    const numeric = numericDay(text);

    if (numeric !== undefined) return isDateString(text) ? numeric : null;

    const dayText = text.replace(TRAILING_TIME, "");

    if (!isDateString(dayText)) return null;

    const day = new Date(dayText);

    day.setHours(0, 0, 0, 0);

    return day;
}
