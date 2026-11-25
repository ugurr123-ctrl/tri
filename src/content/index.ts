import { entitlementService } from '../core/entitlement/entitlementService';
import {
  isDomainExcluded,
  isSensitiveElement,
  isSupportedEditableElement,
} from '../core/expander/fieldGuard';
import { findMatchingSnippet } from '../core/expander/shortcutMatcher';
import {
  extractInputPlaceholders,
  resolveTemplate,
} from '../core/expander/variableEngine';
import { createDefaultSettings } from '../data/defaultData';
import { ensureStorageInitialized } from '../services/storage/snippetRepository';
import {
  STORAGE_KEYS,
  type ExtensionSettings,
  type Snippet,
} from '../types/extension';
import {
  captureCaretSnapshot,
  clearNativeUndoState,
  getMinimalTextBeforeCaret,
  performExpansion,
  resolveActiveEditableTarget,
  tryFallbackNativeUndo,
} from './domAdapter';
import {
  promptForPlaceholderValues,
  showExpansionToast,
} from './placeholderModal';

declare global {
  interface Window {
    __TAVRIQELO_CONTENT_INITIALIZED__?: boolean;
  }
}

interface ContentRuntimeCache {
  snippets: Snippet[];
  settings: ExtensionSettings;
  allowAdvancedVariables: boolean;
  isPromptOpen: boolean;
}

const state: ContentRuntimeCache = {
  snippets: [],
  settings: createDefaultSettings(),
  allowAdvancedVariables: false,
  isPromptOpen: false,
};

async function hydrateFromStorage(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  try {
    await ensureStorageInitialized();
    const raw = await chrome.storage.local.get([
      STORAGE_KEYS.SNIPPETS,
      STORAGE_KEYS.SETTINGS,
    ]);

    if (Array.isArray(raw[STORAGE_KEYS.SNIPPETS])) {
      state.snippets = raw[STORAGE_KEYS.SNIPPETS] as Snippet[];
    }
    if (raw[STORAGE_KEYS.SETTINGS] && typeof raw[STORAGE_KEYS.SETTINGS] === 'object') {
      state.settings = {
        ...createDefaultSettings(),
        ...(raw[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings>),
      };
    }

    const entitlement = await entitlementService.getEntitlement();
    state.allowAdvancedVariables = entitlement.limits.advancedVariables;
  } catch {
    // Gracefully fail closed without disrupting page behavior
  }
}

function isTriggerKeyEvent(event: KeyboardEvent, trigger: ExtensionSettings['trigger']): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) {
    return false;
  }
  if (trigger === 'tab') {
    return event.key === 'Tab';
  }
  return event.key === ' ' || event.code === 'Space';
}

function recordLocalExpansion(
  snippetId: string,
  shortcutLength: number,
  expandedLength: number,
): void {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    chrome.runtime
      .sendMessage({
        type: 'TAVRIQELO_RECORD_EXPANSION',
        payload: { snippetId, shortcutLength, expandedLength },
      })
      .catch(() => {
        // Ignore if service worker is cycling
      });
  }
}

async function handleKeyDown(event: KeyboardEvent): Promise<void> {
  if (state.isPromptOpen || !state.settings.enabled) {
    return;
  }

  const hostname = window.location.hostname;
  if (isDomainExcluded(hostname, state.settings.excludedDomains)) {
    return;
  }

  // Fallback Ctrl+Z / Cmd+Z handler for controlled native inputs
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
    const target = resolveActiveEditableTarget(event);
    if (
      target &&
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      // Allow native undo first; only step in if native undo leaves the exact post-expansion string
      const before = target.value;
      window.setTimeout(() => {
        if (target.value === before) {
          tryFallbackNativeUndo(target);
        }
      }, 0);
    }
    return;
  }

  if (!isTriggerKeyEvent(event, state.settings.trigger)) {
    return;
  }

  const target = resolveActiveEditableTarget(event);
  if (!isSupportedEditableElement(target)) {
    return;
  }

  // Critical privacy boundary: never inspect or expand inside password/OTP/payment fields
  if (isSensitiveElement(target)) {
    return;
  }

  const textBeforeCaret = getMinimalTextBeforeCaret(target);
  if (!textBeforeCaret) {
    return;
  }

  const match = findMatchingSnippet(
    textBeforeCaret,
    state.snippets,
    state.settings.caseSensitiveShortcuts,
  );
  if (!match) {
    return;
  }

  const snapshot = captureCaretSnapshot(target);
  if (!snapshot) {
    return;
  }

  // Prevent the trigger key (Space/Tab) from inserting whitespace or moving focus
  event.preventDefault();
  event.stopPropagation();

  let inputValues: Record<string, string> = {};
  const inputPlaceholders = state.allowAdvancedVariables
    ? extractInputPlaceholders(match.snippet.content)
    : [];

  if (inputPlaceholders.length > 0) {
    state.isPromptOpen = true;
    try {
      const collected = await promptForPlaceholderValues(
        match.snippet.name,
        inputPlaceholders,
      );
      if (collected === null) {
        // User cancelled placeholder modal — restore focus gracefully
        target.focus();
        return;
      }
      inputValues = collected;
    } finally {
      state.isPromptOpen = false;
    }
  }

  const resolved = resolveTemplate(match.snippet.content, {
    now: new Date(),
    customVariables: state.settings.customVariables,
    inputValues,
    allowAdvancedVariables: state.allowAdvancedVariables,
  });

  const expanded = performExpansion({
    snapshot,
    shortcutLength: match.tokenLength,
    originalShortcut: match.matchedText,
    expandedText: resolved.text,
    cursorOffset: resolved.cursorOffset,
  });

  if (expanded) {
    recordLocalExpansion(match.snippet.id, match.tokenLength, resolved.text.length);
    if (state.settings.showExpansionFeedback) {
      showExpansionToast(match.snippet.shortcut);
    }
  }
}

function initContentScript(): void {
  if (window.__TAVRIQELO_CONTENT_INITIALIZED__) {
    return;
  }
  window.__TAVRIQELO_CONTENT_INITIALIZED__ = true;

  void hydrateFromStorage();

  document.addEventListener('keydown', (event) => {
    void handleKeyDown(event);
  }, true);

  window.addEventListener('blur', clearNativeUndoState, true);
  window.addEventListener('pagehide', clearNativeUndoState);

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (
        changes[STORAGE_KEYS.SNIPPETS] ||
        changes[STORAGE_KEYS.SETTINGS] ||
        changes[STORAGE_KEYS.DEV_ENTITLEMENT_TIER]
      ) {
        void hydrateFromStorage();
      }
    });
  }
}

initContentScript();
