/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {zodToJsonSchema} from 'zod-to-json-schema';
import {NodeEnvelopeSchema} from '../../../../types/workflow';

export const DATASOURCE_INPUT_JSON_SCHEMA = JSON.stringify(zodToJsonSchema(NodeEnvelopeSchema), null, 4);
