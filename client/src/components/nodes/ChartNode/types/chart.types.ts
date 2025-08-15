/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from 'zod';

// Basic point structure for x,y data
export const ChartPointSchema = z.object({
    x: z.union([z.string(), z.number()]),
    y: z.number()
});

// Dataset structure for Chart.js format
export const ChartDatasetSchema = z.object({
    label: z.string().optional(),
    data: z.array(z.number()),
    borderColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    tension: z.number().optional()
});

// Chart.js format with labels and datasets
export const ChartJsFormatSchema = z.object({
    labels: z.array(z.union([z.string(), z.number()])),
    datasets: z.array(ChartDatasetSchema),
    title: z.string().optional()
});

// Simple format with labels and single data array
export const SimpleChartFormatSchema = z.object({
    labels: z.array(z.union([z.string(), z.number()])),
    data: z.array(z.number()),
    title: z.string().optional()
});

// Array of points format
export const PointArraySchema = z.array(ChartPointSchema);

// Array of numbers format
export const NumberArraySchema = z.array(z.number());

// Union of all supported chart data formats
export const ChartDataSchema = z.union([
    ChartJsFormatSchema,
    SimpleChartFormatSchema,
    PointArraySchema,
    NumberArraySchema
]);

export type ChartData = z.infer<typeof ChartDataSchema>;

export type ChartPoint = z.infer<typeof ChartPointSchema>;

export type ChartDataset = z.infer<typeof ChartDatasetSchema>;