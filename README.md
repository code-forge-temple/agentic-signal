# [<img src="docs/static/img/logo.svg" alt="Agentic Signal" width="32" height="32">](https://code-forge-temple.github.io/agentic-signal/) Agentic Signal

**Visual AI Workflow Automation Platform with Local Agent Intelligence**

> ⭐️ **Love this project?** Please consider [starring the repository](https://github.com/code-forge-temple/agentic-signal) on GitHub and [supporting development](https://github.com/sponsors/code-forge-temple) to help me continue building amazing features!

[![License: AGPL v3 & Commercial](https://img.shields.io/badge/License-AGPL%20v3%20%7C%20Commercial-blue.svg)](LICENSE.md)
[![Docs](https://img.shields.io/badge/docs-live-blueviolet)](https://code-forge-temple.github.io/agentic-signal/)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![React Flow](https://img.shields.io/badge/React%20Flow-FF0072?logo=reactflow&logoColor=white)](https://reactflow.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?logo=graphql&logoColor=white)](https://graphql.org/)
[![Deno](https://img.shields.io/badge/Deno-20232A?logo=deno&logoColor=white)](https://deno.land/)
[![Bun](https://img.shields.io/badge/Bun-20232A?logo=bun&logoColor=white)](https://bun.sh/)
[![Ollama](https://img.shields.io/badge/Ollama-000000?logo=ollama&logoColor=white)](https://ollama.ai/)
[![Docusaurus](https://img.shields.io/badge/Docusaurus-3ECC5F?logo=docusaurus&logoColor=white)](https://docusaurus.io/)
[![Iconoir](https://img.shields.io/badge/Iconoir-18181B?logo=iconoir&logoColor=white)](https://iconoir.com/)
[![MUI](https://img.shields.io/badge/MUI-007FFF?logo=mui&logoColor=white)](https://mui.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![AJV](https://img.shields.io/badge/AJV-EF4B4B?logo=ajv&logoColor=white)](https://ajv.js.org/)
[![Zod](https://img.shields.io/badge/Zod-3A7AFE?logo=zod&logoColor=white)](https://zod.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Sass](https://img.shields.io/badge/Sass-CC6699?logo=sass&logoColor=white)](https://sass-lang.com/)
[![ESLint](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)

> Transform complex tasks into visual workflows with local AI intelligence. No cloud dependencies required.

## 🎬 Demo Video  

[<img src="https://img.youtube.com/vi/62zk8zE6UJI/maxresdefault.jpg" alt="Watch Demo Video" width="600">](https://www.youtube.com/watch?v=62zk8zE6UJI)

## ✨ Features

### 🎯 **Visual Workflow Builder**
- **Drag & Drop Interface** - Build workflows visually using React Flow
- **Node-Based Architecture** - Connect data sources, AI processors, and outputs seamlessly
- **Real-time Execution** - See your workflows run in real-time with live data flow

### 🧠 **Local AI Intelligence**
- **Ollama Integration** - Run AI models locally with privacy and control
- **Tool Calling** - AI agents can execute functions and access external APIs
- **Structured Output** - JSON schema validation for reliable AI responses
- **Conversation Memory** - Maintain context across workflow executions

### 🔗 **Rich Integrations**

#### Node Types

- [Data Source](https://agentic-signal.com/docs/nodes/input/data-source)
- [AI Data Processing](https://agentic-signal.com/docs/nodes/ai/llm-process)
- [AI Tool](https://agentic-signal.com/docs/nodes/ai/ai-tool):
  - Weather
  - Search
  - Google services
  - CSV/data operations
  - Stock analysis
  - Date/time tools
- [RAG](https://agentic-signal.com/docs/nodes/ai/rag)
- [HTTP Data](https://agentic-signal.com/docs/nodes/input/http-data)
- [JSON Reformatter](https://agentic-signal.com/docs/nodes/data/json-reformatter)
- [Stock Analysis](https://agentic-signal.com/docs/nodes/data/stock-analysis)
- [Async Data Aggregator](https://agentic-signal.com/docs/nodes/data/async-data-aggregator)
- [Data Validation](https://agentic-signal.com/docs/nodes/data/data-validation)
- [Chart](https://agentic-signal.com/docs/nodes/output/chart)
- [Data Flow Spy](https://agentic-signal.com/docs/nodes/output/data-flow-spy)
- [Timer](https://agentic-signal.com/docs/nodes/input/timer)
- [Reddit Post](https://agentic-signal.com/docs/nodes/output/reddit-post) *(PRO)*
- [Slack Input](https://agentic-signal.com/docs/nodes/input/slack-input) *(PRO)*
- [Slack Output](https://agentic-signal.com/docs/nodes/output/slack-output) *(PRO)*
- _other integrations coming soon_

> See the full [Nodes Reference](https://agentic-signal.com/docs/nodes/overview) for details on all node types.

#### Workflows

Explore ready-to-use workflow templates in the [Workflow Examples](https://agentic-signal.com/docs/workflows/overview).

#### AI & Tool Integrations

- **Ollama LLMs**: Use local language models for text analysis and generation.
- **Google Services**: Gmail, Google Drive, Google Calendar.
- **Weather APIs**: Real-time weather data.
- **Search Engines**: DuckDuckGo, Brave Search.
- **Financial Analysis**: Stock market data analysis with technical indicators.
- **Date/Time Tools**: Get current date and time.
- **Slack**: Send and receive messages via Slack slash commands using Socket Mode. *(PRO)*
- **Reddit**: Automatically post text or link content to subreddits via OAuth2. *(PRO)*
- **Custom APIs**: Integrate any REST API via HTTP Data node.
- **More integrations coming soon** - Discord, Notion, Airtable, and many more!

## 🚀 Quick Start

 - Windows/Linux/macOS App: [quick start](https://agentic-signal.com/docs/getting-started/windows-app/quick-start) for setup and configuration instructions, or
 - Web App: [installation](https://agentic-signal.com/docs/getting-started/web-app/installation) & [quick start](https://agentic-signal.com/docs/getting-started/web-app/quick-start) (includes Docker option)

## 🤝 Contributing

I welcome contributions from developers! 

- **🐛 Report Bugs** - [GitHub Issues](https://github.com/code-forge-temple/agentic-signal/issues)
- **💡 Request Features** - [GitHub Discussions](https://github.com/code-forge-temple/agentic-signal/discussions)

Every contribution helps make Agentic Signal better! 🚀

## 📄 License

**Dual License Model**

- **Open Source (AGPL v3)**: Free for personal, educational, and non-commercial use
- **Commercial License**: Required for business use, SaaS, or proprietary integration

See [LICENSE.md](LICENSE.md) for full details.

## 🆘 Support

- **Documentation**: [https://code-forge-temple.github.io/agentic-signal/](https://code-forge-temple.github.io/agentic-signal/)
- **Discord**: [Join the Agentic Signal Discord](https://discord.gg/FpT2VFdFYu)
- **Reddit**: [r/AgenticSignal](https://www.reddit.com/r/AgenticSignal/)
- **Issues**: [GitHub Issues](https://github.com/code-forge-temple/agentic-signal/issues)
- **Discussions**: [GitHub Discussions](https://github.com/code-forge-temple/agentic-signal/discussions)
- **Commercial Support**: please contact me on my GitHub email

---

**Built with ❤️ by `Code Forge Temple`**

*Empowering everyone to build intelligent workflows with visual simplicity and local AI power.*
