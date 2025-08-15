/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import {YouTubePreview} from '@site/src/components/YouTubePreview';

import styles from './index.module.css';

function HomepageHeader () {
    const {siteConfig} = useDocusaurusContext();

    return (
        <header className={clsx('hero hero--primary', styles.heroBanner)}>
            <div className="container">
                <Heading as="h1" className="hero__title">
                    {siteConfig.title}
                </Heading>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link
                        className="button button--secondary button--lg"
                        to="/docs/getting-started/installation">
            Get Started
                    </Link>
                </div>
            </div>
        </header>
    );
}

// eslint-disable-next-line no-restricted-exports
export default function Home (): ReactNode {
    const {siteConfig} = useDocusaurusContext();

    return (
        <Layout
            title={`Hello from ${siteConfig.title}`}
            description="Description will go into a meta tag in <head />">
            <HomepageHeader />
            <YouTubePreview url="https://www.youtube.com/watch?v=62zk8zE6UJI" />
            <main>
                <HomepageFeatures />
            </main>
        </Layout>
    );
}
