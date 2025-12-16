/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export function generateGraphQLType (name: string, fields: Record<string, string>): string {
    const fieldDefs = Object.entries(fields)
        .map(([key, type]) => `    ${key}: ${type}`)
        .join('\n');

    return `  type ${name} {\n${fieldDefs}\n  }`;
}

export function cleanTypeDefs (typeDef: string): string {
    return typeDef
        .split('\n')
        .map(line => line.replace(/^\s+/, '')) // Remove leading whitespace
        .filter(line => line.trim() !== '') // Remove empty lines
        .join('\n');
}