---
sidebar_position: 1
---

# AI Data Processing Node

The **AI Data Processing Node** is the main AI component in your workflow. It uses local language models via Ollama to analyze, transform, and generate text-based content for a wide range of tasks.

![Display Chart Node](/img/nodes/ai-data-processing-preview.jpg)

## Configuration

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
    <TabItem value="model" label="Model" default>
        Choose an Ollama model to use for processing (e.g., `llama3.1:8b`).

        ![AI Data Processing Node Model](/img/nodes/ai-tool/llm-process-node-system-prompt.jpg)
    </TabItem>
    <TabItem value="loops" label="Max Feedback Loops">
        Set how many times the node should retry if it receives an error from the next node in the chain.

        ![AI Data Processing Node Feedback Loops](/img/nodes/ai-tool/llm-process-node-system-prompt.jpg)
    </TabItem>
    <TabItem value="prompt" label="System Prompt">
        Provide instructions that guide the AI's behavior and responses.

        ![AI Data Processing Node System Prompt](/img/nodes/ai-tool/llm-process-node-system-prompt.jpg)
    </TabItem>
    <TabItem value="user-message" label="User Message">
        The input the node receives can be customized before processing by adding text before or after  it:
        - **Message Prefix**: Text added before the input.
        - **Message Suffix**: Text added after the input.

        ![AI Data Processing Node User Message](/img/nodes/ai-tool/llm-process-node-user-message.jpg)
    </TabItem>
    <TabItem value="structured-output" label="Structured Output">
        Define JSON schemas for structured responses:
        - **On Success**: The expected format for successful responses. If not set, the output will be plain text.
        - **On Error**: The format for error responses. This only works if **On Success** is also set.
        > **Note:** If you want to chain multiple AI Data Processing Nodes (for example, one node processes data and another oversees its output), set up both **On Success** and **On Error** schemas in the overseer node. If the overseer detects an error, it will trigger a feedback loop, prompting the previous node to correct its output.  
        > See the [AI Data Processing Overseer workflow](/docs/workflows/data/ai-data-processing-overseer) for a complete example.

        ![AI Data Processing Node Structured Output](/img/nodes/ai-tool/llm-process-node-structured-output.jpg)
    </TabItem>
</Tabs>

## Example Usage

For an example usage, see the [Weather Dashboard workflow](/docs/workflows/data/weather-dashboard) and [AI Data Processing Overseer workflow](/docs/workflows/data/ai-data-processing-overseer).

## Common Use Cases

1. **Text Summarization**: Condense long documents or articles.
2. **Data Analysis**: Extract insights from structured data.
3. **Content Generation**: Create articles, reports, or responses.
4. **Question Answering**: Process queries and provide answers.
5. **Language Translation**: Convert text between languages.

## Best Practices

- Use clear, specific prompts for better results.
- Experiment with different models to find the best fit for your task.
- Use structured output schemas for reliable downstream processing.
- Set feedback loops to improve output quality.

## Troubleshooting

### Common Issues

- **Model not found**: Make sure the model is installed in Ollama.
- **Slow responses**: Try a smaller model or check your system resources.
- **Inconsistent output**: Use structured output schemas for consistency.
- **Structured output not supported**: Some language models do not reliably follow structured output instructions. In some cases, the Ollama server will respond with an error indicating that the selected model does not support structured output. If this happens, try using a different model or simplify your output schema.
- **Date/time understanding issues**: Some LLMs, especially smaller models, may have difficulty interpreting or reasoning about dates and times provided in the input. If you notice problems with date handling, try rephrasing your prompt, providing more context, or using a larger/more capable model.

### Performance Tips

- Use smaller models for simple tasks.
- Write concise, focused prompts.
- Batch similar requests when