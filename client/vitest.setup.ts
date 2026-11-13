// jest-dom's matchers (toBeInTheDocument, ...) need a DOM: only the files that run in jsdom load them.
if (typeof document !== 'undefined') await import('@testing-library/jest-dom/vitest');
