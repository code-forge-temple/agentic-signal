---
title: Intro
description: Explore all available node types and integrations in Agentic Signal. Learn how to configure data sources, AI processors, validation, and output nodes for your workflows.
sidebar_position: 1
---

# Intro

This section provides an overview of all available node types and integrations in `Agentic Signal`. Each node represents a building block for your workflow, enabling data input, AI processing, external API calls, validation, and output.

## Node Structure

![Node Structure](/img/nodes/base-node.png)

Legend:  
① **Input Data Connector**  
② **Output Data Connector**  
③ **Tool Connector**: Some nodes offer additional connectors, such as the [Tool Connector](/docs/nodes/ai/ai-tool) on the [AI Data Processing Node](/docs/nodes/ai/llm-process).  
④ **RAG Connector**: Connects a RAG source node to an AI Data Processing Node so retrieved document context can be included in the prompt.  

⑤ **Timer Connector**: Connects to a [Timer Node](/docs/nodes/input/timer) to trigger this node **Run** method automatically at a set interval/schedule.  
⑥ **Settings**: Configure node-specific options (highlighted if configuration is missing or required).  
⑦ **Error Logs**: View errors when the node fails to process input data (highlighted if errors are present).  
⑧ **Output**: View processed results (e.g., see the [Display Chart Node](/docs/nodes/output/chart)); highlighted when new output is available.  
⑨ **Run**: Manually trigger the workflow from this node onward.  

## Node Types

`Agentic Signal` supports a variety of node types for building workflows, including:

- [Data Source](/docs/nodes/input/data-source)
- [AI Data Processing](/docs/nodes/ai/llm-process)
- [AI Tool](/docs/nodes/ai/ai-tool)
- [RAG](/docs/nodes/ai/rag)
- [HTTP Data](/docs/nodes/input/http-data)
- [JSON Reformatter](/docs/nodes/data/json-reformatter)
- [Stock Analysis](/docs/nodes/data/stock-analysis)
- [Async Data Aggregator](/docs/nodes/data/async-data-aggregator)
- [Data Validation](/docs/nodes/data/data-validation)
- [Chart](/docs/nodes/output/chart)
- [Data Flow Spy](/docs/nodes/output/data-flow-spy)
- [Timer](/docs/nodes/input/timer)
- [Reddit Post](/docs/nodes/output/reddit-post) <span className="pro-badge">PRO</span>
- [Slack Input](/docs/nodes/input/slack-input) <span className="pro-badge">PRO</span>
- [Slack Output](/docs/nodes/output/slack-output) <span className="pro-badge">PRO</span>

## AI & Tool Integrations

- **Ollama LLMs**: Use local language models for text analysis and generation.
- **Google Services**: Gmail, Google Drive, Google Calendar.
- **Weather APIs**: Real-time weather data.
- **Search Engines**: DuckDuckGo, Brave Search.
- **Financial Analysis**: Stock market data analysis with technical indicators.
- **Date/Time Tools**: Get current date and time.
- **Slack**: Send and receive messages via Slack slash commands using Socket Mode.
- **Reddit**: Automatically post text or link content to subreddits via OAuth2.
- **Custom APIs**: Integrate any REST API via HTTP Data node.

## Learn More

- See individual node documentation in this section for configuration and usage details.
- Explore [Workflow Examples](/docs/workflows/overview) for real-world use cases.