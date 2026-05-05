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