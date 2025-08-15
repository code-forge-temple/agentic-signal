/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEFAULT_EDGE_ANIMATION_DURATION = 500;

export const runTask = async (task: () => Promise<void>, setIsRunning: (isRunning: boolean) => void) => {
    setIsRunning(true);

    const startTime = performance.now();

    await sleep(DEFAULT_EDGE_ANIMATION_DURATION);
    await task();

    const endTime = performance.now();

    setTimeout(() => {
        setIsRunning(false);
    }, Math.max(0, DEFAULT_EDGE_ANIMATION_DURATION - (endTime - startTime)));
};