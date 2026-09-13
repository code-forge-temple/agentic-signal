/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Tooltip} from '@mui/material';
import './ContextGauge.scss';
import {ContextGaugeProps, buildContextTooltip} from './contextTooltip';


const RADIUS = 15.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TRACK_COLOR = 'rgba(255, 255, 255, 0.3)';
const WARN_RATIO = 0.6;
const DANGER_RATIO = 0.9;

const usedColor = (ratio: number) => {
    if (ratio >= DANGER_RATIO) return '#ff6b6b';

    if (ratio >= WARN_RATIO) return '#ffd166';

    return '#7ee787';
};

export const ContextGauge = (props: ContextGaugeProps) => {
    const {usedTokens, contextLimit, hasModel} = props;
    const measured = usedTokens > 0;
    // Guarded so an unknown or zero limit can't put NaN into strokeDasharray — an unknown
    // window draws an empty ring rather than a misleading one.
    const ratio = contextLimit !== null && contextLimit > 0 ? Math.max(usedTokens / contextLimit, 0) : 0;
    // Clamped only for the arc — the colour keys off the raw ratio so "over" stays red.
    const dash = CIRCUMFERENCE * Math.min(ratio, 1);
    const percent = Math.round(ratio * 100);

    return (
        <Tooltip
            title={buildContextTooltip(props)}
            placement="top"
            arrow
            slotProps={{tooltip: {sx: {whiteSpace: 'pre-line'}}}}
        >
            {/* Renders even when unmeasured, as an empty ring — the gauge shouldn't come and go between messages. */}
            <svg
                className="context-gauge"
                viewBox="0 0 36 36"
                role="img"
                aria-label={
                    hasModel && measured
                        ? `Context window ${percent}% used`
                        : 'Context window usage not measured yet'
                }
                focusable="false"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <circle cx="18" cy="18" r={RADIUS} fill="none" stroke={TRACK_COLOR} strokeWidth="4" />
                <circle
                    cx="18"
                    cy="18"
                    r={RADIUS}
                    fill="none"
                    stroke={usedColor(ratio)}
                    strokeWidth="4"
                    strokeLinecap="butt"
                    strokeDasharray={`${dash.toFixed(3)} ${(CIRCUMFERENCE - dash).toFixed(3)}`}
                    // Set as an SVG attribute rather than in CSS: a CSS rotate on an SVG child
                    // needs transform-box/transform-origin to behave consistently.
                    transform="rotate(-90 18 18)"
                />
            </svg>
        </Tooltip>
    );
};
