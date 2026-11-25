import {
  CheckCircle2,
  Download,
  Globe,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Modal } from '../../components/ui/Modal';
import { Toggle } from '../../components/ui/Toggle';
import { toUserErrorMessage } from '../../core/errors/ExtensionError';
import {
  CORE_MANIFEST_ORIGINS,
  getGrantedOptionalOrigins,
  hasAllWebsitesPermission,
  hasChromePermissionsApi,
  requestAllWebsitesPermission,
  requestDomainPermission,
  revokeAllWebsitesPermission,
  revokeOriginPermission,
} from '../../services/chrome/permissionsService';
import {
  createBackupJson,
  importBackupJson,
  resetAllLocalData,
} from '../../services/storage/backupService';
import {
  addExcludedDomain,
  removeExcludedDomain,
  updateSettings,
} from '../../services/storage/settingsService';
import type {
  ExpansionTrigger,
  ExtensionSettings,
  ThemeMode,
} from '../../types/extension';

interface SettingsPageProps {
  settings: ExtensionSettings;
}

export function SettingsPage({ settings }: SettingsPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Domain exclusion input
  const [domainInput, setDomainInput] = useState('');

  // Optional Chrome host permissions state
  const [permissionsSupported] = useState(() => hasChromePermissionsApi());
  const [allSitesGranted, setAllSitesGranted] = useState(false);
  const [optionalOrigins, setOptionalOrigins] = useState<string[]>([]);
  const [customOriginInput, setCustomOriginInput] = useState('');

  // Backup import state
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset confirmation modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  const refreshPermissions = async () => {
    if (!permissionsSupported) return;
    try {
      const [allGranted, grantedList] = await Promise.all([
        hasAllWebsitesPermission(),
        getGrantedOptionalOrigins(),
      ]);
      setAllSitesGranted(allGranted);
      setOptionalOrigins(grantedList);
    } catch {
      // Ignore permission read failures outside extension context
    }
  };

  useEffect(() => {
    void refreshPermissions();
  }, []);

  const showNotice = (message: string) => {
    setError(null);
    setNotice(message);
  };

  const handleUpdateSetting = async (patch: Partial<ExtensionSettings>) => {
    setError(null);
    try {
      await updateSettings(patch);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleAddExcludedDomain = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await addExcludedDomain(domainInput);
      setDomainInput('');
      showNotice('Website added to exclusion list.');
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleRemoveExcludedDomain = async (domain: string) => {
    setError(null);
    try {
      await removeExcludedDomain(domain);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleToggleAllSitesPermission = async () => {
    setError(null);
    try {
      if (allSitesGranted) {
        await revokeAllWebsitesPermission();
        showNotice('Revoked optional permission for all websites.');
      } else {
        const granted = await requestAllWebsitesPermission();
        if (granted) {
          showNotice('Enabled text expansion across all compatible websites.');
        }
      }
      await refreshPermissions();
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleRequestCustomOrigin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await requestDomainPermission(customOriginInput);
      if (res.granted) {
        setCustomOriginInput('');
        showNotice(`Granted website access for ${res.originPattern}.`);
        await refreshPermissions();
      }
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleRevokeOrigin = async (origin: string) => {
    setError(null);
    try {
      await revokeOriginPermission(origin);
      await refreshPermissions();
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleExportBackup = async () => {
    setError(null);
    try {
      const json = await createBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tavriqelo-backup-${dateStr}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showNotice('Backup exported as JSON.');
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleImportFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    try {
      const text = await file.text();
      const summary = await importBackupJson(text, importMode);
      const parts = [`Imported ${summary.addedSnippets} snippets`];
      if (summary.addedFolders > 0) {
        parts.push(`${summary.addedFolders} folders`);
      }
      if (summary.skippedDuplicates > 0) {
        parts.push(`skipped ${summary.skippedDuplicates} duplicates`);
      }
      if (summary.truncatedByQuota > 0) {
        parts.push(`${summary.truncatedByQuota} omitted due to Free plan quota`);
      }
      showNotice(`${parts.join(', ')}.`);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      await resetAllLocalData();
      setResetModalOpen(false);
      setResetConfirmText('');
      showNotice('All local snippets, folders, settings, and statistics were reset to defaults.');
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* General & Expansion Behavior */}
      <section className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] divide-y divide-slate-200 dark:divide-[#23293A]">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Expansion &amp; Appearance
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Configure how shortcuts trigger and how the interface adapts to your workspace.
          </p>
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Enable Text Expansion Globally
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pause or resume automatic snippet expansion across all tabs.
            </p>
          </div>
          <Toggle
            checked={settings.enabled}
            onChange={(enabled) => handleUpdateSetting({ enabled })}
            label="Enable text expansion globally"
          />
        </div>

        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Expansion Trigger Key
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Press this key immediately after a shortcut to expand it.
            </p>
          </div>
          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#23293A]"
            role="group"
            aria-label="Expansion trigger key"
          >
            {(['space', 'tab'] as ExpansionTrigger[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleUpdateSetting({ trigger: mode })}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer transition-colors ${
                  settings.trigger === mode
                    ? 'bg-[#6255E7] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode === 'space' ? 'Space' : 'Tab'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Theme
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose Light, Dark, or follow your operating system preference.
            </p>
          </div>
          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#23293A]"
            role="group"
            aria-label="Theme preference"
          >
            {(['light', 'dark', 'system'] as ThemeMode[]).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                onClick={() => handleUpdateSetting({ theme: themeOption })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer transition-colors ${
                  settings.theme === themeOption
                    ? 'bg-[#6255E7] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {themeOption}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Case-Sensitive Shortcuts
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              When enabled, <code className="font-mono">/Thanks</code> and{' '}
              <code className="font-mono">/thanks</code> are treated as distinct shortcuts.
            </p>
          </div>
          <Toggle
            checked={settings.caseSensitiveShortcuts}
            onChange={(caseSensitiveShortcuts) =>
              handleUpdateSetting({ caseSensitiveShortcuts })
            }
            label="Case-sensitive shortcuts"
          />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Subtle Expansion Confirmation
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Show a brief unobtrusive confirmation toast in the corner after expanding a snippet.
            </p>
          </div>
          <Toggle
            checked={settings.showExpansionFeedback}
            onChange={(showExpansionFeedback) =>
              handleUpdateSetting({ showExpansionFeedback })
            }
            label="Show subtle expansion confirmation"
          />
        </div>
      </section>

      {/* Optional Website Permissions */}
      <section className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] divide-y divide-slate-200 dark:divide-[#23293A]">
        <div className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Website Permissions (Privacy-First)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Tavriqelo requests minimal permissions by default and runs immediately on Gmail, Outlook, LinkedIn, ChatGPT, Slack, Notion, GitHub, and X. Grant optional access for additional sites below.
          </p>
        </div>

        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Enable on All Compatible Websites
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Requests Chrome optional host permissions (<code className="font-mono">https://*/*</code>) so shortcuts work on any non-excluded site.
            </p>
          </div>
          <Button
            variant={allSitesGranted ? 'secondary' : 'primary'}
            size="sm"
            disabled={!permissionsSupported}
            onClick={handleToggleAllSitesPermission}
          >
            <Globe className="w-3.5 h-3.5" />
            {allSitesGranted ? 'Revoke All-Sites Access' : 'Allow All Websites'}
          </Button>
        </div>

        <div className="p-5 space-y-3">
          <form onSubmit={handleRequestCustomOrigin} className="flex gap-2">
            <input
              type="text"
              value={customOriginInput}
              onChange={(e) => setCustomOriginInput(e.target.value)}
              placeholder="Add specific site (e.g. zendesk.com)"
              aria-label="Grant optional permission for a domain"
              disabled={!permissionsSupported}
              className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm disabled:opacity-50"
            />
            <Button
              variant="secondary"
              type="submit"
              disabled={!permissionsSupported || !customOriginInput.trim()}
            >
              <Plus className="w-4 h-4" />
              Grant Site
            </Button>
          </form>

          {!permissionsSupported && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Load the built <code className="font-mono">dist/</code> directory in Chrome Extensions Developer Mode to grant or revoke live browser permissions.
            </p>
          )}

          {optionalOrigins.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Granted optional website permissions
              </div>
              <ul className="divide-y divide-slate-200 dark:divide-[#23293A] rounded-lg border border-slate-200 dark:border-[#23293A]">
                {optionalOrigins.map((origin) => (
                  <li
                    key={origin}
                    className="flex items-center justify-between px-3 py-2 text-xs"
                  >
                    <code className="font-mono text-slate-700 dark:text-slate-300">
                      {origin}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleRevokeOrigin(origin)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Built-in supported origins: {CORE_MANIFEST_ORIGINS.length} productivity domains (Gmail, Outlook, LinkedIn, ChatGPT, Slack, Notion, GitHub, X).
          </div>
        </div>
      </section>

      {/* Website Exclusion List */}
      <section className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Website Exclusion List
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Tavriqelo will never expand text on excluded domains. Password fields, OTP inputs, and payment processor origins (Stripe, PayPal, Adyen, etc.) are always blocked automatically.
          </p>
        </div>

        <form onSubmit={handleAddExcludedDomain} className="flex gap-2">
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="e.g. banking.example.com or *.internal.org"
            aria-label="Exclude domain"
            className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm"
          />
          <Button variant="primary" type="submit" disabled={!domainInput.trim()}>
            Add Exclusion
          </Button>
        </form>

        {settings.excludedDomains.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No custom domains excluded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-[#23293A] rounded-lg border border-slate-200 dark:border-[#23293A]">
            {settings.excludedDomains.map((domain) => (
              <li
                key={domain}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs"
              >
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {domain}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveExcludedDomain(domain)}
                  aria-label={`Remove ${domain} from exclusion list`}
                  className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Import & Export Backups */}
      <section className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            JSON Backups (Import &amp; Export)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Export all snippets, folders, and settings locally as a portable JSON file, or restore a previous backup.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button variant="secondary" onClick={handleExportBackup}>
            <Download className="w-4 h-4" />
            Export JSON Backup
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
              aria-label="Backup import mode"
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-xs"
            >
              <option value="merge">Merge with existing snippets</option>
              <option value="replace">Replace all existing data</option>
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFileChange}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Import JSON
            </Button>
          </div>
        </div>
      </section>

      {/* Reset Local Data */}
      <section className="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#131722] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
            Reset Local Data
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Erase all custom snippets, folders, usage statistics, and preferences and restore starter defaults.
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setResetModalOpen(true)}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset All Data
        </Button>
      </section>

      <Modal
        open={resetModalOpen}
        onClose={() => {
          setResetModalOpen(false);
          setResetConfirmText('');
        }}
        title="Confirm Local Data Reset"
        description="This permanently removes your saved snippets, folders, and local statistics from Chrome storage."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Consider exporting a JSON backup before resetting. Type{' '}
            <code className="font-mono font-semibold text-slate-900 dark:text-white">
              RESET
            </code>{' '}
            below to confirm.
          </p>

          <input
            type="text"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="Type RESET"
            aria-label="Type RESET to confirm"
            className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] font-mono text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setResetModalOpen(false);
                setResetConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetConfirmText.trim().toUpperCase() !== 'RESET' || resetting}
              onClick={handleConfirmReset}
            >
              {resetting ? 'Resetting...' : 'Permanently Reset Data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
