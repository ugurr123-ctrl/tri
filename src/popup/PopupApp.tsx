import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Plus,
  Search,
  ShieldBan,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BrandMark } from '../components/ui/BrandMark';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Toggle } from '../components/ui/Toggle';
import { toUserErrorMessage } from '../core/errors/ExtensionError';
import { isDomainExcluded, isHardBlockedOrigin } from '../core/expander/fieldGuard';
import { resolveTemplate } from '../core/expander/variableEngine';
import { normalizeShortcut } from '../core/sanitize/sanitize';
import { useExtensionState } from '../hooks/useExtensionState';
import { useTheme } from '../hooks/useTheme';
import {
  enableOnActiveTab,
  getActiveTabContext,
  openExtensionOptionsPage,
  type ActiveTabContext,
} from '../services/chrome/permissionsService';
import {
  addExcludedDomain,
  removeExcludedDomain,
  updateSettings,
} from '../services/storage/settingsService';
import {
  createSnippet,
  toggleSnippetEnabled,
} from '../services/storage/snippetRepository';

export function PopupApp() {
  const { loading, error, snippets, folders, settings, entitlement, clearError } =
    useExtensionState();
  useTheme(settings.theme);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTabContext | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick-create inline state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShortcut, setNewShortcut] = useState('/');
  const [newContent, setNewContent] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => {
    void getActiveTabContext().then(setActiveTab);
  }, []);

  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const filteredSnippets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snippets;
    return snippets.filter(
      (s) =>
        s.shortcut.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
    );
  }, [snippets, query]);

  const currentSiteExcluded = useMemo(() => {
    if (!activeTab?.isWebPage || !activeTab.hostname) return false;
    return isDomainExcluded(activeTab.hostname, settings.excludedDomains);
  }, [activeTab, settings.excludedDomains]);

  const currentSiteHardBlocked = useMemo(() => {
    if (!activeTab?.isWebPage || !activeTab.hostname) return false;
    return isHardBlockedOrigin(activeTab.hostname);
  }, [activeTab]);

  const handleGlobalToggle = async (enabled: boolean) => {
    setActionError(null);
    try {
      await updateSettings({ enabled });
    } catch (err) {
      setActionError(toUserErrorMessage(err));
    }
  };

  const handleToggleSnippet = async (id: string, enabled: boolean) => {
    setActionError(null);
    try {
      await toggleSnippetEnabled(id, enabled);
    } catch (err) {
      setActionError(toUserErrorMessage(err));
    }
  };

  const handleCopySnippet = async (snippetId: string, content: string) => {
    try {
      const resolved = resolveTemplate(content, {
        customVariables: settings.customVariables,
        allowAdvancedVariables: entitlement.limits.advancedVariables,
      });
      await navigator.clipboard.writeText(resolved.text);
      setCopiedId(snippetId);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === snippetId ? null : curr));
      }, 1500);
    } catch {
      setActionError('Clipboard copy failed in this context.');
    }
  };

  const handleEnableOnCurrentSite = async () => {
    if (!activeTab) return;
    setActionError(null);
    try {
      const granted = await enableOnActiveTab(activeTab);
      if (granted) {
        const updated = await getActiveTabContext();
        setActiveTab(updated);
      }
    } catch (err) {
      setActionError(toUserErrorMessage(err));
    }
  };

  const handleToggleSiteExclusion = async () => {
    if (!activeTab?.hostname) return;
    setActionError(null);
    try {
      if (settings.excludedDomains.includes(activeTab.hostname.toLowerCase())) {
        await removeExcludedDomain(activeTab.hostname.toLowerCase());
      } else {
        await addExcludedDomain(activeTab.hostname);
      }
    } catch (err) {
      setActionError(toUserErrorMessage(err));
    }
  };

  const handleQuickCreate = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setSavingNew(true);
    try {
      await createSnippet(
        {
          name: newName.trim() || newShortcut,
          shortcut: newShortcut,
          content: newContent,
          folderId: folders[0]?.id ?? null,
          enabled: true,
        },
        settings.caseSensitiveShortcuts,
      );
      setNewName('');
      setNewShortcut('/');
      setNewContent('');
      setCreating(false);
    } catch (err) {
      setActionError(toUserErrorMessage(err));
    } finally {
      setSavingNew(false);
    }
  };

  const snippetQuotaLabel = Number.isFinite(entitlement.limits.maxSnippets)
    ? `${snippets.length} / ${entitlement.limits.maxSnippets} snippets`
    : `${snippets.length} snippets`;

  return (
    <div className="w-[380px] h-[540px] flex flex-col bg-[#F8F9FB] dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-[#131722] border-b border-slate-200 dark:border-[#23293A]">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandMark size={24} className="shrink-0" />
          <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
            Tavriqelo
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {settings.enabled ? 'On' : 'Paused'}
            </span>
            <Toggle
              checked={settings.enabled}
              onChange={handleGlobalToggle}
              label="Toggle global text expansion"
              size="sm"
            />
          </div>
          <button
            type="button"
            onClick={openExtensionOptionsPage}
            title="Open full dashboard"
            aria-label="Open full dashboard"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#1E2436] cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Active Site Permission / Exclusion Strip */}
      {activeTab && activeTab.isWebPage && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-slate-100/70 dark:bg-[#10141F] border-b border-slate-200 dark:border-[#23293A] text-xs">
          <div className="flex items-center gap-1.5 min-w-0 text-slate-600 dark:text-slate-300">
            <Globe className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="truncate font-medium">{activeTab.hostname}</span>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {currentSiteHardBlocked ? (
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                Payment site protected
              </span>
            ) : !activeTab.hasPermission ? (
              <button
                type="button"
                onClick={handleEnableOnCurrentSite}
                className="text-[11px] font-medium text-[#6255E7] dark:text-[#8E84FF] hover:underline cursor-pointer whitespace-nowrap"
              >
                Enable on this site
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleSiteExclusion}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
              >
                <ShieldBan className="w-3 h-3" />
                {currentSiteExcluded ? 'Resume site' : 'Exclude site'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Quick Add Toolbar */}
      <div className="px-4 pt-3 pb-2 space-y-2.5">
        {(error || actionError) && (
          <ErrorBanner
            message={actionError || error || ''}
            onDismiss={() => {
              setActionError(null);
              clearError();
            }}
          />
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts or text..."
              aria-label="Search snippets"
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#131722] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <Button
            variant={creating ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setCreating((prev) => !prev)}
          >
            {creating ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{creating ? 'Close' : 'New'}</span>
          </Button>
        </div>

        {/* Inline Quick-Create Snippet Form */}
        {creating && (
          <form
            onSubmit={handleQuickCreate}
            className="p-3 rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] space-y-2"
          >
            <div className="grid grid-cols-5 gap-2">
              <input
                type="text"
                value={newShortcut}
                onChange={(e) => setNewShortcut(normalizeShortcut(e.target.value))}
                placeholder="/shortcut"
                required
                aria-label="Shortcut"
                className="col-span-2 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-slate-50 dark:bg-[#0B0E14] font-mono text-xs"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Snippet name"
                aria-label="Snippet name"
                className="col-span-3 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-slate-50 dark:bg-[#0B0E14] text-xs"
              />
            </div>
            <textarea
              rows={3}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Expanded text (supports {{date}}, {{time}}, {{cursor}})..."
              required
              aria-label="Expanded text"
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-slate-50 dark:bg-[#0B0E14] text-xs leading-relaxed resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={savingNew}>
                {savingNew ? 'Saving...' : 'Save Snippet'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Snippet List */}
      <main className="flex-1 overflow-y-auto px-4 pb-3">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-16 rounded-lg border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722]"
              />
            ))}
          </div>
        ) : filteredSnippets.length === 0 ? (
          <EmptyState
            title={query ? 'No matching snippets' : 'No snippets yet'}
            description={
              query
                ? 'Try searching by a different shortcut or keyword.'
                : 'Create your first shortcut to start expanding text across your favorite sites.'
            }
            action={
              !query ? (
                <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                  Create Snippet
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-[#23293A] rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] overflow-hidden">
            {filteredSnippets.map((snippet) => {
              const folderName = snippet.folderId
                ? folderMap.get(snippet.folderId)
                : null;
              return (
                <li
                  key={snippet.id}
                  className={`px-3.5 py-2.5 flex items-start justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-[#181D2B] transition-colors ${
                    !snippet.enabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <code className="font-mono font-semibold text-[#6255E7] dark:text-[#8E84FF] shrink-0">
                        {snippet.shortcut}
                      </code>
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {snippet.name}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {snippet.content.replace(/\n+/g, ' ')}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      <span>{folderName || 'Unfiled'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{snippet.usageCount} uses</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopySnippet(snippet.id, snippet.content)}
                      title="Copy resolved snippet text"
                      aria-label={`Copy ${snippet.name}`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-100 dark:hover:bg-[#23293A] cursor-pointer"
                    >
                      {copiedId === snippet.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Toggle
                      checked={snippet.enabled}
                      onChange={(next) => handleToggleSnippet(snippet.id, next)}
                      label={`Toggle ${snippet.name}`}
                      size="sm"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white dark:bg-[#131722] border-t border-slate-200 dark:border-[#23293A] text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 tabular-nums">
          <span>Trigger: {settings.trigger === 'tab' ? 'Tab' : 'Space'}</span>
          <span aria-hidden="true">·</span>
          <span>{snippetQuotaLabel}</span>
        </div>
        <button
          type="button"
          onClick={openExtensionOptionsPage}
          className="font-medium text-[#6255E7] dark:text-[#8E84FF] hover:underline cursor-pointer whitespace-nowrap"
        >
          Manage Dashboard
        </button>
      </footer>
    </div>
  );
}
