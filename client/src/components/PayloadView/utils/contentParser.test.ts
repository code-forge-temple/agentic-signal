/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {reformatContent} from './contentParser';


const TABLE = '| name | note |\n| --- | --- |\n| a | uses ``` fences |';

describe('reformatContent', () => {
    it('shows a CSV code block as a table, its fence three backticks or longer, as an attached file\'s can be', () => {
        expect(reformatContent('```csv\nname,note\na,plain\n```')).toBe('| name | note |\n| --- | --- |\n| a | plain |');
        expect(reformatContent('Data:\n\n````csv\nname,note\na,uses ``` fences\n````')).toBe(`Data:\n\n${TABLE}`);
    });

    it('leaves a message with an attached Markdown file fenced longer as it is, not wrapped as JavaScript', () => {
        // "const" in the text would get it taken for JavaScript, were the file's block not seen.
        const message = 'Q?\n\n### File name "guide.md"\n````markdown\n# Guide\n\nThe const values stay.\n\n```bash\nnpm start\n```\n````';

        expect(reformatContent(message)).toBe(message);
    });
});
