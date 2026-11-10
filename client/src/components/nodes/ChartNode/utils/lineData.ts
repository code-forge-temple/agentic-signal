/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ChartData, ChartDataset, ChartPoint} from "../types/input.types";


// The label a single line takes when the input names none: the node's title.
const DEFAULT_LINE_LABEL = "Line";

/** Line chart data as Chart.js takes it, with the input's title when it has one. */
export type LineData = {labels: (string | number)[]; datasets: ChartDataset[]; title?: string};

/** A random color, light and dark extremes left out, for a line the input gives no color. */
export function randomColor (): string {
    const channel = () => Math.floor(Math.random() * 200 + 30);

    return `rgb(${channel()},${channel()},${channel()})`;
}

const singleLine = (data: number[], label: string | undefined): ChartDataset => ({
    label: label || DEFAULT_LINE_LABEL,
    data,
    borderColor: randomColor(),
    backgroundColor: randomColor(),
    tension: 0.4,
});

const withTitle = (title: string | undefined) => (title ? {title} : {});

// {labels, datasets}: Chart.js's own format; a dataset without colors gets random ones.
const fromDatasets = (input: {labels: (string | number)[]; datasets: ChartDataset[]; title?: string}): LineData => ({
    labels: input.labels,
    datasets: input.datasets.map(dataset => ({borderColor: dataset.borderColor || randomColor(), backgroundColor: dataset.backgroundColor || randomColor(), ...dataset})),
    ...withTitle(input.title),
});

// {labels, data}: one line.
const fromLabeledData = (input: {labels: (string | number)[]; data: number[]; title?: string}, label: string | undefined): LineData => ({
    labels: input.labels,
    datasets: [singleLine(input.data, label)],
    ...withTitle(input.title),
});

const isPoint = (item: unknown): item is ChartPoint => typeof item === "object" && item !== null && "x" in item && "y" in item;

// [{x, y}, ...] or [n, ...]: one line, labelled by x or by position.
function fromArray (input: unknown[], label: string | undefined): LineData | undefined {
    const [first] = input;

    if (isPoint(first)) {
        const points = input as ChartPoint[];

        return {labels: points.map(point => point.x), datasets: [singleLine(points.map(point => point.y), label)]};
    }

    if (typeof first === "number") return {labels: input.map((_, index) => index), datasets: [singleLine(input as number[], label)]};

    return undefined;
}

/** The chart input as line chart data; undefined for no input, an empty array, or a shape it doesn't know. */
export function toLineData (input: ChartData | null, label: string | undefined): LineData | undefined {
    if (!input) return undefined;

    if (Array.isArray(input)) return fromArray(input, label);

    if ("datasets" in input) return fromDatasets(input);

    return "data" in input ? fromLabeledData(input, label) : undefined;
}
