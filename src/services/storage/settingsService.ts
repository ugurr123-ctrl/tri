import { entitlementService } from '../../core/entitlement/entitlementService';
import { ExtensionError } from '../../core/errors/ExtensionError';
import {
  generateSafeId,
  MAX_VARIABLE_VALUE_LENGTH,
  normalizeDomainPattern,
  sanitizePlainText,
  sanitizeSingleLine,
  sanitizeVariableKey,
} from '../../core/sanitize/sanitize';
import { createDefaultSettings } from '../../data/defaultData';
import {
  STORAGE_KEYS,
  type CustomVariable,
  type ExtensionSettings,
} from '../../types/extension';
import { ensureStorageInitialized } from './snippetRepository';
import { storageAdapter } from './storageAdapter';

export async function getSettings(): Promise<ExtensionSettings> {
  await ensureStorageInitialized();
  const stored = await storageAdapter.get<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
  const defaults = createDefaultSettings();
  if (!stored || typeof stored !== 'object') {
    return defaults;
  }
  return {
    ...defaults,
    ...stored,
    excludedDomains: Array.isArray(stored.excludedDomains) ? stored.excludedDomains : [],
    customVariables: Array.isArray(stored.customVariables)
      ? stored.customVariables
      : defaults.customVariables,
  };
}

export async function updateSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next: ExtensionSettings = {
    ...current,
    ...patch,
  };
  await storageAdapter.set(STORAGE_KEYS.SETTINGS, next);
  return next;
}

export async function addExcludedDomain(rawDomain: string): Promise<ExtensionSettings> {
  const normalized = normalizeDomainPattern(rawDomain);
  if (!normalized) {
    throw new ExtensionError(
      'INVALID_INPUT',
      'Enter a valid domain such as bank.example.com or *.example.com.',
    );
  }
  const current = await getSettings();
  if (current.excludedDomains.includes(normalized)) {
    return current;
  }
  return updateSettings({
    excludedDomains: [...current.excludedDomains, normalized],
  });
}

export async function removeExcludedDomain(domain: string): Promise<ExtensionSettings> {
  const current = await getSettings();
  return updateSettings({
    excludedDomains: current.excludedDomains.filter((d) => d !== domain),
  });
}

export async function saveCustomVariable(input: {
  id?: string;
  key: string;
  label: string;
  value: string;
}): Promise<ExtensionSettings> {
  const canUseAdvanced = await entitlementService.canUseFeature('advanced_variables');
  if (!canUseAdvanced) {
    throw new ExtensionError(
      'FEATURE_REQUIRES_PRO',
      'Custom variables are part of Tavriqelo Pro.',
    );
  }

  const key = sanitizeVariableKey(input.key);
  if (!key) {
    throw new ExtensionError(
      'INVALID_INPUT',
      'Variable key must use letters, numbers, dashes, or underscores.',
    );
  }

  const label = sanitizeSingleLine(input.label || key, 60) || key;
  const value = sanitizePlainText(input.value, MAX_VARIABLE_VALUE_LENGTH);
  const current = await getSettings();
  const now = new Date().toISOString();

  const duplicate = current.customVariables.find(
    (v) => v.key.toLowerCase() === key && v.id !== input.id,
  );
  if (duplicate) {
    throw new ExtensionError(
      'INVALID_INPUT',
      `A custom variable with key "${key}" already exists.`,
    );
  }

  let nextVariables: CustomVariable[];
  if (input.id) {
    nextVariables = current.customVariables.map((v) =>
      v.id === input.id ? { ...v, key, label, value, updatedAt: now } : v,
    );
  } else {
    nextVariables = [
      ...current.customVariables,
      {
        id: generateSafeId('var'),
        key,
        label,
        value,
        updatedAt: now,
      },
    ];
  }

  return updateSettings({ customVariables: nextVariables });
}

export async function deleteCustomVariable(id: string): Promise<ExtensionSettings> {
  const current = await getSettings();
  return updateSettings({
    customVariables: current.customVariables.filter((v) => v.id !== id),
  });
}
