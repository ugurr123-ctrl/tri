import { ExtensionError } from '../errors/ExtensionError';
import type {
  BackupPayload,
  CustomVariable,
  ExtensionSettings,
  Folder,
  Snippet,
} from '../../types/extension';

const CONTROL_CHARS_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ALL_CONTROL_AND_WHITESPACE = /[\u0000-\u001F\u007F\s]+/g;

export const MAX_SHORTCUT_LENGTH = 32;
export const MIN_SHORTCUT_LENGTH = 2;
export const MAX_SNIPPET_CONTENT_LENGTH = 20000;
export const MAX_SNIPPET_NAME_LENGTH = 100;
export const MAX_FOLDER_NAME_LENGTH = 60;
export const MAX_VARIABLE_VALUE_LENGTH = 2000;

/**
 * Strips unsafe control characters and normalizes line endings while preserving plain text.
 * Never evaluates HTML or scripts.
 */
export function sanitizePlainText(input: string, maxLength = MAX_SNIPPET_CONTENT_LENGTH): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE_TAB, '')
    .slice(0, maxLength);
}

/**
 * Sanitizes single-line labels (snippet names, folder names, variable labels).
 */
export function sanitizeSingleLine(input: string, maxLength = MAX_SNIPPET_NAME_LENGTH): string {
  return sanitizePlainText(input, maxLength)
    .replace(/[\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Normalizes a keyboard shortcut: removes spaces/control characters and validates length.
 */
export function normalizeShortcut(raw: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.trim().replace(ALL_CONTROL_AND_WHITESPACE, '').slice(0, MAX_SHORTCUT_LENGTH);
}

export function validateShortcut(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeShortcut(raw);
  if (normalized.length < MIN_SHORTCUT_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Shortcut must be at least ${MIN_SHORTCUT_LENGTH} characters with no spaces.`,
    };
  }
  if (normalized.length > MAX_SHORTCUT_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Shortcut cannot exceed ${MAX_SHORTCUT_LENGTH} characters.`,
    };
  }
  return { valid: true, normalized };
}

/**
 * Normalizes a custom variable key to safe identifier characters.
 */
export function sanitizeVariableKey(raw: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

/**
 * Validates and normalizes a domain exclusion entry (e.g. "bank.example.com" or "*.stripe.com").
 */
export function normalizeDomainPattern(raw: string): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  let cleaned = raw.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }

  // Strip protocol if pasted as a URL
  cleaned = cleaned.replace(/^https?:\/\//, '');
  // Strip path, query, hash, and port
  cleaned = cleaned.split(/[/?#]/)[0];
  cleaned = cleaned.replace(/:\d+$/, '');

  const wildcardPrefix = cleaned.startsWith('*.');
  const hostPart = wildcardPrefix ? cleaned.slice(2) : cleaned;

  // Validate hostname format
  if (
    !hostPart ||
    hostPart.length > 253 ||
    !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostPart)
  ) {
    return null;
  }

  return wildcardPrefix ? `*.${hostPart}` : hostPart;
}

export function generateSafeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Strictly validates and sanitizes an imported JSON backup payload.
 */
export function parseAndSanitizeBackup(rawJson: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (cause) {
    throw new ExtensionError(
      'INVALID_BACKUP_FORMAT',
      'The selected file is not valid JSON.',
      { cause },
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ExtensionError(
      'INVALID_BACKUP_FORMAT',
      'Backup file must contain a valid Tavriqelo JSON object.',
    );
  }

  const record = parsed as Record<string, unknown>;
  if (record.app !== 'tavriqelo' || !Array.isArray(record.snippets)) {
    throw new ExtensionError(
      'INVALID_BACKUP_FORMAT',
      'This file does not match the Tavriqelo backup schema.',
    );
  }

  const now = new Date().toISOString();

  // Sanitize folders
  const rawFolders = Array.isArray(record.folders) ? record.folders : [];
  const validFolderIds = new Set<string>();
  const folders: Folder[] = [];

  for (const item of rawFolders) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const name = sanitizeSingleLine(String(f.name ?? ''), MAX_FOLDER_NAME_LENGTH);
    if (!name) continue;
    const id =
      typeof f.id === 'string' && f.id.trim().length > 0
        ? sanitizeSingleLine(f.id, 64)
        : generateSafeId('fld');
    if (validFolderIds.has(id)) continue;
    validFolderIds.add(id);
    folders.push({
      id,
      name,
      createdAt: typeof f.createdAt === 'string' ? f.createdAt : now,
      updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : now,
    });
  }

  // Sanitize snippets
  const snippets: Snippet[] = [];
  const seenIds = new Set<string>();

  for (const item of record.snippets) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const shortcutCheck = validateShortcut(String(s.shortcut ?? ''));
    if (!shortcutCheck.valid) continue;

    const content = sanitizePlainText(String(s.content ?? ''), MAX_SNIPPET_CONTENT_LENGTH);
    if (!content.trim()) continue;

    const name =
      sanitizeSingleLine(String(s.name ?? ''), MAX_SNIPPET_NAME_LENGTH) ||
      shortcutCheck.normalized;

    let id =
      typeof s.id === 'string' && s.id.trim().length > 0
        ? sanitizeSingleLine(s.id, 64)
        : generateSafeId('snp');
    if (seenIds.has(id)) {
      id = generateSafeId('snp');
    }
    seenIds.add(id);

    const folderId =
      typeof s.folderId === 'string' && validFolderIds.has(s.folderId)
        ? s.folderId
        : null;

    snippets.push({
      id,
      name,
      shortcut: shortcutCheck.normalized,
      content,
      folderId,
      enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : now,
      updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : now,
      usageCount:
        typeof s.usageCount === 'number' && Number.isFinite(s.usageCount) && s.usageCount >= 0
          ? Math.floor(s.usageCount)
          : 0,
      lastUsedAt: typeof s.lastUsedAt === 'string' ? s.lastUsedAt : null,
    });
  }

  // Sanitize settings
  const rawSettings =
    record.settings && typeof record.settings === 'object'
      ? (record.settings as Record<string, unknown>)
      : {};

  const excludedDomains: string[] = [];
  if (Array.isArray(rawSettings.excludedDomains)) {
    for (const d of rawSettings.excludedDomains) {
      const normalized = normalizeDomainPattern(String(d ?? ''));
      if (normalized && !excludedDomains.includes(normalized)) {
        excludedDomains.push(normalized);
      }
    }
  }

  const customVariables: CustomVariable[] = [];
  const seenVarKeys = new Set<string>();
  if (Array.isArray(rawSettings.customVariables)) {
    for (const v of rawSettings.customVariables) {
      if (!v || typeof v !== 'object') continue;
      const vr = v as Record<string, unknown>;
      const key = sanitizeVariableKey(String(vr.key ?? ''));
      if (!key || seenVarKeys.has(key)) continue;
      seenVarKeys.add(key);
      customVariables.push({
        id:
          typeof vr.id === 'string' && vr.id.trim()
            ? sanitizeSingleLine(vr.id, 64)
            : generateSafeId('var'),
        key,
        label: sanitizeSingleLine(String(vr.label ?? key), 60) || key,
        value: sanitizePlainText(String(vr.value ?? ''), MAX_VARIABLE_VALUE_LENGTH),
        updatedAt: typeof vr.updatedAt === 'string' ? vr.updatedAt : now,
      });
    }
  }

  const trigger = rawSettings.trigger === 'tab' ? 'tab' : 'space';
  const theme =
    rawSettings.theme === 'light' || rawSettings.theme === 'dark' || rawSettings.theme === 'system'
      ? rawSettings.theme
      : 'system';

  const settings: ExtensionSettings = {
    enabled: typeof rawSettings.enabled === 'boolean' ? rawSettings.enabled : true,
    trigger,
    theme,
    excludedDomains,
    caseSensitiveShortcuts: Boolean(rawSettings.caseSensitiveShortcuts),
    showExpansionFeedback:
      typeof rawSettings.showExpansionFeedback === 'boolean'
        ? rawSettings.showExpansionFeedback
        : true,
    customVariables,
  };

  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : 1,
    app: 'tavriqelo',
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : now,
    snippets,
    folders,
    settings,
  };
}
