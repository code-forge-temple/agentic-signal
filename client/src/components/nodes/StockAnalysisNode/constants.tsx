/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CandlestickChart} from "iconoir-react";

export const Icon = <CandlestickChart />;

export const NODE_TYPE = "stock-analysis";

export const ERROR_PREFIX = `
This Stock Analysis Node only supports the following input format:
{
  symbol: string,
  data: [
    {
      timestamp: string,
      open: number,
      high: number,
      low: number,
      close: number,
      volume: number
    }, ...
  ]
}
---`;

export const TITLE = "Stock Analysis";