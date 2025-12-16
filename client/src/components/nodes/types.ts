/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export type Position = { x: number; y: number };

export type DataNode = {
    data: any;
}

export type NodeDescriptor<T extends string, N extends DataNode> = {
    type: T;
    component: React.ComponentType<any>;
    icon: React.ReactElement<{className?: string}>;
    title: string;
    assertion: (data: unknown) => void;
    defaultData: N["data"];
};