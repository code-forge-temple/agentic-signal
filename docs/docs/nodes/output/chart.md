---
sidebar_position: 1
---

# Chart Node

The **Chart Node** visualizes data as interactive line charts. It accepts various data formats and automatically converts them into beautiful, responsive charts using Chart.js.

![Display Chart Node](/img/nodes/display-chart-preview.jpg)

## Supported Data Formats

The Chart Node accepts multiple data formats:

**1. Chart.js Format**
```json
{
    "labels": ["Jan", "Feb", "Mar"],
    "datasets": [
    {
        "label": "Sales",
        "data": [10, 20, 30],
        "borderColor": "#ff6384",
        "backgroundColor": "#ff6384"
    }
    ]
}
```

**2. Simple Format**
```json
{
    "labels": ["A", "B", "C"],
    "data": [1, 2, 3],
    "title": "My Chart"
}
```

**3. Array of Points**
```json
[
    {"x": "Jan", "y": 10},
    {"x": "Feb", "y": 20},
    {"x": "Mar", "y": 30}
]
```

**4. Array of Numbers**
```json
[10, 20, 30, 25, 35]
```

## Example Usage

For example usage, see the [Timeseries Chart workflow](/docs/workflows/data/timeseries-chart) which demonstrates fetching API data, reformatting it, and displaying it as a chart.

## Common Use Cases

1. **Time Series Visualization**: Display stock prices, sensor data, or metrics over time
2. **Data Analysis**: Visualize trends and patterns in datasets
3. **Dashboard Creation**: Create visual dashboards for monitoring and reporting
4. **AI-Generated Charts**: Let AI Data Processing Nodes create chart data for visualization
5. **API Data Visualization**: Display data fetched from external APIs

## Best Practices

- **Use structured data**: Ensure your data matches one of the supported formats
- **Label your data**: Include meaningful labels for better chart readability
- **Chain with reformatters**: Use JSON Reformatter nodes to transform complex API responses
- **Handle validation errors**: Connect to AI Data Processing Nodes for automatic error correction
- **Keep data reasonable**: Very large datasets may impact performance

## Troubleshooting

### Common Issues

- **Validation failed**: Check that your data matches one of the supported formats
- **Empty chart**: Ensure data contains valid numerical values
- **Performance issues**: Large datasets (>1000 points) may slow rendering
- **Missing labels**: Array-only data will use sequential labels (0, 1, 2...)

### Supported Data Examples

**Valid Number Array:**
```json
[1, 2, 3, 4, 5]
```

**Valid Point Array:**
```json
[
  {"x": 1, "y": 10},
  {"x": 2, "y": 20}
]
```

**Invalid Data:**
```json
["text", "more text"]  // Non-numeric data
```

### Performance Tips

- Limit datasets to under 1000 points for optimal performance
- Use simple data formats when possible
- Consider data aggregation for large time series
- Test with sample data before connecting to large data sources