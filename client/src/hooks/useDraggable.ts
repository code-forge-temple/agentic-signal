/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef, useState} from 'react';


type Position = {
    x: number;
    y: number;
};

type UseDraggableProps = {
    initialPosition?: Position;
    cancelSelector?: string;
};

export const useDraggable = ({
    initialPosition = {x: 0, y: 0},
    cancelSelector,
}: UseDraggableProps = {}) => {
    const elementRef = useRef<HTMLDivElement | null>(null);
    const positionRef = useRef(initialPosition);
    const dragOffsetRef = useRef({x: 0, y: 0});
    const isDraggingRef = useRef(false);
    const [position, setPosition] = useState(initialPosition);
    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement | null;

        if (cancelSelector && target?.closest(cancelSelector)) {
            return;
        }

        e.preventDefault();

        dragOffsetRef.current = {
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y,
        };

        isDraggingRef.current = true;
    }, [cancelSelector]);


    useEffect(() => {
        if (!elementRef.current) {
            return;
        }

        elementRef.current.style.left = `${positionRef.current.x}px`;
        elementRef.current.style.top = `${positionRef.current.y}px`;
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !elementRef.current) {
                return;
            }

            const x = e.clientX - dragOffsetRef.current.x;
            const y = e.clientY - dragOffsetRef.current.y;

            positionRef.current = {x, y};

            elementRef.current.style.left = `${x}px`;
            elementRef.current.style.top = `${y}px`;
        };

        const onMouseUp = () => {
            isDraggingRef.current = false;
            setPosition(positionRef.current);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    return {
        ref: elementRef,
        position,
        onMouseDown,
    };
};