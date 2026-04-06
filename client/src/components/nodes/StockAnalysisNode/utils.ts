/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {StockDataPoint} from "./types/workflow";


export function computeIndicators (data: StockDataPoint[]) {
    if (!data || data.length < 10) {
        throw new Error("Not enough data (need at least 10 points)");
    }

    // Ensure sorted by timestamp (important!)
    const sorted = [...data].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const closes = sorted.map(d => d.close);
    const volumes = sorted.map(d => d.volume);

    const last = closes.length - 1;

    // ---------- helpers ----------
    const sma = (arr: number[], n: number) => {
        const slice = arr.slice(-n);

        return slice.reduce((a, b) => a + b, 0) / n;
    };

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const std = (arr: number[]) => {
        const mean = avg(arr);

        return Math.sqrt(
            avg(arr.map(x => Math.pow(x - mean, 2)))
        );
    };

    // ---------- indicators ----------

    // 1. % change (last step)
    const pctChange = (closes[last] - closes[last - 1]) / closes[last - 1];

    // 2. moving averages
    const sma5 = sma(closes, 5);
    const sma10 = sma(closes, 10);

    // 3. volume ratio (last vs avg 10)
    const avgVolume = avg(volumes.slice(-10));
    const volumeRatio = volumes[last] / avgVolume;

    // 4. slope (simple trend)
    const slope =
    (closes[last] - closes[last - 10]) / 10;

    // 5. volatility (last 10)
    const volatility = std(closes.slice(-10));

    // 6. trend classification
    let trend = "sideways";

    if (sma5 > sma10 && slope > 0) {
        trend = "up";
    } else if (sma5 < sma10 && slope < 0) {
        trend = "down";
    }

    // Analysis period
    const analysisPeriod = {
        start: sorted[0]?.timestamp,
        end: sorted[last]?.timestamp
    };

    return {
        close: closes[last],
        pctChange,
        sma5,
        sma10,
        volumeRatio,
        slope,
        volatility,
        trend,
        analysisPeriod
    };
}