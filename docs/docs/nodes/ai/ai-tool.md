---
sidebar_position: 2
title: overview
---

# AI Tool Node

The **AI Tool** node allows your workflow to call external tools and APIs, such as weather data, search engines, Google services, and more.  
It acts as a function-calling node that can be configured with different tool types.

## Node Type

- `ai-tool`

## Tool Subtypes

Each AI Tool node must specify a `toolSubtype`. Available subtypes include:

- `fetch-weather-data` — Fetches weather data for a given city
- `duckduckgo-search` — Performs a DuckDuckGo search and returns results
- `brave-search` — Performs a Brave Search using the Brave Search API
- `csv-to-array` — Converts CSV file content into an array of objects for downstream processing
- `max` — Finds the row(s) with the maximum value for a specified key in an array of objects
- `min` — Finds the row(s) with the minimum value for a specified key in an array of objects
- `sort` — Sorts an array of objects by a specified key and order (ascending or descending)
- `date-time-now` — Returns the current date and time in ISO 8601 format
- `gmail-fetch-emails` — Fetches emails from Gmail using search queries
- `gdrive-fetch-files` — Fetches files from Google Drive using search queries
- `gcalendar-fetch-events` — Fetches events from Google Calendar within a specified date range

## Inputs

- Tool-specific parameters (e.g., city name, search query, etc.)
- User configuration (e.g., API keys, OAuth tokens)

## Outputs

- Tool-specific output (e.g., weather data, search results, emails, files, events, etc.)

## Example Configuration

```json
{
    "type": "ai-tool",
    "toolSubtype": "fetch-weather-data",
    "userConfig": {
        "apiKey": "YOUR_WEATHER_API_KEY"
    }
}
```