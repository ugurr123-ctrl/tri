import { ExtensionError } from '../../core/errors/ExtensionError';
import { normalizeDomainPattern } from '../../core/sanitize/sanitize';

export const CORE_MANIFEST_ORIGINS = [
  'https://mail.google.com/*',
  'https://outlook.live.com/*',
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://www.linkedin.com/*',
  'https://chatgpt.com/*',
  'https://chat.openai.com/*',
  'https://app.slack.com/*',
  'https://www.notion.so/*',
  'https://notion.so/*',
  'https://github.com/*',
  'https://x.com/*',
] as const;

export const ALL_WEBSITES_ORIGINS = ['https://*/*', 'http://*/*'] as const;

export function hasChromePermissionsApi(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.permissions !== 'undefined' &&
    typeof chrome.permissions.getAll === 'function'
  );
}

export interface ActiveTabContext {
  tabId: number;
  url: string;
  hostname: string;
  originPattern: string;
  isWebPage: boolean;
  hasPermission: boolean;
}

export async function getGrantedOptionalOrigins(): Promise<string[]> {
  if (!hasChromePermissionsApi()) {
    return [];
  }
  const perms = await chrome.permissions.getAll();
  const coreSet = new Set<string>(CORE_MANIFEST_ORIGINS);
  return (perms.origins ?? []).filter((o) => !coreSet.has(o));
}

export async function hasAllWebsitesPermission(): Promise<boolean> {
  if (!hasChromePermissionsApi()) {
    return false;
  }
  return chrome.permissions.contains({ origins: ['https://*/*'] });
}

export async function requestAllWebsitesPermission(): Promise<boolean> {
  if (!hasChromePermissionsApi()) {
    throw new ExtensionError(
      'UNSUPPORTED_ENVIRONMENT',
      'Website permissions can only be modified when loaded as a Chrome extension.',
    );
  }
  const granted = await chrome.permissions.request({
    origins: [...ALL_WEBSITES_ORIGINS],
  });
  if (granted) {
    await notifyBackgroundSyncScripts();
  }
  return granted;
}

export async function revokeAllWebsitesPermission(): Promise<boolean> {
  if (!hasChromePermissionsApi()) {
    return false;
  }
  const removed = await chrome.permissions.remove({
    origins: [...ALL_WEBSITES_ORIGINS],
  });
  if (removed) {
    await notifyBackgroundSyncScripts();
  }
  return removed;
}

export async function requestDomainPermission(rawDomain: string): Promise<{
  granted: boolean;
  originPattern: string;
}> {
  if (!hasChromePermissionsApi()) {
    throw new ExtensionError(
      'UNSUPPORTED_ENVIRONMENT',
      'Website permissions can only be modified when loaded as a Chrome extension.',
    );
  }

  const normalized = normalizeDomainPattern(rawDomain);
  if (!normalized) {
    throw new ExtensionError(
      'INVALID_INPUT',
      'Enter a valid domain such as zendesk.com or app.linear.app.',
    );
  }

  const parts = normalized.split('.');
  const hostPattern =
    normalized.startsWith('*.')
      ? normalized
      : parts.length === 2
        ? `*.${normalized}`
        : normalized;
  const originPattern = `https://${hostPattern}/*`;
  const granted = await chrome.permissions.request({
    origins: [originPattern],
  });

  if (granted) {
    await notifyBackgroundSyncScripts();
  }

  return { granted, originPattern };
}

export async function revokeOriginPermission(originPattern: string): Promise<boolean> {
  if (!hasChromePermissionsApi()) {
    return false;
  }
  const removed = await chrome.permissions.remove({ origins: [originPattern] });
  if (removed) {
    await notifyBackgroundSyncScripts();
  }
  return removed;
}

export async function getActiveTabContext(): Promise<ActiveTabContext | null> {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.tabs === 'undefined' ||
    typeof chrome.tabs.query !== 'function'
  ) {
    return null;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id || !tab.url) {
    return null;
  }

  try {
    const parsed = new URL(tab.url);
    const isWebPage = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    if (!isWebPage) {
      return {
        tabId: tab.id,
        url: tab.url,
        hostname: parsed.hostname || parsed.protocol.replace(':', ''),
        originPattern: '',
        isWebPage: false,
        hasPermission: false,
      };
    }

    const originPattern = `${parsed.protocol}//${parsed.hostname}/*`;
    const hasPermission = hasChromePermissionsApi()
      ? await chrome.permissions.contains({ origins: [originPattern] })
      : false;

    return {
      tabId: tab.id,
      url: tab.url,
      hostname: parsed.hostname,
      originPattern,
      isWebPage: true,
      hasPermission,
    };
  } catch {
    return null;
  }
}

export async function enableOnActiveTab(context: ActiveTabContext): Promise<boolean> {
  if (!hasChromePermissionsApi() || !context.isWebPage || !context.originPattern) {
    return false;
  }

  const granted = await chrome.permissions.request({
    origins: [context.originPattern],
  });

  if (!granted) {
    return false;
  }

  await notifyBackgroundSyncScripts();

  // Immediately inject content.js into the currently active tab so user does not have to reload
  if (typeof chrome.scripting?.executeScript === 'function') {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: context.tabId, allFrames: true },
        files: ['content.js'],
      });
    } catch {
      // Tab may already have content.js injected or be a restricted frame
    }
  }

  return true;
}

export async function notifyBackgroundSyncScripts(): Promise<void> {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    try {
      await chrome.runtime.sendMessage({ type: 'TAVRIQELO_SYNC_OPTIONAL_SCRIPTS' });
    } catch {
      // Service worker wakes on message; ignore if unavailable outside extension runtime
    }
  }
}

export function openExtensionOptionsPage(): void {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.openOptionsPage === 'function') {
    chrome.runtime.openOptionsPage();
    return;
  }
  window.location.href = './options.html';
}
