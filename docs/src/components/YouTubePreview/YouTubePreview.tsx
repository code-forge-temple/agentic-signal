/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable max-len */
import React from 'react';
import './style.css';

type YouTubePreviewProps = {
    url: string;
};

function getYouTubeId (url: string): string | null {
    const match = url.match(
        /(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );

    return match ? match[1] : null;
}

export function YouTubePreview ({url}: YouTubePreviewProps) {
    const videoId = getYouTubeId(url);

    if (!videoId) return null;

    return (
        <div className="youtube-preview-container">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="youtube-preview-link"
            >
                <img
                    src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                    alt="Watch on YouTube"
                    className="youtube-preview-img"
                />
                <span className="youtube-preview-play">
                    <svg width="64" height="45" viewBox="0 0 128 90" xmlns="http://www.w3.org/2000/svg" role="img">
                        <path d="M123.5 15.1c-1.5-5.6-5.9-10-11.5-11.5C103.5 2 64 2 64 2S24.5 2 16 3.6C10.4 5.1 6 9.5 4.5 15.1 3 23.6 3 45 3 45s0 21.4 1.5 29.9c1.5 5.6 5.9 10 11.5 11.5C24.5 88 64 88 64 88s39.5 0 48-1.6c5.6-1.5 10-5.9 11.5-11.5C125 66.4 125 45 125 45s0-21.4-1.5-29.9z" fill="#FF0000" />
                        <polygon points="51,30 85,45 51,60" fill="#FFFFFF" />
                    </svg>
                </span>
            </a>
        </div>
    );
}