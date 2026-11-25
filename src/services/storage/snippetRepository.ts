import { entitlementService } from '../../core/entitlement/entitlementService';
import { ExtensionError } from '../../core/errors/ExtensionError';
import {
  generateSafeId,
  MAX_FOLDER_NAME_LENGTH,
  MAX_SNIPPET_CONTENT_LENGTH,
  MAX_SNIPPET_NAME_LENGTH,
  sanitizePlainText,
  sanitizeSingleLine,
  validateShortcut,
} from '../../core/sanitize/sanitize';
import {
  createDefaultFolders,
  createDefaultSettings,
  createDefaultSnippets,
  createDefaultStats,
} from '../../data/defaultData';
import {
  STORAGE_KEYS,
  type Folder,
  type Snippet,
} from '../../types/extension';
import { storageAdapter } from './storageAdapter';

export interface SnippetInput {
  name: string;
  shortcut: string;
  content: string;
  folderId: string | null;
  enabled?: boolean;
}

export async function ensureStorageInitialized(): Promise<void> {
  const initialized = await storageAdapter.get<boolean>(STORAGE_KEYS.INITIALIZED);
  if (initialized) {
    return;
  }

  const now = new Date().toISOString();
  await storageAdapter.setMany({
    [STORAGE_KEYS.INITIALIZED]: true,
    [STORAGE_KEYS.FOLDERS]: createDefaultFolders(now),
    [STORAGE_KEYS.SNIPPETS]: createDefaultSnippets(now),
    [STORAGE_KEYS.SETTINGS]: createDefaultSettings(),
    [STORAGE_KEYS.STATS]: createDefaultStats(),
  });
}

export async function getSnippets(): Promise<Snippet[]> {
  await ensureStorageInitialized();
  const list = await storageAdapter.get<Snippet[]>(STORAGE_KEYS.SNIPPETS);
  return Array.isArray(list) ? list : [];
}

export async function getFolders(): Promise<Folder[]> {
  await ensureStorageInitialized();
  const list = await storageAdapter.get<Folder[]>(STORAGE_KEYS.FOLDERS);
  return Array.isArray(list) ? list : [];
}

export function findShortcutConflict(
  snippets: Snippet[],
  shortcut: string,
  caseSensitive: boolean,
  excludeSnippetId?: string,
): Snippet | null {
  const target = caseSensitive ? shortcut : shortcut.toLowerCase();
  for (const s of snippets) {
    if (excludeSnippetId && s.id === excludeSnippetId) continue;
    const candidate = caseSensitive ? s.shortcut : s.shortcut.toLowerCase();
    if (candidate === target) {
      return s;
    }
  }
  return null;
}

export function findAllDuplicateShortcuts(
  snippets: Snippet[],
  caseSensitive: boolean,
): Set<string> {
  const counts = new Map<string, number>();
  for (const s of snippets) {
    const key = caseSensitive ? s.shortcut : s.shortcut.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  counts.forEach((count, key) => {
    if (count > 1) {
      duplicates.add(key);
    }
  });
  return duplicates;
}

export async function createSnippet(
  input: SnippetInput,
  caseSensitive = false,
): Promise<Snippet> {
  const [snippets, entitlement] = await Promise.all([
    getSnippets(),
    entitlementService.getEntitlement(),
  ]);

  if (snippets.length >= entitlement.limits.maxSnippets) {
    throw new ExtensionError(
      'QUOTA_SNIPPETS_EXCEEDED',
      `Free plan includes up to ${entitlement.limits.maxSnippets} snippets. Delete an existing snippet or upgrade to Pro for unlimited snippets.`,
    );
  }

  const shortcutCheck = validateShortcut(input.shortcut);
  if (!shortcutCheck.valid) {
    throw new ExtensionError(
      'INVALID_SHORTCUT',
      shortcutCheck.error ?? 'Invalid shortcut format.',
    );
  }

  const conflict = findShortcutConflict(snippets, shortcutCheck.normalized, caseSensitive);
  if (conflict) {
    throw new ExtensionError(
      'DUPLICATE_SHORTCUT',
      `The shortcut "${shortcutCheck.normalized}" is already used by "${conflict.name}".`,
    );
  }

  const content = sanitizePlainText(input.content, MAX_SNIPPET_CONTENT_LENGTH);
  if (!content.trim()) {
    throw new ExtensionError('INVALID_INPUT', 'Snippet content cannot be empty.');
  }

  const name =
    sanitizeSingleLine(input.name, MAX_SNIPPET_NAME_LENGTH) || shortcutCheck.normalized;

  const now = new Date().toISOString();
  const created: Snippet = {
    id: generateSafeId('snp'),
    name,
    shortcut: shortcutCheck.normalized,
    content,
    folderId: input.folderId ?? null,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    lastUsedAt: null,
  };

  await storageAdapter.set(STORAGE_KEYS.SNIPPETS, [created, ...snippets]);
  return created;
}

export async function updateSnippet(
  id: string,
  patch: Partial<SnippetInput>,
  caseSensitive = false,
): Promise<Snippet> {
  const snippets = await getSnippets();
  const index = snippets.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new ExtensionError('INVALID_INPUT', 'Snippet not found.');
  }

  const existing = snippets[index];
  let nextShortcut = existing.shortcut;

  if (patch.shortcut !== undefined) {
    const shortcutCheck = validateShortcut(patch.shortcut);
    if (!shortcutCheck.valid) {
      throw new ExtensionError(
        'INVALID_SHORTCUT',
        shortcutCheck.error ?? 'Invalid shortcut format.',
      );
    }
    const conflict = findShortcutConflict(snippets, shortcutCheck.normalized, caseSensitive, id);
    if (conflict) {
      throw new ExtensionError(
        'DUPLICATE_SHORTCUT',
        `The shortcut "${shortcutCheck.normalized}" is already used by "${conflict.name}".`,
      );
    }
    nextShortcut = shortcutCheck.normalized;
  }

  const nextContent =
    patch.content !== undefined
      ? sanitizePlainText(patch.content, MAX_SNIPPET_CONTENT_LENGTH)
      : existing.content;

  if (!nextContent.trim()) {
    throw new ExtensionError('INVALID_INPUT', 'Snippet content cannot be empty.');
  }

  const nextName =
    patch.name !== undefined
      ? sanitizeSingleLine(patch.name, MAX_SNIPPET_NAME_LENGTH) || nextShortcut
      : existing.name;

  const updated: Snippet = {
    ...existing,
    name: nextName,
    shortcut: nextShortcut,
    content: nextContent,
    folderId: patch.folderId !== undefined ? patch.folderId : existing.folderId,
    enabled: patch.enabled !== undefined ? patch.enabled : existing.enabled,
    updatedAt: new Date().toISOString(),
  };

  const nextList = [...snippets];
  nextList[index] = updated;
  await storageAdapter.set(STORAGE_KEYS.SNIPPETS, nextList);
  return updated;
}

export async function duplicateSnippet(id: string, caseSensitive = false): Promise<Snippet> {
  const [snippets, entitlement] = await Promise.all([
    getSnippets(),
    entitlementService.getEntitlement(),
  ]);

  if (snippets.length >= entitlement.limits.maxSnippets) {
    throw new ExtensionError(
      'QUOTA_SNIPPETS_EXCEEDED',
      `Free plan includes up to ${entitlement.limits.maxSnippets} snippets. Upgrade to Pro for unlimited snippets.`,
    );
  }

  const original = snippets.find((s) => s.id === id);
  if (!original) {
    throw new ExtensionError('INVALID_INPUT', 'Snippet not found.');
  }

  // Generate unique shortcut suffix (e.g. /thanks -> /thanks2)
  let suffix = 2;
  let candidate = `${original.shortcut.slice(0, 29)}${suffix}`;
  while (findShortcutConflict(snippets, candidate, caseSensitive)) {
    suffix++;
    candidate = `${original.shortcut.slice(0, 28)}${suffix}`;
  }

  return createSnippet(
    {
      name: `${original.name} (Copy)`,
      shortcut: candidate,
      content: original.content,
      folderId: original.folderId,
      enabled: original.enabled,
    },
    caseSensitive,
  );
}

export async function deleteSnippet(id: string): Promise<void> {
  const snippets = await getSnippets();
  await storageAdapter.set(
    STORAGE_KEYS.SNIPPETS,
    snippets.filter((s) => s.id !== id),
  );
}

export async function toggleSnippetEnabled(id: string, enabled: boolean): Promise<Snippet> {
  return updateSnippet(id, { enabled });
}

export async function createFolder(nameInput: string): Promise<Folder> {
  const [folders, entitlement] = await Promise.all([
    getFolders(),
    entitlementService.getEntitlement(),
  ]);

  if (folders.length >= entitlement.limits.maxFolders) {
    throw new ExtensionError(
      'QUOTA_FOLDERS_EXCEEDED',
      `Free plan includes up to ${entitlement.limits.maxFolders} folders. Upgrade to Pro for unlimited folders.`,
    );
  }

  const name = sanitizeSingleLine(nameInput, MAX_FOLDER_NAME_LENGTH);
  if (!name) {
    throw new ExtensionError('INVALID_INPUT', 'Folder name cannot be empty.');
  }

  if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    throw new ExtensionError('INVALID_INPUT', `A folder named "${name}" already exists.`);
  }

  const now = new Date().toISOString();
  const folder: Folder = {
    id: generateSafeId('fld'),
    name,
    createdAt: now,
    updatedAt: now,
  };

  await storageAdapter.set(STORAGE_KEYS.FOLDERS, [...folders, folder]);
  return folder;
}

export async function renameFolder(id: string, nameInput: string): Promise<Folder> {
  const folders = await getFolders();
  const name = sanitizeSingleLine(nameInput, MAX_FOLDER_NAME_LENGTH);
  if (!name) {
    throw new ExtensionError('INVALID_INPUT', 'Folder name cannot be empty.');
  }

  const index = folders.findIndex((f) => f.id === id);
  if (index === -1) {
    throw new ExtensionError('INVALID_INPUT', 'Folder not found.');
  }

  if (folders.some((f) => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) {
    throw new ExtensionError('INVALID_INPUT', `A folder named "${name}" already exists.`);
  }

  const updated: Folder = {
    ...folders[index],
    name,
    updatedAt: new Date().toISOString(),
  };

  const next = [...folders];
  next[index] = updated;
  await storageAdapter.set(STORAGE_KEYS.FOLDERS, next);
  return updated;
}

export async function deleteFolder(id: string): Promise<void> {
  const [folders, snippets] = await Promise.all([getFolders(), getSnippets()]);
  const nextFolders = folders.filter((f) => f.id !== id);
  const nextSnippets = snippets.map((s) =>
    s.folderId === id ? { ...s, folderId: null, updatedAt: new Date().toISOString() } : s,
  );
  await storageAdapter.setMany({
    [STORAGE_KEYS.FOLDERS]: nextFolders,
    [STORAGE_KEYS.SNIPPETS]: nextSnippets,
  });
}
