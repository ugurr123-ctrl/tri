import { entitlementService } from '../../core/entitlement/entitlementService';
import { ExtensionError } from '../../core/errors/ExtensionError';
import { parseAndSanitizeBackup } from '../../core/sanitize/sanitize';
import {
  createDefaultFolders,
  createDefaultSettings,
  createDefaultSnippets,
  createDefaultStats,
} from '../../data/defaultData';
import {
  STORAGE_KEYS,
  type BackupPayload,
  type Folder,
  type Snippet,
} from '../../types/extension';
import { getSettings } from './settingsService';
import { getFolders, getSnippets } from './snippetRepository';
import { storageAdapter } from './storageAdapter';

export interface BackupImportResult {
  addedSnippets: number;
  skippedDuplicates: number;
  truncatedByQuota: number;
  addedFolders: number;
}

export async function createBackupJson(): Promise<string> {
  const [snippets, folders, settings] = await Promise.all([
    getSnippets(),
    getFolders(),
    getSettings(),
  ]);

  const payload: BackupPayload = {
    schemaVersion: 1,
    app: 'tavriqelo',
    exportedAt: new Date().toISOString(),
    snippets,
    folders,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importBackupJson(
  rawJson: string,
  mode: 'merge' | 'replace',
): Promise<BackupImportResult> {
  const parsed = parseAndSanitizeBackup(rawJson);
  const [existingSnippets, existingFolders, existingSettings, entitlement] = await Promise.all([
    getSnippets(),
    getFolders(),
    getSettings(),
    entitlementService.getEntitlement(),
  ]);

  const maxSnippets = entitlement.limits.maxSnippets;
  const maxFolders = entitlement.limits.maxFolders;

  if (mode === 'replace') {
    const foldersToSave: Folder[] = parsed.folders.slice(
      0,
      Number.isFinite(maxFolders) ? maxFolders : parsed.folders.length,
    );
    const validFolderIds = new Set(foldersToSave.map((f) => f.id));

    const seenShortcuts = new Set<string>();
    const dedupedSnippets: Snippet[] = [];
    let skippedDuplicates = 0;

    for (const s of parsed.snippets) {
      const key = parsed.settings.caseSensitiveShortcuts ? s.shortcut : s.shortcut.toLowerCase();
      if (seenShortcuts.has(key)) {
        skippedDuplicates++;
        continue;
      }
      seenShortcuts.add(key);
      dedupedSnippets.push({
        ...s,
        folderId: s.folderId && validFolderIds.has(s.folderId) ? s.folderId : null,
      });
    }

    const limit = Number.isFinite(maxSnippets) ? maxSnippets : dedupedSnippets.length;
    const snippetsToSave = dedupedSnippets.slice(0, limit);
    const truncatedByQuota = Math.max(0, dedupedSnippets.length - snippetsToSave.length);

    await storageAdapter.setMany({
      [STORAGE_KEYS.INITIALIZED]: true,
      [STORAGE_KEYS.FOLDERS]: foldersToSave,
      [STORAGE_KEYS.SNIPPETS]: snippetsToSave,
      [STORAGE_KEYS.SETTINGS]: parsed.settings,
    });

    return {
      addedSnippets: snippetsToSave.length,
      skippedDuplicates,
      truncatedByQuota,
      addedFolders: foldersToSave.length,
    };
  }

  // Merge mode
  const nextFolders = [...existingFolders];
  const folderIdRemap = new Map<string, string>();
  let addedFolders = 0;

  for (const incomingFolder of parsed.folders) {
    const existingMatch = nextFolders.find(
      (f) => f.name.toLowerCase() === incomingFolder.name.toLowerCase(),
    );
    if (existingMatch) {
      folderIdRemap.set(incomingFolder.id, existingMatch.id);
    } else if (nextFolders.length < maxFolders) {
      nextFolders.push(incomingFolder);
      folderIdRemap.set(incomingFolder.id, incomingFolder.id);
      addedFolders++;
    }
  }

  const nextSnippets = [...existingSnippets];
  const existingShortcutSet = new Set(
    existingSnippets.map((s) =>
      existingSettings.caseSensitiveShortcuts ? s.shortcut : s.shortcut.toLowerCase(),
    ),
  );

  let addedSnippets = 0;
  let skippedDuplicates = 0;
  let truncatedByQuota = 0;

  for (const incomingSnippet of parsed.snippets) {
    const key = existingSettings.caseSensitiveShortcuts
      ? incomingSnippet.shortcut
      : incomingSnippet.shortcut.toLowerCase();
    if (existingShortcutSet.has(key)) {
      skippedDuplicates++;
      continue;
    }
    if (nextSnippets.length >= maxSnippets) {
      truncatedByQuota++;
      continue;
    }
    existingShortcutSet.add(key);
    const mappedFolderId = incomingSnippet.folderId
      ? folderIdRemap.get(incomingSnippet.folderId) ?? null
      : null;

    nextSnippets.push({
      ...incomingSnippet,
      folderId: mappedFolderId,
    });
    addedSnippets++;
  }

  const mergedExcludedDomains = Array.from(
    new Set([...existingSettings.excludedDomains, ...parsed.settings.excludedDomains]),
  );

  await storageAdapter.setMany({
    [STORAGE_KEYS.FOLDERS]: nextFolders,
    [STORAGE_KEYS.SNIPPETS]: nextSnippets,
    [STORAGE_KEYS.SETTINGS]: {
      ...existingSettings,
      excludedDomains: mergedExcludedDomains,
    },
  });

  return {
    addedSnippets,
    skippedDuplicates,
    truncatedByQuota,
    addedFolders,
  };
}

export async function resetAllLocalData(): Promise<void> {
  try {
    const now = new Date().toISOString();
    await storageAdapter.setMany({
      [STORAGE_KEYS.INITIALIZED]: true,
      [STORAGE_KEYS.FOLDERS]: createDefaultFolders(now),
      [STORAGE_KEYS.SNIPPETS]: createDefaultSnippets(now),
      [STORAGE_KEYS.SETTINGS]: createDefaultSettings(),
      [STORAGE_KEYS.STATS]: createDefaultStats(),
    });
  } catch (cause) {
    throw new ExtensionError(
      'STORAGE_WRITE_FAILED',
      'Failed to reset local data.',
      { cause },
    );
  }
}
