import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import {FetchDataType} from './workflow';

export const GetDataNodeInputSchema = z.object({
    url: z.string().url(),
    dataType: z.enum([
        'json',
        'text',
        'csv',
        'xml',
        'blob',
        'arrayBuffer',
    ] as [FetchDataType, ...FetchDataType[]]),
});

export type GetDataNodeInput = z.infer<typeof GetDataNodeInputSchema>;

export const GET_DATA_NODE_INPUT_JSON_SCHEMA = JSON.stringify(zodToJsonSchema(GetDataNodeInputSchema), null, 4);
