import {toolTypeDefs, toolQueryDefs} from "../tools/toolsRegistry.gen.ts";
import {
    nodeTypeDefs,
    nodeQueryDefs,
    nodeSubscriptionDefs,
    nodeMutationDefs
} from "../nodes/nodesRegistry.gen.ts";
// App-level rather than a node's or a tool's, so the workflows folder, the outside commands and the
// browser detection are wired here by hand instead of through a generated registry.
import {
    typeDefs as workflowTypeDefs,
    queryDefs as workflowQueryDefs,
    mutationDefs as workflowMutationDefs
} from "../workflows/mod.ts";
import {
    typeDefs as commandTypeDefs,
    queryDefs as commandQueryDefs,
    mutationDefs as commandMutationDefs,
    subscriptionDefs as commandSubscriptionDefs
} from "../commands/mod.ts";
import {queryDefs as browserQueryDefs} from "../browser/mod.ts";

export function generateTypeDefs (): string {
    return `
${toolTypeDefs.join("\n")}
${nodeTypeDefs.join("\n")}
${workflowTypeDefs}
${commandTypeDefs}

type Query {
${toolQueryDefs.join("\n")}
${nodeQueryDefs.join("\n")}
${workflowQueryDefs}
${commandQueryDefs}
${browserQueryDefs}
}

type Mutation {
${nodeMutationDefs.join("\n")}
${workflowMutationDefs}
${commandMutationDefs}
}

type Subscription {
${nodeSubscriptionDefs.join("\n")}
${commandSubscriptionDefs}
}
`;
}