# Data Flow Spy Node

The **Data Flow Spy Node** lets you inspect, debug, and visualize the data flowing through your workflow at any point. It's a pure display node — no Run button, no output port — that reacts to its input in real time.

![Display Data Flow Spy Node](/img/nodes/data-flow-spy-preview.jpg)

## Output Dialog

Opening the node's output shows two tabs:

- **Payload**: the incoming `payload`.
- **Tools Payload**: the incoming `toolsPayload`.

Each tab renders independently, in a readable Markdown/JSON format.

## Supported Data Formats

Each tab accepts any data type:

- **Strings**: Displayed as plain text or Markdown.
- **Numbers**: Displayed as-is.
- **Objects/Arrays**: Rendered as formatted JSON blocks.
- **Markdown**: Rendered with full Markdown support (headings, lists, code, etc).

## Example Usage

For example usage, see the [Current Time workflow](/docs/workflows/data/current-time) or [Weather Dashboard workflow](/docs/workflows/data/weather-dashboard), which demonstrate using Data Flow Spy nodes to inspect intermediate results.

## Common Use Cases

1. **Debugging**: Inspect the output of any node in your workflow.
2. **Data Inspection**: View raw or formatted data at any stage.
3. **Markdown Preview**: Render Markdown output from LLMs or other nodes.
4. **Error Tracing**: Quickly spot issues in data transformations.
5. **Workflow Development**: Rapidly iterate by checking intermediate results.

## Best Practices

- **Place after key nodes**: Add Data Flow Spy nodes after important processing steps to verify outputs.
- **Use for troubleshooting**: Temporarily insert to debug unexpected results.
- **Preview Markdown**: Use to check LLM-generated Markdown or JSON.
- **Remove for production**: Remove or disable unnecessary spies in finalized workflows for clarity.

## Troubleshooting

### Common Issues

- **Unreadable output**: Non-JSON objects are rendered as best-effort Markdown or code blocks.
- **Markdown not rendered**: Ensure your data is a valid Markdown string or JSON.
- **Nothing in the Tools Payload tab**: Not every upstream node sends a `toolsPayload` — an empty tab usually just means none was provided.

### Supported Data Types

- String (including Markdown)
- Number
- Boolean
- Object (including arrays)
- Null / Undefined

### Performance Tips

- Avoid sending extremely large data blobs for inspection.
- Use JSON Reformatter nodes to trim or format data before spying.
- For large arrays/objects, consider inspecting only a subset.
