/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 ************************************************************************/

import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ContextGauge} from './ContextGauge';
import {ContextGaugeProps, buildContextTooltip} from './contextTooltip';

const props = (overrides: Partial<ContextGaugeProps> = {}): ContextGaugeProps => ({
    usedTokens: 0,
    contextLimit: 4096,
    limitSource: 'assumedDefault',
    hasModel: true,
    ...overrides,
});

/** The progress arc is the second circle; the first is the static track. */
const arcOf = (container: HTMLElement) => container.querySelectorAll('circle')[1];

describe('buildContextTooltip', () => {
    it('reports used, limit and percent once measured', () => {
        const text = buildContextTooltip(props({usedTokens: 1024}));

        expect(text).toContain('1,024 / 4,096 tokens (25%)');
    });

    it('says the measurement is missing before anything has been sent', () => {
        expect(buildContextTooltip(props())).toContain('no measurement yet');
    });

    it('distinguishes an explicit override from the assumed Ollama default', () => {
        expect(buildContextTooltip(props({limitSource: 'override'}))).toContain('your context window override');
        expect(buildContextTooltip(props({limitSource: 'assumedDefault'}))).toContain("assuming Ollama's default");
    });

    it('describes the assumed default as VRAM-dependent rather than a flat figure', () => {
        const text = buildContextTooltip(props({limitSource: 'assumedDefault'}));

        expect(text).toContain('free VRAM');
        expect(text).toContain('24 GiB');
    });

    it('explains that a cloud window is fixed and cannot be overridden', () => {
        const text = buildContextTooltip(props({limitSource: 'cloudMax', contextLimit: 262144}));

        expect(text).toContain("cloud model's maximum");
        expect(text).toContain('silently ignore');
    });

    it('says the window is unknown rather than inventing one', () => {
        const text = buildContextTooltip(props({contextLimit: null, limitSource: 'cloudMax', usedTokens: 500}));

        expect(text).toContain('500 tokens used');
        expect(text).toContain('Window size unknown');
        expect(text).not.toContain('%');
    });

    it('warns when the conversation has outgrown the window', () => {
        expect(buildContextTooltip(props({usedTokens: 5000}))).toContain('Over the limit');
        expect(buildContextTooltip(props({usedTokens: 1024}))).not.toContain('Over the limit');
    });

    it('says cloud rejects an oversized prompt, rather than dropping old messages', () => {
        const cloud = buildContextTooltip(props({usedTokens: 5000, limitSource: 'cloudMax'}));
        const local = buildContextTooltip(props({usedTokens: 5000, limitSource: 'override'}));

        expect(cloud).toContain('rejects a prompt longer than');
        expect(local).toContain('dropping the oldest messages');
    });

    it('says so when no model is selected', () => {
        expect(buildContextTooltip(props({hasModel: false}))).toContain('No model selected');
    });
});

describe('ContextGauge', () => {
    it('still renders the ring when nothing has been measured', () => {
        const {container} = render(<ContextGauge {...props()} />);

        expect(container.querySelectorAll('circle')).toHaveLength(2);
    });

    it('crosses green -> amber at 60% and amber -> red at 90%, staying red when over', () => {
        const strokeAt = (usedTokens: number) =>
            arcOf(render(<ContextGauge {...props({usedTokens})} />).container).getAttribute('stroke');

        expect(strokeAt(2047)).toBe('#7ee787');
        expect(strokeAt(2458)).toBe('#ffd166');
        expect(strokeAt(3687)).toBe('#ff6b6b');
        expect(strokeAt(9000)).toBe('#ff6b6b');
    });

    it('clamps the arc at a full circle instead of wrapping when over the limit', () => {
        const {container} = render(<ContextGauge {...props({usedTokens: 99999})} />);
        const [dash, gap] = arcOf(container).getAttribute('strokeDasharray')?.split(' ')
            ?? arcOf(container).getAttribute('stroke-dasharray')!.split(' ');

        expect(Number(dash)).toBeCloseTo(2 * Math.PI * 15.5, 2);
        expect(Number(gap)).toBeCloseTo(0, 2);
    });

    it('keeps NaN out of the dash array when the limit is zero', () => {
        const {container} = render(<ContextGauge {...props({contextLimit: 0, usedTokens: 10})} />);

        expect(arcOf(container).getAttribute('stroke-dasharray')).not.toContain('NaN');
    });

    it('draws an empty ring instead of a misleading one when the limit is unknown', () => {
        const {container} = render(<ContextGauge {...props({contextLimit: null, usedTokens: 9999})} />);
        const dasharray = arcOf(container).getAttribute('stroke-dasharray')!;

        expect(dasharray).not.toContain('NaN');
        expect(Number(dasharray.split(' ')[0])).toBe(0);
    });

    it('applies the rotation as an SVG attribute, not via CSS', () => {
        const {container} = render(<ContextGauge {...props()} />);

        expect(arcOf(container).getAttribute('transform')).toBe('rotate(-90 18 18)');
    });
});
