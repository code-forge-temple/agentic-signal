/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Component, ReactNode} from 'react';

type Props = {
    children: ReactNode;
    onError?: (error: Error) => void;
    fallback?: ReactNode;
};

type State = {
    hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
    state: State = {hasError: false};

    static getDerivedStateFromError (): State {
        return {hasError: true};
    }

    componentDidCatch (error: Error): void {
        this.props.onError?.(error);
    }

    reset (): void {
        this.setState({hasError: false});
    }

    render () {
        if (this.state.hasError) {
            return this.props.fallback ?? null;
        }

        return this.props.children;
    }
}
