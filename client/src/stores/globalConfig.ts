import {create} from 'zustand';

const GLOBAL_CONFIG_STORAGE_PREFIX = 'agentic-signal.globalData.';

const loadPersistedGlobalData = (): {[key: string]: string | undefined} => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return {};
    }

    const persisted: {[key: string]: string | undefined} = {};

    for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);

        if (!storageKey?.startsWith(GLOBAL_CONFIG_STORAGE_PREFIX)) {
            continue;
        }

        const key = storageKey.substring(GLOBAL_CONFIG_STORAGE_PREFIX.length);
        const value = localStorage.getItem(storageKey);

        if (value !== null) {
            persisted[key] = value;
        }
    }

    return persisted;
};

const hasLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

type GlobalConfig = {
    globalData: {
        [key: string]: string | undefined;
    };
    setGlobalData: (key: string, value: string, persist?: boolean) => void;
};

export const useGlobalConfig = create<GlobalConfig>((set) => ({
    globalData: loadPersistedGlobalData(),
    setGlobalData: (key, value, persist = false) => {
        if (persist && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            const storageKey = `${GLOBAL_CONFIG_STORAGE_PREFIX}${key}`;

            if (value === '') {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, value);
            }
        }

        set((state) => ({globalData: {...state.globalData, [key]: value}}));
    },
}));

/**
 * Reads the persisted value straight from localStorage rather than from the in-memory mirror.
 *
 * The mirror is a snapshot taken once, at module import, and nothing refreshes it — so a
 * read-modify-write built on it would serialise a view of the world from before another tab's
 * changes, silently dropping them. localStorage is the one thing two tabs actually share, so
 * reading it at the moment of writing is what keeps a multi-tab merge honest.
 *
 * Falls back to the mirror when storage is unavailable (private mode, blocked site data).
 */
export const getPersistedValue = (key: string): string | undefined => {
    if (!hasLocalStorage()) return useGlobalConfig.getState().globalData[key];

    return localStorage.getItem(`${GLOBAL_CONFIG_STORAGE_PREFIX}${key}`) ?? undefined;
};

/*
 * Keeps the mirror live when another tab writes. The `storage` event fires only in OTHER tabs,
 * never the one that made the change, so this can't double-apply locally. Without it the app
 * would stop losing data but still render values from page load until a reload.
 */
if (hasLocalStorage()) {
    window.addEventListener('storage', (event) => {
        // A null key means localStorage.clear() — resync wholesale rather than guessing.
        if (event.key === null) {
            useGlobalConfig.setState({globalData: loadPersistedGlobalData()});

            return;
        }

        if (!event.key.startsWith(GLOBAL_CONFIG_STORAGE_PREFIX)) return;

        const key = event.key.substring(GLOBAL_CONFIG_STORAGE_PREFIX.length);

        useGlobalConfig.setState((state) => ({
            // A null newValue means the key was removed.
            globalData: {...state.globalData, [key]: event.newValue ?? undefined},
        }));
    });
}