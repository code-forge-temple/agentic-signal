/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable @typescript-eslint/no-require-imports */
import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Img: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
    {
        title: 'Visual Workflow Automation',
        Img: require('@site/static/img/visual_workflow_automation.png').default,
        description: (
            <>
        Design, connect, and automate AI-powered workflows visually—no coding required. Drag, drop, and orchestrate your data and AI agents with ease.
            </>
        ),
    },
    {
        title: 'Local Agent Intelligence',
        Img: require('@site/static/img/local-agent-intelligence.png').default,
        description: (
            <>
        Run advanced AI agents locally for privacy and speed. Integrate with your own models and tools, keeping your data secure and under your control.
            </>
        ),
    },
    {
        title: 'Extensible Node Ecosystem',
        Img: require('@site/static/img/extensible-node-ecosystem.png').default,
        description: (
            <>
        Expand your workflows with a growing library of nodes for data, APIs, and AI. Build custom nodes to fit your unique automation needs.
            </>
        ),
    },
];

function Feature ({title, Img, description}: FeatureItem) {
    return (
        <div className={clsx('col col--4')}>
            <div className="text--center">
                <img src={Img} className={styles.featureSvg} alt={title} />
            </div>
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
        </div>
    );
}

// eslint-disable-next-line no-restricted-exports
export default function HomepageFeatures (): ReactNode {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {FeatureList.map((props, idx) => (
                        <Feature key={idx} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
}
