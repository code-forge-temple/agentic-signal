import fs from "fs";
import path from "path";
import mustache from "mustache";
import {
    getNodeFoldersWithDescriptor,
    getNodeDescriptorInfo
} from "./utils/nodes";
import {
    getToolFoldersWithDescriptor,
    getToolDescriptorInfo
} from "./utils/tools";

const NODES_DIR = path.resolve("client/src/components/nodes");
const TOOLS_DIR = path.resolve("client/src/components/nodes/ToolNode/tools");
const TEMPLATES_DIR = path.resolve("client/src/components/nodes");
const TOOL_TEMPLATES_DIR = path.resolve("client/src/components/nodes/ToolNode/tools");

const OUTPUTS = [
    {template: "workflow.gen.mustache", output: "workflow.gen.ts", dir: NODES_DIR, templatesDir: TEMPLATES_DIR, type: "node"},
    {template: "nodeRegistry.gen.mustache", output: "nodeRegistry.gen.ts", dir: NODES_DIR, templatesDir: TEMPLATES_DIR, type: "node"},
    {template: "nodeFactory.gen.mustache", output: "nodeFactory.gen.ts", dir: NODES_DIR, templatesDir: TEMPLATES_DIR, type: "node"},
    {template: "toolRegistry.gen.mustache", output: "toolRegistry.gen.ts", dir: TOOLS_DIR, templatesDir: TOOL_TEMPLATES_DIR, type: "tool"},
];

function renderTemplate (templateFile: string, data: any, templatesDir: string) {
    const templatePath = path.join(templatesDir, templateFile);
    const template = fs.readFileSync(templatePath, "utf8");

    return mustache.render(template, data);
}

function writeOutput (outputFile: string, content: string, outputDir: string) {
    const outputPath = path.join(outputDir, outputFile);

    fs.writeFileSync(outputPath, content);
    console.log(`Generated: ${outputPath}`);
}

export function generateClient () {
    const nodeFolders = getNodeFoldersWithDescriptor(NODES_DIR);
    const descriptors = nodeFolders.map(getNodeDescriptorInfo);

    const toolFolders = getToolFoldersWithDescriptor(TOOLS_DIR);
    const tools = toolFolders.map(getToolDescriptorInfo);

    for (const {template, output, dir, templatesDir, type} of OUTPUTS) {
        let data;

        if (type === "node") {
            data = {nodes: descriptors, descriptors};
        } else if (type === "tool") {
            data = {tools};
        }

        const content = renderTemplate(template, data, templatesDir);

        writeOutput(output, content, dir);
    }
}