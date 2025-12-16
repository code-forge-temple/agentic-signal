@echo off
if exist "..\agentic-signal-pro" (
    echo Building with agentic-signal-pro...
    docker buildx build -f dockerfile.pro --build-context agentic-signal-pro=../agentic-signal-pro -t agentic-signal .
) else (
    echo Building without agentic-signal-pro...
    docker build -t agentic-signal .
)