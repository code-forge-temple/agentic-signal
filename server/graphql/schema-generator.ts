import {toolTypeDefs, toolQueryDefs} from "../tools/toolsRegistry.gen.ts";
import {
    nodeTypeDefs,
    nodeQueryDefs,
    nodeSubscriptionDefs,
    nodeMutationDefs
} from "../nodes/nodesRegistry.gen.ts";

export function generateTypeDefs (): string {
    return `
${toolTypeDefs.join("\n")}
${nodeTypeDefs.join("\n")}

type Query {
${toolQueryDefs.join("\n")}
${nodeQueryDefs.join("\n")}
}

type Mutation {
${nodeMutationDefs.join("\n")}
}

type Subscription {
${nodeSubscriptionDefs.join("\n")}
}
`;
}