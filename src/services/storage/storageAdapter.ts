import { ExtensionError } from '../../core/errors/ExtensionError';

type StorageChangeListener = (changedKeys: string[]) => void;

const LOCAL_FALLBACK_PREFIX = 'tavriqelo_dev_fallback:';
const fallbackListeners = new Set<StorageChangeListener>();

export function isChromeExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

class StorageAdapter {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (isChromeExtensionContext()) {
        const result = await chrome.storage.local.get(key);
        return result[key] as T | undefined;
      }
      const raw = window.localStorage.getItem(`${LOCAL_FALLBACK_PREFIX}${key}`);
      return raw !== null ? (JSON.parse(raw) as T) : undefined;
    } catch (cause) {
      throw new ExtensionError(
        'STORAGE_READ_FAILED',
        'Could not read local extension storage.',
        { cause },
      );
    }
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    try {
      if (isChromeExtensionContext()) {
        return await chrome.storage.local.get(keys);
      }
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        const raw = window.localStorage.getItem(`${LOCAL_FALLBACK_PREFIX}${key}`);
        if (raw !== null) {
          result[key] = JSON.parse(raw);
        }
      }
      return result;
    } catch (cause) {
      throw new ExtensionError(
        'STORAGE_READ_FAILED',
        'Could not read local extension storage.',
        { cause },
      );
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      if (isChromeExtensionContext()) {
        await chrome.storage.local.set({ [key]: value });
        return;
      }
      window.localStorage.setItem(`${LOCAL_FALLBACK_PREFIX}${key}`, JSON.stringify(value));
      fallbackListeners.forEach((listener) => listener([key]));
    } catch (cause) {
      throw new ExtensionError(
        'STORAGE_WRITE_FAILED',
        'Could not save changes to local storage.',
        { cause },
      );
    }
  }

  async setMany(entries: Record<string, unknown>): Promise<void> {
    try {
      if (isChromeExtensionContext()) {
        await chrome.storage.local.set(entries);
        return;
      }
      const keys = Object.keys(entries);
      for (const key of keys) {
        window.localStorage.setItem(
          `${LOCAL_FALLBACK_PREFIX}${key}`,
          JSON.stringify(entries[key]),
        );
      }
      fallbackListeners.forEach((listener) => listener(keys));
    } catch (cause) {
      throw new ExtensionError(
        'STORAGE_WRITE_FAILED',
        'Could not save changes to local storage.',
        { cause },
      );
    }
  }

  async remove(keys: string[]): Promise<void> {
    try {
      if (isChromeExtensionContext()) {
        await chrome.storage.local.remove(keys);
        return;
      }
      for (const key of keys) {
        window.localStorage.removeItem(`${LOCAL_FALLBACK_PREFIX}${key}`);
      }
      fallbackListeners.forEach((listener) => listener(keys));
    } catch (cause) {
      throw new ExtensionError(
        'STORAGE_WRITE_FAILED',
        'Could not clear local storage entries.',
        { cause },
      );
    }
  }

  subscribe(listener: StorageChangeListener): () => void {
    if (isChromeExtensionContext()) {
      const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName === 'local') {
          listener(Object.keys(changes));
        }
      };
      chrome.storage.onChanged.addListener(handler);
      return () => {
        chrome.storage.onChanged.removeListener(handler);
      };
    }

    fallbackListeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith(LOCAL_FALLBACK_PREFIX)) {
        listener([event.key.slice(LOCAL_FALLBACK_PREFIX.length)]);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      fallbackListeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }
}

export const storageAdapter = new StorageAdapter();
