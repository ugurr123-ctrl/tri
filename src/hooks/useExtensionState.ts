import { useCallback, useEffect, useState } from 'react';
import { entitlementService } from '../core/entitlement/entitlementService';
import { PLAN_LIMITS, type EntitlementState } from '../core/entitlement/types';
import { toUserErrorMessage } from '../core/errors/ExtensionError';
import {
  createDefaultSettings,
  createDefaultStats,
} from '../data/defaultData';
import { getSettings } from '../services/storage/settingsService';
import {
  ensureStorageInitialized,
  getFolders,
  getSnippets,
} from '../services/storage/snippetRepository';
import { getStats } from '../services/storage/statsService';
import { storageAdapter } from '../services/storage/storageAdapter';
import type {
  ExtensionSettings,
  Folder,
  Snippet,
  UsageStats,
} from '../types/extension';

export interface ExtensionStateSnapshot {
  loading: boolean;
  error: string | null;
  snippets: Snippet[];
  folders: Folder[];
  settings: ExtensionSettings;
  stats: UsageStats;
  entitlement: EntitlementState;
  reload: () => Promise<void>;
  clearError: () => void;
}

const DEFAULT_ENTITLEMENT: EntitlementState = {
  tier: 'free',
  source: 'default-free',
  isDevelopmentPreview: false,
  limits: PLAN_LIMITS.free,
  verifiedAt: null,
};

export function useExtensionState(): ExtensionStateSnapshot {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings>(createDefaultSettings);
  const [stats, setStats] = useState<UsageStats>(createDefaultStats);
  const [entitlement, setEntitlement] = useState<EntitlementState>(DEFAULT_ENTITLEMENT);

  const reload = useCallback(async () => {
    try {
      await ensureStorageInitialized();
      const [nextSnippets, nextFolders, nextSettings, nextStats, nextEntitlement] =
        await Promise.all([
          getSnippets(),
          getFolders(),
          getSettings(),
          getStats(),
          entitlementService.getEntitlement(),
        ]);

      setSnippets(nextSnippets);
      setFolders(nextFolders);
      setSettings(nextSettings);
      setStats(nextStats);
      setEntitlement(nextEntitlement);
      setError(null);
    } catch (err) {
      setError(toUserErrorMessage(err, 'Failed to load local extension data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const unsubscribe = storageAdapter.subscribe(() => {
      void reload();
    });
    return unsubscribe;
  }, [reload]);

  return {
    loading,
    error,
    snippets,
    folders,
    settings,
    stats,
    entitlement,
    reload,
    clearError: () => setError(null),
  };
}
