# Adding New Tools

Agentic Signal uses a modular tool system that allows AI agents to call external functions and APIs. This guide will walk you through adding new tools to the platform.

## Tool Architecture

Tools in Agentic Signal consist of:
- **Frontend Tool Definition**: Registered in [`toolRegistry.tsx`](https://github.com/code-forge-temple/agentic-signal/blob/main/client/src/components/nodes/ToolNode/toolRegistry.tsx)
- **Backend Services** (optional): For complex integrations requiring server-side processing
- **User Configuration**: Schema for API keys, OAuth tokens, and other settings

## Adding a Frontend-Only Tool

### 1. Define Your Tool

Add your tool to the [`toolRegistry`](client/src/components/nodes/ToolNode/toolRegistry.tsx) array:

```typescript
// filepath: client/src/components/nodes/ToolNode/toolRegistry.tsx
{
    toolSubtype: "my-new-tool",
    title: "My New Tool",
    icon: <YourIcon />, // Import your icon component
    toolSchema: {
        name: "myNewTool",
        description: "Description of what your tool does",
        parameters: {
            type: "object",
            properties: {
                input1: {
                    type: "string", 
                    description: "Description of input parameter"
                },
                input2: {
                    type: "number",
                    description: "Numeric input parameter"
                }
            },
            required: ["input1"]
        }
    },
    userConfigSchema: {
        apiKey: {
            type: "string",
            description: "Your API Key",
            required: true
        },
        maxResults: {
            type: "integer",
            description: "Maximum results to return",
            default: 10,
            minimum: 1,
            maximum: 100
        }
    },
    handlerFactory: (userConfig: { apiKey?: string, maxResults?: number }) => 
        async ({ input1, input2 }: { input1: string, input2?: number }) => {
            try {
                // Your tool logic here
                const response = await fetch(`https://api.example.com/data?q=${input1}`, {
                    headers: {
                        'Authorization': `Bearer ${userConfig.apiKey}`
                    }
                });
                
                const data = await response.json();
                return data.results.slice(0, userConfig.maxResults);
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }
}
```

### 2. Add Tool Documentation

#### Create Documentation File
```markdown
// filepath: docs/docs/nodes/ai/tools/my-new-tool.md
[your existing template]
```

#### Add Tool Screenshot
Add a screenshot of your tool configuration to:
```
docs/static/img/nodes/ai-tool/my-new-tool.jpg
```

#### Update Sidebar Navigation
```typescript
// filepath: docs/sidebars.ts
// ...existing code...
{
    type: 'category',
    label: 'AI Tool Node',
    items: [
        'nodes/ai/ai-tool',
        'nodes/ai/tools/fetch-weather-data',
        'nodes/ai/tools/duckduckgo-search',
        'nodes/ai/tools/brave-search',
        'nodes/ai/tools/date-time-now',
        'nodes/ai/tools/gmail-fetch-emails',
        'nodes/ai/tools/gdrive-fetch-files',
        'nodes/ai/tools/gcalendar-fetch-events',
        'nodes/ai/tools/my-new-tool', // Add your tool here
    ],
},
// ...existing code...
```

#### Update Main AI Tool Documentation
```markdown
// filepath: docs/docs/nodes/ai/ai-tool.md
// Add your tool to the list of available tools
- [My New Tool](./tools/my-new-tool) - Description of what your tool does
```

#### Update Nodes Overview (if applicable)
```markdown
// filepath: docs/docs/nodes/overview.md
// Add your tool to any overview sections that list available integrations
```

### 3. Update Sidebar Navigation

Add your tool to the docs sidebar:

```typescript
// filepath: docs/sidebars.ts
// ...existing code...
{
    type: 'category',
    label: 'AI Tool Node',
    items: [
        'nodes/ai/ai-tool',
        'nodes/ai/tools/fetch-weather-data',
        'nodes/ai/tools/duckduckgo-search',
        'nodes/ai/tools/brave-search',
        'nodes/ai/tools/date-time-now',
        'nodes/ai/tools/gmail-fetch-emails',
        'nodes/ai/tools/gdrive-fetch-files',
        'nodes/ai/tools/gcalendar-fetch-events',
        'nodes/ai/tools/my-new-tool', // Add your tool here
    ],
},
// ...existing code...
```

## Adding a Tool with Backend Integration

Some tools require server-side processing (e.g., web scraping, complex API integrations, OAuth flows). Here's how to add backend support:

### 1. Add Shared Types

First, define your types in the shared directory:

```typescript
// filepath: shared/types/myTool.ts
export interface MyToolResult {
    field1: string;
    field2: number;
    // ... other fields
}

export interface MyToolSearchArgs {
    input1: string;
    options: {
        apiKey: string;
        maxResults: number;
    };
}

export const MyToolResultFields = {
    field1: 'String',
    field2: 'Int',
    // ... other fields mapped to GraphQL types
} as const;
```

```typescript
// filepath: shared/types/index.ts
export * from './myTool.ts';
// ...existing exports...
```

### 2. Add Backend Service

Create the service that handles the actual business logic:

```typescript
// filepath: server/services/myToolService.ts
import { MyToolResult, MyToolSearchArgs } from "../../shared/types/myTool.ts";

export async function fetchMyToolResults(args: MyToolSearchArgs): Promise<MyToolResult[]> {
    const { input1, options } = args;
    
    try {
        // Your server-side logic here
        // This might include web scraping, complex API calls, etc.
        const response = await fetch(`https://api.example.com/data?q=${input1}`, {
            headers: {
                'Authorization': `Bearer ${options.apiKey}`
            }
        });
        
        const data = await response.json();
        
        return data.results.slice(0, options.maxResults).map((item: any) => ({
            field1: item.title,
            field2: item.count,
            // ... map other fields
        }));
    } catch (error) {
        throw new Error(`My tool error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
```

### 3. Add GraphQL Types

Update the schema generator to include your new types:

```typescript
// filepath: server/graphql/schema-generator.ts
import {
    // ...existing imports...
    MyToolResultFields,
} from '../../shared/types/index.ts';

export function generateTypeDefs(): string {
    return /* GraphQL */ `
    // ...existing types...
    
    ${generateGraphQLType("MyToolResult", MyToolResultFields)}

    type Query {
        // ...existing queries...
        myNewTool(input1: String!, apiKey: String!, maxResults: Int!): [MyToolResult]
    }
    `;
}
```

### 4. Add GraphQL Types Interface

```typescript
// filepath: server/graphql/types.ts
import {
    // ...existing imports...
    MyToolResult,
    MyToolSearchArgs,
} from '../../shared/types/index.ts';

export type {
    // ...existing exports...
    MyToolResult,
    MyToolSearchArgs,
};

export interface GraphQLContext {
    services: {
        // ...existing services...
        fetchMyToolResults: (args: MyToolSearchArgs) => Promise<MyToolResult[]>;
    };
    request?: Request;
}
```

### 5. Add GraphQL Resolver

```typescript
// filepath: server/graphql/resolvers/myToolResolvers.ts
import {
    GraphQLContext,
    MyToolResult
} from '../types.ts';

export const myToolResolvers = {
    myNewTool: async (
        _parent: unknown,
        { input1, apiKey, maxResults }: { input1: string, apiKey: string, maxResults: number },
        { services }: GraphQLContext
    ): Promise<MyToolResult[]> => {
        if (!input1) {
            throw new Error("Missing input1 parameter");
        }

        if (!apiKey) {
            throw new Error("Missing apiKey parameter");
        }

        if (!maxResults || maxResults < 1 || maxResults > 100) {
            throw new Error("maxResults must be between 1 and 100");
        }

        try {
            const results = await services.fetchMyToolResults({
                input1,
                options: { apiKey, maxResults }
            });

            return results;
        } catch (err) {
            throw new Error(
                typeof err === "object" && err !== null && "message" in err
                    ? (err as Error).message
                    : String(err)
            );
        }
    },
};
```

### 6. Update Resolvers Index

```typescript
// filepath: server/graphql/resolvers/index.ts
import { myToolResolvers } from './myToolResolvers.ts';
// ...existing imports...

export const resolvers = {
    Query: {
        // ...existing resolvers...
        ...myToolResolvers,
    },
};
```

### 7. Update Main Server

```typescript
// filepath: server/main.ts
import * as myToolServices from "./services/myToolService.ts";
// ...existing imports...

const yoga = createYoga({
    schema,
    cors: {
        origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
        ],
        credentials: true,
    },
    context: (request) => ({
        services: {
            // ...existing services...
            ...myToolServices,
        },
        request: request.request
    })
});
```

### 8. Add Frontend Types

```typescript
// filepath: client/src/types/api.ts
import {
    // ...existing imports...
    MyToolResult,
    MyToolSearchArgs,
} from '@shared/types/myTool.ts';

export {
    // ...existing exports...
    MyToolResult,
    MyToolSearchArgs,
};
```

### 9. Update Frontend GraphQL Service

```typescript
// filepath: client/src/services/graphqlService.ts
import {
    // ...existing imports...
    MyToolResult,
} from '../types/api.ts';

export class GraphQLService {
    // ...existing methods...
    
    static async myNewTool(
        input1: string, 
        userConfig: { apiKey: string; maxResults: number }
    ): Promise<MyToolResult[]> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($input1: String!, $apiKey: String!, $maxResults: Int!) {
                        myNewTool(input1: $input1, apiKey: $apiKey, maxResults: $maxResults) {
                            field1
                            field2
                        }
                    }
                `,
                variables: {
                    input1,
                    apiKey: userConfig.apiKey,
                    maxResults: userConfig.maxResults
                }
            })
        });

        const { data, errors } = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }

        return data.myNewTool;
    }
}
```

### 10. Update Tool Registry

```typescript
// filepath: client/src/components/nodes/ToolNode/toolRegistry.tsx
import { MyToolResult } from "../../../types/api";

export const toolRegistry: ToolDefinition[] = [
    // ...existing tools...
    {
        toolSubtype: "my-backend-tool",
        title: "My Backend Tool",
        icon: <YourIcon />,
        toolSchema: {
            name: "myNewTool",
            description: "Description of what your tool does",
            parameters: {
                type: "object",
                properties: {
                    input1: {
                        type: "string",
                        description: "Description of input parameter"
                    }
                },
                required: ["input1"]
            }
        },
        userConfigSchema: {
            apiKey: {
                type: "string",
                description: "Your API Key",
                required: true
            },
            maxResults: {
                type: "integer",
                description: "Maximum results to return",
                default: 10,
                minimum: 1,
                maximum: 100
            }
        },
        handlerFactory: (userConfig: { apiKey?: string, maxResults?: number }) => 
            async ({ input1 }: { input1: string }): Promise<MyToolResult[] | { error: string }> => {
                try {
                    if (!userConfig.apiKey) {
                        return { error: "API key required. Please configure in tool settings." };
                    }

                    if (!userConfig.maxResults) {
                        return { error: "Maximum results must be specified." };
                    }

                    return await GraphQLService.myNewTool(input1, {
                        apiKey: userConfig.apiKey,
                        maxResults: userConfig.maxResults
                    });
                } catch (error) {
                    return { error: error instanceof Error ? error.message : 'Unknown error' };
                }
            }
    }
];
```

## Summary of Files to Update for Backend Integration:

### Shared Types:
- `shared/types/myTool.ts` (new)
- `shared/types/index.ts`

### Server Backend:
- `server/services/myToolService.ts` (new)
- `server/graphql/schema-generator.ts`
- `server/graphql/types.ts`
- `server/graphql/resolvers/myToolResolvers.ts` (new)
- `server/graphql/resolvers/index.ts`
- `server/main.ts`

### Client Frontend:
- `client/src/types/api.ts`
- `client/src/services/graphqlService.ts`
- `client/src/components/nodes/ToolNode/toolRegistry.tsx`

This follows the exact same pattern as the existing tools like Gmail, Google Drive, and Calendar integrations in your codebase!

## OAuth Integration

For tools requiring OAuth (like Google services), follow this pattern:

### 1. Add OAuth Configuration

```typescript
// filepath: client/src/components/nodes/ToolNode/toolRegistry.tsx
userConfigSchema: {
    googleClientId: {
        type: "string",
        description: "Google OAuth2 Client ID (from Google Cloud Console)"
    },
    accessToken: {
        type: ACCESS_TOKEN_TYPE_OAUTH,
        description: "Service Authentication", 
        provider: "your-service", // Add to PROVIDERS constant
        required: true
    }
}
```

### 2. Add Provider Configuration

```typescript
// filepath: client/src/constants.ts
export const PROVIDERS = {
    // ...existing providers...
    YOUR_SERVICE: 'your-service'
};

export const PROVIDER_SCOPES = {
    // ...existing scopes...
    [PROVIDERS.YOUR_SERVICE]: 'https://www.googleapis.com/auth/your.scope'
};
```

## Best Practices

### Error Handling
Always return structured error objects:
```typescript
return { error: "Descriptive error message" };
```

### Input Sanitization
Sanitize LLM-generated input:
```typescript
const sanitizedInput = (input || "").replace(/["""]/g, '"').replace(/[''']/g, "'");
```

### Configuration Validation
Check required configuration:
```typescript
if (!userConfig.apiKey) {
    return { error: "API key required. Please configure in tool settings." };
}
```

### Rate Limiting
Implement reasonable defaults:
```typescript
userConfigSchema: {
    maxResults: {
        type: "integer",
        description: "Maximum results",
        default: 10,
        minimum: 1,
        maximum: 100
    }
}
```

## Testing Your Tool

1. **Start the development servers**:
   ```bash
   bun run dev
   ```

2. **Test the tool in a workflow**:
   - Add an AI Data Processing node
   - Connect your tool node
   - Provide test input and configuration
   - Verify the output

3. **Test error cases**:
   - Missing API keys
   - Invalid input parameters
   - Network failures

## Submitting Your Contribution

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b add-my-new-tool`
3. **Add your tool following the patterns above**
4. **Test thoroughly**
5. **Update documentation**
6. **Submit a Pull Request**

### Pull Request Checklist

- [ ] Tool added to [`toolRegistry.tsx`](client/src/components/nodes/ToolNode/toolRegistry.tsx)
- [ ] Documentation created in `docs/docs/nodes/ai/tools/my-new-tool.md`
- [ ] Tool screenshot added to `docs/static/img/nodes/ai-tool/my-new-tool.jpg`
- [ ] Sidebar updated in [`docs/sidebars.ts`](docs/sidebars.ts)
- [ ] Main AI Tool documentation updated in `docs/docs/nodes/ai/ai-tool.md`
- [ ] Nodes overview updated (if applicable)
- [ ] Backend integration added (if required)
- [ ] Error handling implemented
- [ ] Input sanitization added
- [ ] Configuration validation included
- [ ] Tool tested with sample workflows

## Getting Help

- **Discussions**: [GitHub Discussions](https://github.com/code-forge-temple/agentic-signal/discussions)
- **Issues**: [GitHub Issues](https://github.com/code-forge-temple/agentic-signal/issues)
- **Examples**: Study existing tools in [`toolRegistry.tsx`](client/src/components/nodes/ToolNode/toolRegistry.tsx)

---

We welcome all tool contributions! Every new tool makes `Agentic Signal` more powerful for the entire community.