/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseEdge, Edge, EdgeProps, Position, getSmoothStepPath, useReactFlow, useStore} from '@xyflow/react';
import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import './ElbowEdge.scss';


type Point = {x: number; y: number};
type ElbowEdgeData = {bend?: Point};

const CORNER_RADIUS = 8;

function axisPosition (dx: number, dy: number, forExit: boolean, useXAxis = Math.abs(dx) >= Math.abs(dy)): Position {
    if (useXAxis) {
        const positive = dx >= 0;

        if (forExit) return positive ? Position.Right : Position.Left;

        return positive ? Position.Left : Position.Right;
    }

    const positive = dy >= 0;

    if (forExit) return positive ? Position.Bottom : Position.Top;

    return positive ? Position.Top : Position.Bottom;
}

// Pulls the raw corner vertices out of a getSmoothStepPath() result computed with
// borderRadius 0 - at radius 0 every corner still emits a degenerate (zero-length) curve
// through the corner point, so collapsing consecutive duplicate coordinates yields exactly
// the logical vertex list react-flow itself routed through, with no rounding baked in yet.
function extractVertices (pathString: string): Point[] {
    const vertices: Point[] = [];

    for (const match of pathString.matchAll(/(-?[\d.]+)[,\s]+(-?[\d.]+)/g)) {
        const point = {x: parseFloat(match[1]), y: parseFloat(match[2])};
        const last = vertices[vertices.length - 1];

        if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.01) {
            vertices.push(point);
        }
    }

    return vertices;
}

// Re-implements react-flow's own corner-rounding (pull back along the incoming direction,
// quadratic-curve through the corner, push forward along the outgoing direction, radius
// clamped to half of whichever adjacent segment is shorter) but applied uniformly across
// the whole combined vertex list - including the user-dragged bend, which getSmoothStepPath
// never rounds itself since it only ever sees that point as one call's endpoint.
function roundedPolylinePath (vertices: Point[], radius: number): string {
    if (vertices.length < 2) return '';

    const parts = [`M${vertices[0].x} ${vertices[0].y}`];

    for (let i = 1; i < vertices.length - 1; i++) {
        const prev = vertices[i - 1];
        const curr = vertices[i];
        const next = vertices[i + 1];
        const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
        const r = Math.min(radius, inLen / 2, outLen / 2);

        if (r < 0.5) {
            parts.push(`L${curr.x} ${curr.y}`);
            continue;
        }

        const inX = curr.x - ((curr.x - prev.x) / inLen) * r;
        const inY = curr.y - ((curr.y - prev.y) / inLen) * r;
        const outX = curr.x + ((next.x - curr.x) / outLen) * r;
        const outY = curr.y + ((next.y - curr.y) / outLen) * r;

        parts.push(`L${inX} ${inY}`, `Q${curr.x} ${curr.y} ${outX} ${outY}`);
    }

    const last = vertices[vertices.length - 1];

    parts.push(`L${last.x} ${last.y}`);

    return parts.join(' ');
}

/**
 * An edge with at most one draggable bend, rendered as a single unbroken line with no
 * visible marker at the bend itself. Grabbing anywhere on the edge drags that one point;
 * both arms recompute from it, there is no growing list of waypoints. Double-click the
 * edge to remove the bend.
 */
export function ElbowEdge ({id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, markerStart, data}: EdgeProps<Edge<ElbowEdgeData>>) {
    const {setEdges, screenToFlowPosition} = useReactFlow();
    const draggingRef = useRef(false);
    const bend = data?.bend;
    // Mirrors the same flag react-flow's own <Controls /> lock button toggles — this custom
    // bend-drag is raw pointer-event handling, not react-flow's built-in edge reconnection, so
    // it never respected the interactivity toggle on its own.
    const nodesDraggable = useStore((state) => state.nodesDraggable);

    const path = useMemo(() => {
        const source: Point = {x: sourceX, y: sourceY};
        const target: Point = {x: targetX, y: targetY};
        const points: Point[] = bend ? [source, bend, target] : [source, target];

        let vertices: Point[] = [];

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const entryPosition = i === points.length - 2 ? targetPosition : axisPosition(to.x - from.x, to.y - from.y, false);
            let exitPosition = i === 0 ? sourcePosition : axisPosition(to.x - from.x, to.y - from.y, true);

            // Leaving this leg's start point via the same side the previous leg arrived at it
            // would mean routing straight back through it - an edge doubling back and crossing
            // itself. There's no rounded corner for that case (the pullback/pushforward points
            // mathematically coincide), so route out via the other axis instead: the natural,
            // no-extra-shape way to still head toward wherever the next point actually is.
            if (i > 0) {
                const arrivedFrom = axisPosition(from.x - points[i - 1].x, from.y - points[i - 1].y, false);

                if (exitPosition === arrivedFrom) {
                    const dx = to.x - from.x;
                    const dy = to.y - from.y;

                    exitPosition = axisPosition(dx, dy, true, Math.abs(dx) < Math.abs(dy));
                }
            }

            const [legPath] = getSmoothStepPath({
                sourceX: from.x,
                sourceY: from.y,
                sourcePosition: exitPosition,
                targetX: to.x,
                targetY: to.y,
                targetPosition: entryPosition,
                borderRadius: 0,
            });

            const legVertices = extractVertices(legPath);

            vertices = i === 0 ? legVertices : [...vertices, ...legVertices.slice(1)];
        }

        return roundedPolylinePath(vertices, CORNER_RADIUS);
    }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, bend]);

    const setBend = useCallback((point: Point | undefined) => {
        setEdges((eds) => eds.map((edge) => edge.id === id ? {...edge, data: {...edge.data, bend: point}} : edge));
    }, [id, setEdges]);

    const handlePointerMove = useCallback((event: PointerEvent) => {
        if (!draggingRef.current) return;

        setBend(screenToFlowPosition({x: event.clientX, y: event.clientY}));
    }, [screenToFlowPosition, setBend]);

    const handlePointerUp = useCallback(() => {
        draggingRef.current = false;
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove]);

    const startDrag = useCallback(() => {
        draggingRef.current = true;
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove, handlePointerUp]);

    useEffect(() => () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
    }, [handlePointerMove, handlePointerUp]);

    const handleStrokePointerDown = useCallback((event: React.PointerEvent<SVGPathElement>) => {
        if (!nodesDraggable) return;

        event.stopPropagation();
        setBend(screenToFlowPosition({x: event.clientX, y: event.clientY}));
        startDrag();
    }, [nodesDraggable, screenToFlowPosition, setBend, startDrag]);

    const handleStrokeDoubleClick = useCallback((event: React.MouseEvent<SVGPathElement>) => {
        if (!nodesDraggable) return;

        event.stopPropagation();

        if (bend) setBend(undefined);
    }, [nodesDraggable, bend, setBend]);

    return (
        <>
            <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} markerStart={markerStart} />
            <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="elbow-edge-interaction"
                onPointerDown={handleStrokePointerDown}
                onDoubleClick={handleStrokeDoubleClick}
            />
        </>
    );
}
