/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const TITLE = 'Agentic Signal';
const TAGLINE = 'Visual AI Workflow Automation Platform with Local Agent Intelligence';

const config: Config = {
    title: TITLE,
    tagline: TAGLINE,
    favicon: 'img/logo.svg',

    future: {
        v4: true,
    },

    url: 'https://agentic-signal.com',
    baseUrl: '/',

    organizationName: 'code-forge-temple',
    projectName: 'agentic-signal',

    deploymentBranch: 'gh-pages',
    trailingSlash: false,

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    editUrl: undefined,
                },
                theme: {
                    customCss: './src/css/custom.css',
                },
                sitemap: {
                    lastmod: 'date',
                    changefreq: 'weekly',
                    priority: 0.5,
                    ignorePatterns: ['/tags/**'],
                    filename: 'sitemap.xml',
                    createSitemapItems: async (params) => {
                        const {defaultCreateSitemapItems, ...rest} = params;
                        const items = await defaultCreateSitemapItems(rest);

                        const filteredItems = items.filter((item) => !item.url.includes('/page/'));

                        filteredItems.push({
                            url: 'https://pricing.agentic-signal.com',
                            changefreq: 'weekly',
                            priority: 0.7,
                            lastmod: new Date().toISOString(),
                        });

                        return filteredItems;
                    },
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        image: '/img/logo.svg',
        colorMode: {
            defaultMode: 'dark',
            disableSwitch: false,
            respectPrefersColorScheme: false,
        },
        navbar: {
            title: TITLE,
            logo: {
                alt: 'Agentic Signal Logo',
                src: 'img/logo.svg',
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'nodesSidebar',
                    position: 'left',
                    label: 'Nodes',
                },
                {
                    type: 'docSidebar',
                    sidebarId: 'workflowsSidebar',
                    position: 'left',
                    label: 'Workflows',
                },
                {
                    type: 'docSidebar',
                    sidebarId: 'gettingStartedSidebar',
                    position: 'left',
                    label: 'Getting Started',
                },
                {
                    label: 'Pricing',
                    href: 'https://pricing.agentic-signal.com',
                    position: 'left',
                    target: '_self',
                },
                {
                    href: 'https://github.com/code-forge-temple/agentic-signal',
                    label: 'GitHub',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Documentation',
                    items: [
                        {
                            label: 'Getting Started',
                            to: '/docs/getting-started/installation',
                        },
                        {
                            label: 'Nodes Reference',
                            to: '/docs/nodes/overview',
                        },
                        {
                            label: 'Workflow Examples',
                            to: '/docs/workflows/overview',
                        },
                    ],
                },
                {
                    title: 'Community',
                    items: [
                        {
                            label: 'GitHub Discussions',
                            href: 'https://github.com/code-forge-temple/agentic-signal/discussions',
                        },
                        {
                            label: 'GitHub Issues',
                            href: 'https://github.com/code-forge-temple/agentic-signal/issues',
                        },
                    ],
                },
                {
                    title: 'More',
                    items: [
                        {
                            label: 'GitHub',
                            href: 'https://github.com/code-forge-temple/agentic-signal',
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Code Forge Temple. Built with Docusaurus.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['typescript', 'javascript', 'json', 'bash'],
        },
        metadata: [
            {name: 'og:title', content: TITLE},
            {name: 'og:description', content: TAGLINE},
            {name: 'og:image', content: '/img/logo.svg'},
            {name: 'twitter:card', content: 'summary_large_image'},
            {name: 'twitter:title', content: TITLE},
            {name: 'twitter:description', content: TAGLINE},
            {name: 'twitter:image', content: '/img/logo.svg'},
        ],
    } satisfies Preset.ThemeConfig,
};

// eslint-disable-next-line no-restricted-exports
export default config;