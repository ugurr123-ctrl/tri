import {
  BarChart3,
  BookTemplate,
  Braces,
  CreditCard,
  FileText,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useState } from 'react';
import { SnippetModal } from '../components/snippets/SnippetModal';
import { BrandMark } from '../components/ui/BrandMark';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Toggle } from '../components/ui/Toggle';
import { useExtensionState } from '../hooks/useExtensionState';
import { useTheme } from '../hooks/useTheme';
import { updateSettings } from '../services/storage/settingsService';
import {
  createSnippet,
  updateSnippet,
} from '../services/storage/snippetRepository';
import type { Snippet } from '../types/extension';
import { DashboardPage } from './pages/DashboardPage';
import { PlanPage } from './pages/PlanPage';
import { SettingsPage } from './pages/SettingsPage';
import { SnippetsPage } from './pages/SnippetsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { VariablesPage } from './pages/VariablesPage';

type NavTab =
  | 'dashboard'
  | 'snippets'
  | 'templates'
  | 'variables'
  | 'settings'
  | 'plan';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'dashboard', label: 'Overview', icon: BarChart3 },
  { id: 'snippets', label: 'Snippets', icon: FileText },
  { id: 'templates', label: 'Templates', icon: BookTemplate },
  { id: 'variables', label: 'Variables', icon: Braces },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'plan', label: 'Plan & Pro', icon: CreditCard },
];

const PAGE_HEADINGS: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Overview',
    subtitle: 'Local usage metrics and most frequently expanded snippets.',
  },
  snippets: {
    title: 'Snippets',
    subtitle: 'Manage shortcuts, folders, and multiline text templates.',
  },
  templates: {
    title: 'Template Library',
    subtitle: 'Ready-to-use English templates across seven workflow categories.',
  },
  variables: {
    title: 'Template Variables',
    subtitle: 'Dynamic date, time, cursor, prompt, and custom reusable values.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Control trigger behavior, theme, website permissions, exclusions, and backups.',
  },
  plan: {
    title: 'Plan & Entitlements',
    subtitle: 'Compare Free and Pro ($14.99 one-time) capabilities and quotas.',
  },
};

export function OptionsApp() {
  const { loading, error, snippets, folders, settings, stats, entitlement, clearError } =
    useExtensionState();
  useTheme(settings.theme);

  const [activeTab, setActiveTab] = useState<NavTab>('snippets');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [defaultFolderId, setDefaultFolderId] = useState<string | null>(null);

  const openCreateSnippet = (folderId: string | null = null) => {
    setEditingSnippet(null);
    setDefaultFolderId(folderId);
    setModalOpen(true);
  };

  const openEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setDefaultFolderId(snippet.folderId);
    setModalOpen(true);
  };

  const handleSaveSnippet = async (payload: {
    id?: string;
    name: string;
    shortcut: string;
    content: string;
    folderId: string | null;
    enabled: boolean;
  }) => {
    if (payload.id) {
      await updateSnippet(
        payload.id,
        {
          name: payload.name,
          shortcut: payload.shortcut,
          content: payload.content,
          folderId: payload.folderId,
          enabled: payload.enabled,
        },
        settings.caseSensitiveShortcuts,
      );
    } else {
      await createSnippet(
        {
          name: payload.name,
          shortcut: payload.shortcut,
          content: payload.content,
          folderId: payload.folderId,
          enabled: payload.enabled,
        },
        settings.caseSensitiveShortcuts,
      );
    }
  };

  const heading = PAGE_HEADINGS[activeTab];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F9FB] dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-full lg:w-60 shrink-0 bg-white dark:bg-[#131722] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-[#23293A] flex flex-col justify-between">
        <div>
          <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-200 dark:border-[#23293A]">
            <BrandMark size={26} className="shrink-0" />
            <span className="text-base font-semibold tracking-tight whitespace-nowrap">
              Tavriqelo
            </span>
          </div>

          <nav
            aria-label="Dashboard navigation"
            className="p-3 flex lg:flex-col gap-1 overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#6255E7]/10 text-[#6255E7] dark:bg-[#6255E7]/20 dark:text-[#A39BFF]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#1B2131]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Quiet Extension Status & Local Quota */}
        <div className="hidden lg:block p-4 border-t border-slate-200 dark:border-[#23293A] space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Expander {settings.enabled ? 'Enabled' : 'Paused'}
            </span>
            <Toggle
              checked={settings.enabled}
              onChange={(enabled) => void updateSettings({ enabled })}
              label="Toggle global text expansion"
              size="sm"
            />
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 tabular-nums">
            <div>
              Plan:{' '}
              {entitlement.tier === 'pro'
                ? entitlement.isDevelopmentPreview
                  ? 'Pro (Dev Preview)'
                  : 'Pro'
                : 'Free'}
            </div>
            <div>
              {Number.isFinite(entitlement.limits.maxSnippets)
                ? `${snippets.length} / ${entitlement.limits.maxSnippets} snippets`
                : `${snippets.length} snippets`}
              {' · '}
              Trigger: {settings.trigger === 'tab' ? 'Tab' : 'Space'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 lg:px-8 bg-white dark:bg-[#131722] border-b border-slate-200 dark:border-[#23293A] flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {heading.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              {heading.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button variant="primary" size="md" onClick={() => openCreateSnippet(null)}>
              <Plus className="w-4 h-4" />
              New Snippet
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
          {error && <ErrorBanner message={error} onDismiss={clearError} />}

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722]"
                  />
                ))}
              </div>
              <div className="h-64 rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722]" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardPage
                  snippets={snippets}
                  folders={folders}
                  stats={stats}
                  entitlement={entitlement}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onCreateSnippet={() => openCreateSnippet(null)}
                />
              )}
              {activeTab === 'snippets' && (
                <SnippetsPage
                  snippets={snippets}
                  folders={folders}
                  settings={settings}
                  entitlement={entitlement}
                  onCreateSnippet={openCreateSnippet}
                  onEditSnippet={openEditSnippet}
                />
              )}
              {activeTab === 'templates' && (
                <TemplatesPage
                  snippets={snippets}
                  folders={folders}
                  settings={settings}
                  entitlement={entitlement}
                  onNavigatePlan={() => setActiveTab('plan')}
                />
              )}
              {activeTab === 'variables' && (
                <VariablesPage
                  settings={settings}
                  entitlement={entitlement}
                  onNavigatePlan={() => setActiveTab('plan')}
                />
              )}
              {activeTab === 'settings' && <SettingsPage settings={settings} />}
              {activeTab === 'plan' && (
                <PlanPage
                  entitlement={entitlement}
                  snippetCount={snippets.length}
                  folderCount={folders.length}
                />
              )}
            </>
          )}
        </main>
      </div>

      <SnippetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingSnippet={editingSnippet}
        snippets={snippets}
        folders={folders}
        customVariables={settings.customVariables}
        caseSensitive={settings.caseSensitiveShortcuts}
        allowAdvancedVariables={entitlement.limits.advancedVariables}
        defaultFolderId={defaultFolderId}
        onSave={handleSaveSnippet}
      />
    </div>
  );
}
