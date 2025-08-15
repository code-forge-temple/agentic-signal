---
sidebar_position: 1
---

# Installation

## Prerequisites
- **Bun** (for frontend and docs)
- **Deno** 2.0+ for the backend
- **Ollama** (optional, for local AI features)

## 1. Prerequisites Setup

- **Install Bun (Frontend & Docs Runtime)**  
  Download from [bun.sh](https://bun.sh/docs/install)

- **Install Deno (Backend Runtime)**  
  Download from [deno.land](https://deno.land/) (version 2.0+)

- **Install Ollama (AI Models - Optional)**  
  Download from [ollama.ai](https://ollama.ai/download)

## 2. Clone and Setup Project

```bash
# Clone the repository
git clone https://github.com/code-forge-temple/agentic-signal.git
cd agentic-signal

# Install root dependencies
bun install

# Install client dependencies
cd client && bun install && cd ..

# Install docs dependencies
cd docs && bun install && cd ..
```