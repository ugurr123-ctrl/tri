import { CORE_MANIFEST_ORIGINS } from '../services/chrome/permissionsService';
import { ensureStorageInitialized } from '../services/storage/snippetRepository';
import { recordExpansionStats } from '../services/storage/statsService';

const OPTIONAL_SCRIPT_ID = 'tavriqelo-optional-sites';

/**
 * Synchronizes dynamically registered content scripts for any optional website permissions
 * granted by the user via chrome.permissions.request().
 */
async function syncOptionalContentScripts(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.scripting) {
    return;
  }

  try {
    const granted = await chrome.permissions.getAll();
    const coreSet = new Set<string>(CORE_MANIFEST_ORIGINS);
    const optionalOrigins = (granted.origins ?? []).filter((origin) => !coreSet.has(origin));

    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [OPTIONAL_SCRIPT_ID],
    });

    if (optionalOrigins.length === 0) {
      if (existing.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [OPTIONAL_SCRIPT_ID] });
      }
      return;
    }

    const scriptConfig: chrome.scripting.RegisteredContentScript = {
      id: OPTIONAL_SCRIPT_ID,
      matches: optionalOrigins,
      js: ['content.js'],
      runAt: 'document_idle',
      allFrames: true,
      persistAcrossSessions: true,
    };

    if (existing.length > 0) {
      await chrome.scripting.updateContentScripts([scriptConfig]);
    } else {
      await chrome.scripting.registerContentScripts([scriptConfig]);
    }
  } catch {
    // Non-fatal: permissions may change while browser is closing
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureStorageInitialized();
  void syncOptionalContentScripts();
});

chrome.runtime.onStartup.addListener(() => {
  void syncOptionalContentScripts();
});

chrome.permissions.onAdded.addListener(() => {
  void syncOptionalContentScripts();
});

chrome.permissions.onRemoved.addListener(() => {
  void syncOptionalContentScripts();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  // Only accept messages from our own extension context
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message.type === 'TAVRIQELO_SYNC_OPTIONAL_SCRIPTS') {
    void syncOptionalContentScripts()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'TAVRIQELO_RECORD_EXPANSION' && message.payload) {
    const { snippetId, shortcutLength, expandedLength } = message.payload as {
      snippetId?: unknown;
      shortcutLength?: unknown;
      expandedLength?: unknown;
    };

    if (
      typeof snippetId === 'string' &&
      typeof shortcutLength === 'number' &&
      typeof expandedLength === 'number'
    ) {
      void recordExpansionStats(snippetId, shortcutLength, expandedLength)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
  }

  return false;
});
