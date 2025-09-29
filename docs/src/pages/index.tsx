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
import {useState, useRef, useEffect} from 'react';

import styles from './index.module.css';

function clamp (val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
}

const MAX_GRADIENT_ANGLE = 26;
const MIN_GRADIENT_ANGLE = 10;
const INITIAL_GRADIENT_ANGLE = (MAX_GRADIENT_ANGLE + MIN_GRADIENT_ANGLE) / 2;

function HomepageHeader () {
    const {siteConfig} = useDocusaurusContext();
    const [gradientAngle, setGradientAngle] = useState(INITIAL_GRADIENT_ANGLE);
    const targetAngleRef = useRef(INITIAL_GRADIENT_ANGLE);

    useEffect(() => {
        function handleMouseMove (e: MouseEvent) {
            const centerX = window.innerWidth / 2;
            const relativeX = e.clientX - centerX;
            const normalized = clamp(relativeX / centerX, -1, 1);
            const angle = INITIAL_GRADIENT_ANGLE + normalized * (MAX_GRADIENT_ANGLE - INITIAL_GRADIENT_ANGLE);

            targetAngleRef.current = clamp(angle, MIN_GRADIENT_ANGLE, MAX_GRADIENT_ANGLE);
        }

        window.addEventListener('mousemove', handleMouseMove);

        let animationFrame: number;

        function animate () {
            setGradientAngle(prev => {
                const diff = targetAngleRef.current - prev;

                if (Math.abs(diff) < 0.1) return targetAngleRef.current;

                return prev + diff * 0.08;
            });
            animationFrame = requestAnimationFrame(animate);
        }

        animate();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrame);
        };
    }, []);

    return (
        <header
            className={clsx('hero hero--primary', styles.heroBanner)}
            style={{
                backgroundImage: `linear-gradient(-${gradientAngle}deg, #00ccff, #5b42e5, #9015ac)`
            }}
        >
            <div className="container">
                <Heading as="h1" className="hero__title">
                    {siteConfig.title}
                </Heading>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className={styles.buttons}>
                    <Link
                        className="button button--secondary button--lg"
                        to="/docs/getting-started/windows-app/quick-start">
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
