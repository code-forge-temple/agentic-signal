---
sidebar_position: 3
title: Stock Analysis Node
---

# Stock Analysis Node

The **Stock Analysis Node** analyzes historical stock data (OHLCV format) and computes technical indicators including moving averages, volatility, trend classification, and more. This node helps you understand market trends and make data-driven decisions based on historical price movements.

![Stock Analysis Node](/img/nodes/stock-analysis-preview.webp)

## Input Format

The node accepts stock data in OHLCV (Open, High, Low, Close, Volume) format:

```json
{
  "symbol": "AAPL",
  "data": [
    {
      "timestamp": "2026-03-20T00:00:00Z",
      "open": 175.50,
      "high": 177.20,
      "low": 174.80,
      "close": 176.45,
      "volume": 85234567
    },
    {
      "timestamp": "2026-03-21T00:00:00Z",
      "open": 176.50,
      "high": 178.90,
      "low": 176.10,
      "close": 178.45,
      "volume": 92451234
    }
    // ... minimum 10 data points required
  ]
}
```

### Requirements

- **Minimum data points**: At least 10 historical data points are required for analysis
- **Symbol**: Stock ticker symbol (e.g., "AAPL", "GOOG", "MSFT")
- **Data fields**: Each data point must include:
  - `timestamp` (string): ISO 8601 date/time string
  - `open` (number): Opening price
  - `high` (number): Highest price during the period
  - `low` (number): Lowest price during the period
  - `close` (number): Closing price
  - `volume` (number): Trading volume

## Output

The node outputs comprehensive technical analysis including:

```json
{
  "symbol": "AAPL",
  "close": 178.45,
  "pctChange": 0.0234,
  "sma5": 176.82,
  "sma10": 174.56,
  "volumeRatio": 1.23,
  "slope": 0.389,
  "volatility": 2.14,
  "trend": "up",
  "analysisPeriod": {
    "start": "2026-03-20T00:00:00Z",
    "end": "2026-04-05T00:00:00Z"
  }
}
```

### Output Fields

- **symbol**: Stock ticker symbol
- **close**: Most recent closing price
- **pctChange**: Percentage change from previous close (e.g., 0.0234 = 2.34% increase)
- **sma5**: Simple Moving Average over 5 periods
- **sma10**: Simple Moving Average over 10 periods
- **volumeRatio**: Ratio of current volume to average volume (last 10 periods)
- **slope**: Trend slope indicating price change rate over 10 periods
- **volatility**: Price volatility (standard deviation of last 10 closing prices)
- **trend**: Trend classification - `"up"`, `"down"`, or `"sideways"`
- **analysisPeriod**: Object containing start and end timestamps of analyzed data

## Trend Classification

The node automatically classifies market trends based on moving averages and slope:

- **Up Trend**: SMA5 > SMA10 and slope is positive
- **Down Trend**: SMA5 < SMA10 and slope is negative
- **Sideways**: All other conditions (consolidation/neutral market)

## Common Use Cases

1. **Market Trend Analysis**: Identify bullish, bearish, or sideways market conditions
2. **Trading Signal Generation**: Use technical indicators to generate buy/sell signals
3. **Portfolio Monitoring**: Track multiple stocks and analyze their performance
4. **Risk Assessment**: Monitor volatility to assess investment risk
5. **Automated Trading Strategies**: Combine with AI nodes to make automated decisions

## Best Practices

- **Sufficient data**: Provide at least 20-30 data points for more reliable indicators
- **Sort by time**: Ensure data is in chronological order (the node handles this automatically)
- **Regular updates**: Feed fresh data to keep analysis current
- **Combine indicators**: Don't rely on a single indicator; use multiple signals
- **Consider context**: Technical analysis works best alongside fundamental analysis

## Example Usage
For example usage, see the [Stock Analysis & AI Prediction workflow](/docs/workflows/data/stock-analysis-ai-prediction) which demonstrates a complete AI-powered stock trading analysis system that combines technical analysis, real-time news sentiment, and machine learning to generate BUY/SELL/HOLD predictions with confidence scores.

## Troubleshooting

### Common Issues

**Validation Error: "Data array must have at least 10 points"**
- Ensure your input contains at least 10 historical data points
- Check that the data array is properly formatted

**Validation Error: "Stock analysis input validation failed"**
- Verify all required fields are present (timestamp, open, high, low, close, volume)
- Ensure numeric fields contain numbers, not strings
- Check that timestamps are valid ISO 8601 strings

**Unexpected trend classification**
- Remember that "sideways" means the market is not clearly trending
- Consider looking at longer time periods for better trend identification
- Combine with other indicators for confirmation

### Performance Tips

- For real-time analysis, limit data to the most recent 100-200 points
- Process multiple stocks in parallel using separate nodes
- Cache results to avoid redundant calculations

## Technical Indicators Explained

### Simple Moving Average (SMA)
Averages closing prices over a specified period, smoothing out short-term fluctuations:
- **SMA5**: Short-term trend (5 periods)
- **SMA10**: Medium-term trend (10 periods)

### Volatility
Measures price fluctuation using standard deviation. Higher volatility = higher risk and potential reward.

### Volume Ratio
Compares current volume to average volume. Ratios > 1.0 indicate higher than normal trading activity.

### Slope
Indicates the rate of price change. Positive slope = upward momentum, negative = downward momentum.

## Node Type

- **type**: `stock-analysis`

## Integration with Other Nodes

The Stock Analysis Node works seamlessly with:
- **HTTP Node**: Fetch real-time stock data
- **AI Data Processing Node**: Generate insights from technical indicators
- **Chart Node**: Visualize price trends and indicators
- **Data Validation Node**: Validate stock data before analysis
- **JSON Reformatter**: Transform API responses to required format
