---
sidebar_position: 4
title: Async Data Aggregator Node
---

# Async Data Aggregator Node

The **Async Data Aggregator Node** collects and synchronizes data from multiple asynchronous sources. It waits until all connected inputs have arrived, then outputs them as an array. This node is essential for workflows that need to coordinate parallel operations and process their results together.

![Async Data Aggregator Node](/img/nodes/async-data-aggregator-preview.webp)

## How It Works

The node operates with a simple but powerful synchronization mechanism:

1. **Collect**: Receives data from multiple connected source nodes
2. **Wait**: Holds data until all connected sources have provided input
3. **Aggregate**: Combines all inputs into a single array
4. **Output**: Emits the aggregated array to downstream nodes
5. **Reset**: Clears internal state, ready for the next cycle

### Synchronization Behavior

The node only triggers when **all** connected inputs have arrived. This ensures that parallel operations complete before downstream processing begins.

```
Source 1 ───> data1 ───┐
                       │
Source 2 ───> data2 ───┤──> Async Data Aggregator ──> [data1, data2, data3]
                       │
Source 3 ───> data3 ───┘
```

## Input Format

The node accepts any data type from connected sources. Each source's output is collected independently.

**Example with 3 sources:**

- Source 1 outputs: `{"temperature": 72, "location": "Office"}`
- Source 2 outputs: `{"humidity": 45, "location": "Warehouse"}`
- Source 3 outputs: `{"temperature": 68, "humidity": 50, "location": "Lab"}`

## Output Format

The node outputs an **array** containing data from all connected sources, in the order they were connected:

```json
[
  {"temperature": 72, "location": "Office"},
  {"humidity": 45, "location": "Warehouse"},
  {"temperature": 68, "humidity": 50, "location": "Lab"}
]
```

## Best Practices

- **Connection Order Matters**: Outputs are ordered based on connection sequence. Connect sources in the order you want them in the output array.
- **Handle Variable Data Types**: If sources return different data structures, use a JSON Reformatter afterward to normalize the array.
- **Avoid Bottlenecks**: Remember that the node waits for **all** inputs. A slow source will delay the entire workflow.
- **Use for Parallel Operations**: This node shines when multiple operations run in parallel. For sequential processing, simple chaining is more efficient.
- **Combine with AI Nodes**: AI Data Processing nodes can intelligently process the aggregated array, making sense of disparate data sources.

## Example Usage
For example usage, see the [Stock Analysis & AI Prediction workflow](/docs/workflows/data/stock-analysis-ai-prediction) which demonstrates a complete AI-powered stock trading analysis system that combines technical analysis, real-time news sentiment, and machine learning to generate BUY/SELL/HOLD predictions with confidence scores.

You can also see the [Slack AI Web Search Bot workflow](/docs/workflows/data/slack-ai-web-search-bot) for a Slack-driven workflow that aggregates command metadata and AI results before sending a response back to Slack.

## Troubleshooting

**Node Never Triggers**

- **cause**: Not all connected sources have provided data.
- Check that all source nodes are connected and running
- Verify each source node successfully produces output
- Use the Logs panel to see which inputs have arrived
- Ensure no source nodes have errors

**Unexpected Output Order**

- **cause**: Connection order differs from expected.
- Disconnect and reconnect sources in the desired order
- Use a JSON Reformatter to reorder the array if needed
- Reference array items by index: `[0]`, `[1]`, `[2]`

**Slow Performance**

- **cause**: One or more sources are slow, holding up the entire aggregation.
- Optimize slow source nodes
- Consider whether all sources are truly needed
- Use separate aggregator nodes for different priority levels
- Add timeouts to HTTP nodes to prevent indefinite waiting

**Memory Issues with Large Datasets**

- **cause**: Collecting too much data at once.
- Filter or transform data before aggregation
- Process data in smaller batches
- Use pagination for large API responses
- Consider alternative workflow designs for very large datasets

## Performance Tips

✅ **Run sources in parallel**: The node's value comes from parallel execution  
✅ **Filter early**: Reduce data size before aggregation  
✅ **Use appropriate timeouts**: Prevent indefinite waiting on slow sources  
✅ **Limit connected sources**: More sources = longer wait time  
✅ **Clear state**: The node automatically clears after output (no manual intervention needed)

## Integration with Other Nodes

Works seamlessly with:
- **HTTP Node**: Parallel API fetching
- **AI Data Processing Node**: Analyze combined data
- **JSON Reformatter**: Transform aggregated array
- **Chart Node**: Visualize multi-source data
- **Data Validation Node**: Validate combined results
- **Any Tool Node**: Parallel tool execution

## Node Type

- **type**: `async-data-aggregator`

## When NOT to Use This Node

❌ **Sequential processing**: If operations must happen in order, use simple chaining  
❌ **Single source**: No aggregation needed for one input  
❌ **Real-time streams**: This node batches; it's not for continuous streaming  
❌ **Memory-constrained scenarios**: Large parallel datasets can consume significant memory