/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const EXTRACTION_TYPE = {
    IMAGE: 'IMAGE',
    CODE_BLOCK: 'CODE_BLOCK',
} as const;

export type EXTRACTION_TYPE = typeof EXTRACTION_TYPE[keyof typeof EXTRACTION_TYPE];