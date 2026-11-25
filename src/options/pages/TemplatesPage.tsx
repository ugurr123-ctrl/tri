import { Check, Lock, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import type { EntitlementState } from '../../core/entitlement/types';
import { toUserErrorMessage } from '../../core/errors/ExtensionError';
import {
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_LIBRARY,
} from '../../data/templateLibrary';
import {
  createSnippet,
  findShortcutConflict,
} from '../../services/storage/snippetRepository';
import type {
  ExtensionSettings,
  Folder,
  LibraryTemplate,
  Snippet,
  TemplateCategory,
} from '../../types/extension';

interface TemplatesPageProps {
  snippets: Snippet[];
  folders: Folder[];
  settings: ExtensionSettings;
  entitlement: EntitlementState;
  onNavigatePlan: () => void;
}

const CATEGORIES: Array<'all' | TemplateCategory> = [
  'all',
  'customer-support',
  'sales',
  'ecommerce',
  'freelancers',
  'business-emails',
  'recruitment',
  'social-media',
];

export function TemplatesPage({
  snippets,
  folders,
  settings,
  entitlement,
  onNavigatePlan,
}: TemplatesPageProps) {
  const [category, setCategory] = useState<'all' | TemplateCategory>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATE_LIBRARY.filter((tpl) => {
      if (category !== 'all' && tpl.category !== category) return false;
      if (q) {
        return (
          tpl.name.toLowerCase().includes(q) ||
          tpl.description.toLowerCase().includes(q) ||
          tpl.shortcut.toLowerCase().includes(q) ||
          tpl.content.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [category, search]);

  const handleAddTemplate = async (template: LibraryTemplate) => {
    setError(null);

    if (template.tier === 'pro' && !entitlement.limits.premiumTemplates) {
      onNavigatePlan();
      return;
    }

    try {
      // Pick matching folder by name if available, otherwise Unfiled
      const categoryName = TEMPLATE_CATEGORY_LABELS[template.category].toLowerCase();
      const matchingFolder = folders.find(
        (f) => f.name.toLowerCase() === categoryName,
      );

      // Avoid collision automatically if shortcut already exists
      let targetShortcut = template.shortcut;
      let suffix = 2;
      while (
        findShortcutConflict(
          snippets,
          targetShortcut,
          settings.caseSensitiveShortcuts,
        )
      ) {
        targetShortcut = `${template.shortcut}${suffix}`;
        suffix++;
      }

      await createSnippet(
        {
          name: template.name,
          shortcut: targetShortcut,
          content: template.content,
          folderId: matchingFolder?.id ?? null,
          enabled: true,
        },
        settings.caseSensitiveShortcuts,
      );

      setAddedIds((prev) => new Set(prev).add(template.id));
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates across 7 categories..."
            aria-label="Search template library"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#131722] text-sm"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {filteredTemplates.length} English templates available
        </div>
      </div>

      {/* Interactive Category Filter Bar */}
      <div
        className="flex items-center gap-1.5 flex-wrap"
        role="group"
        aria-label="Template categories"
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#6255E7] text-white'
                  : 'bg-white dark:bg-[#131722] border border-slate-200 dark:border-[#23293A] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2030]'
              }`}
            >
              {cat === 'all' ? 'All Categories' : TEMPLATE_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {filteredTemplates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description="Try another search query or switch back to All Categories."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => {
            const isLocked =
              template.tier === 'pro' && !entitlement.limits.premiumTemplates;
            const isAdded = addedIds.has(template.id);

            return (
              <article
                key={template.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5 gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {template.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{TEMPLATE_CATEGORY_LABELS[template.category]}</span>
                        <span aria-hidden="true">·</span>
                        <code className="font-mono text-[#6255E7] dark:text-[#8E84FF]">
                          {template.shortcut}
                        </code>
                        <span aria-hidden="true">·</span>
                        <span>{template.tier === 'pro' ? 'Pro' : 'Free'}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {template.description}
                  </p>

                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0E14] border border-slate-200/80 dark:border-[#23293A] whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto">
                    {template.content}
                  </pre>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-[#23293A]">
                  {isLocked ? (
                    <Button variant="secondary" size="sm" onClick={onNavigatePlan}>
                      <Lock className="w-3.5 h-3.5" />
                      Pro Template
                    </Button>
                  ) : isAdded ? (
                    <Button variant="secondary" size="sm" disabled>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Added to Snippets
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddTemplate(template)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Snippets
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
