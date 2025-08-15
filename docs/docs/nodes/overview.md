---
sidebar_position: 1
---

# Intro

This section provides an overview of all available node types and integrations in Agentic Signal. Each node represents a building block for your workflow, enabling data input, AI processing, external API calls, validation, and output.

## Node Structure

![Node Structure](/img/nodes/base-node.png)

Legend:  
① **Input Data Connector**  
② **Output Data Connector**  
③ **Extra Input Connector**: Some nodes offer additional connectors, such as the [Tool Connector](/docs/nodes/ai/ai-tool) on the [AI Data Processing Node](/docs/nodes/ai/llm-process).  
④ **Settings**: Configure node-specific options (highlighted if configuration is missing or required).  
⑤ **Error Logs**: View errors when the node fails to process input data (highlighted if errors are present).  
⑥ **Output**: View processed results (e.g., see the [Display Chart Node](/docs/nodes/output/chart)); highlighted when new output is available.  
⑦ **Run**: Manually trigger the workflow from this node onward.  

## Node Types

Agentic Signal supports a variety of node types for building workflows, including:

- Data Source
- AI Data Processing
- AI Tool
- HTTP Data
- JSON Reformatter
- Chart
- Data Validation
- Data Flow Spy

## AI & Tool Integrations

- **Ollama LLMs**: Use local language models for text analysis and generation.
- **Google Services**: Gmail, Google Drive, Google Calendar.
- **Weather APIs**: Real-time weather data.
- **Search Engines**: DuckDuckGo, Brave Search.
- **Date/Time Tools**: Get current date and time.
- **Custom APIs**: Integrate any REST API via HTTP Data node.

## Learn More

- See individual node documentation in this section for configuration and usage details.
- Explore [Workflow Examples](/docs/workflows/overview) for real-world use cases.