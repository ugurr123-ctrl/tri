import {
  AlertTriangle,
  Check,
  Copy,
  Files,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Modal } from '../../components/ui/Modal';
import { Toggle } from '../../components/ui/Toggle';
import type { EntitlementState } from '../../core/entitlement/types';
import { toUserErrorMessage } from '../../core/errors/ExtensionError';
import { resolveTemplate } from '../../core/expander/variableEngine';
import {
  createFolder,
  deleteFolder,
  deleteSnippet,
  duplicateSnippet,
  findAllDuplicateShortcuts,
  renameFolder,
  toggleSnippetEnabled,
} from '../../services/storage/snippetRepository';
import type {
  ExtensionSettings,
  Folder,
  Snippet,
} from '../../types/extension';

interface SnippetsPageProps {
  snippets: Snippet[];
  folders: Folder[];
  settings: ExtensionSettings;
  entitlement: EntitlementState;
  onCreateSnippet: (folderId: string | null) => void;
  onEditSnippet: (snippet: Snippet) => void;
}

type StatusFilter = 'all' | 'active' | 'disabled';

export function SnippetsPage({
  snippets,
  folders,
  settings,
  entitlement,
  onCreateSnippet,
  onEditSnippet,
}: SnippetsPageProps) {
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Folder modal state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');

  // Delete confirmation modal
  const [deletingSnippet, setDeletingSnippet] = useState<Snippet | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const duplicateShortcuts = useMemo(
    () => findAllDuplicateShortcuts(snippets, settings.caseSensitiveShortcuts),
    [snippets, settings.caseSensitiveShortcuts],
  );

  const filteredSnippets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snippets.filter((s) => {
      if (selectedFolder === 'unfiled' && s.folderId !== null) return false;
      if (
        selectedFolder !== 'all' &&
        selectedFolder !== 'unfiled' &&
        s.folderId !== selectedFolder
      ) {
        return false;
      }
      if (statusFilter === 'active' && !s.enabled) return false;
      if (statusFilter === 'disabled' && s.enabled) return false;
      if (q) {
        return (
          s.shortcut.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [snippets, selectedFolder, statusFilter, search]);

  const handleOpenNewFolder = () => {
    setEditingFolder(null);
    setFolderNameInput('');
    setFolderModalOpen(true);
  };

  const handleOpenRenameFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setFolderNameInput(folder.name);
    setFolderModalOpen(true);
  };

  const handleSaveFolder = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingFolder) {
        await renameFolder(editingFolder.id, folderNameInput);
      } else {
        await createFolder(folderNameInput);
      }
      setFolderModalOpen(false);
      setFolderNameInput('');
      setEditingFolder(null);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    setError(null);
    try {
      await deleteFolder(deletingFolder.id);
      if (selectedFolder === deletingFolder.id) {
        setSelectedFolder('all');
      }
      setDeletingFolder(null);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleDuplicate = async (id: string) => {
    setError(null);
    try {
      await duplicateSnippet(id, settings.caseSensitiveShortcuts);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleConfirmDeleteSnippet = async () => {
    if (!deletingSnippet) return;
    setError(null);
    try {
      await deleteSnippet(deletingSnippet.id);
      setDeletingSnippet(null);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setError(null);
    try {
      await toggleSnippetEnabled(id, enabled);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  const handleCopy = async (snippet: Snippet) => {
    try {
      const resolved = resolveTemplate(snippet.content, {
        customVariables: settings.customVariables,
        allowAdvancedVariables: entitlement.limits.advancedVariables,
      });
      await navigator.clipboard.writeText(resolved.text);
      setCopiedId(snippet.id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === snippet.id ? null : curr));
      }, 1500);
    } catch {
      setError('Could not copy snippet to clipboard.');
    }
  };

  const folderCountFor = (folderId: string | null) =>
    snippets.filter((s) => s.folderId === folderId).length;

  const snippetQuotaText = Number.isFinite(entitlement.limits.maxSnippets)
    ? `${snippets.length} / ${entitlement.limits.maxSnippets} snippets`
    : `${snippets.length} snippets (Unlimited)`;

  const folderQuotaText = Number.isFinite(entitlement.limits.maxFolders)
    ? `${folders.length} / ${entitlement.limits.maxFolders}`
    : `${folders.length}`;

  return (
    <div className="space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {duplicateShortcuts.size > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            Duplicate shortcuts detected ({Array.from(duplicateShortcuts).join(', ')}). Edit one of the conflicting snippets so expansions remain predictable.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Folders Column */}
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Folders
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {folderQuotaText} used
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleOpenNewFolder}>
              <FolderPlus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          <nav aria-label="Snippet folders" className="space-y-1">
            <button
              type="button"
              onClick={() => setSelectedFolder('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedFolder === 'all'
                  ? 'bg-[#6255E7]/10 text-[#6255E7] dark:bg-[#6255E7]/20 dark:text-[#A39BFF]'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1B2131]'
              }`}
            >
              <span>All Snippets</span>
              <span className="tabular-nums opacity-75">{snippets.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFolder('unfiled')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedFolder === 'unfiled'
                  ? 'bg-[#6255E7]/10 text-[#6255E7] dark:bg-[#6255E7]/20 dark:text-[#A39BFF]'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1B2131]'
              }`}
            >
              <span>Unfiled</span>
              <span className="tabular-nums opacity-75">{folderCountFor(null)}</span>
            </button>

            <div className="my-2 border-t border-slate-200 dark:border-[#23293A]" />

            {folders.map((folder) => {
              const active = selectedFolder === folder.id;
              return (
                <div
                  key={folder.id}
                  className={`group flex items-center justify-between gap-1 rounded-lg px-2 py-1 transition-colors ${
                    active
                      ? 'bg-[#6255E7]/10 text-[#6255E7] dark:bg-[#6255E7]/20 dark:text-[#A39BFF]'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1B2131]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFolder(folder.id)}
                    className="flex-1 flex items-center justify-between gap-2 px-1 py-1 text-left text-xs font-medium min-w-0 cursor-pointer"
                  >
                    <span className="truncate">{folder.name}</span>
                    <span className="tabular-nums opacity-75 shrink-0">
                      {folderCountFor(folder.id)}
                    </span>
                  </button>

                  <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleOpenRenameFolder(folder)}
                      aria-label={`Rename ${folder.name}`}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#272F45] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingFolder(folder)}
                      aria-label={`Delete ${folder.name}`}
                      className="p-1 rounded hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Snippets Main Column */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by shortcut, name, or text..."
                aria-label="Search snippets"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#131722] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="inline-flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-[#181D2B]"
                role="group"
                aria-label="Filter by status"
              >
                {(['all', 'active', 'disabled'] as StatusFilter[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer transition-colors whitespace-nowrap ${
                      statusFilter === status
                        ? 'bg-white dark:bg-[#232A3E] text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={() =>
                  onCreateSnippet(
                    selectedFolder !== 'all' && selectedFolder !== 'unfiled'
                      ? selectedFolder
                      : null,
                  )
                }
              >
                <Plus className="w-4 h-4" />
                New Snippet
              </Button>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Showing {filteredSnippets.length} of {snippets.length} · {snippetQuotaText}
          </div>

          {filteredSnippets.length === 0 ? (
            <EmptyState
              title={search ? 'No snippets match your search' : 'No snippets in this view'}
              description={
                search
                  ? 'Clear or adjust your search filter to see all saved shortcuts.'
                  : 'Create a new snippet to start expanding shortcuts across websites.'
              }
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    onCreateSnippet(
                      selectedFolder !== 'all' && selectedFolder !== 'unfiled'
                        ? selectedFolder
                        : null,
                    )
                  }
                >
                  New Snippet
                </Button>
              }
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] divide-y divide-slate-200 dark:divide-[#23293A] overflow-hidden">
              {filteredSnippets.map((snippet) => {
                const lookupKey = settings.caseSensitiveShortcuts
                  ? snippet.shortcut
                  : snippet.shortcut.toLowerCase();
                const isDuplicate = duplicateShortcuts.has(lookupKey);
                const folderName = snippet.folderId
                  ? folderMap.get(snippet.folderId) ?? 'Unfiled'
                  : 'Unfiled';

                return (
                  <div
                    key={snippet.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-[#181D2B]/80 transition-colors ${
                      !snippet.enabled ? 'opacity-65' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <code className="font-mono text-sm font-semibold text-[#6255E7] dark:text-[#8E84FF]">
                          {snippet.shortcut}
                        </code>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {snippet.name}
                        </h3>
                        {isDuplicate && (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            · Duplicate shortcut
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                        {snippet.content}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500 tabular-nums pt-0.5">
                        <span>{folderName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{snippet.usageCount.toLocaleString()} expansions</span>
                        <span aria-hidden="true">·</span>
                        <span>{snippet.enabled ? 'Active' : 'Disabled'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Toggle
                        checked={snippet.enabled}
                        onChange={(next) => handleToggle(snippet.id, next)}
                        label={`Toggle ${snippet.name}`}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(snippet)}
                        title="Copy resolved text"
                        aria-label={`Copy ${snippet.name}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#23293A] cursor-pointer"
                      >
                        {copiedId === snippet.id ? (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSnippet(snippet)}
                        title="Edit snippet"
                        aria-label={`Edit ${snippet.name}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#23293A] cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(snippet.id)}
                        title="Duplicate snippet"
                        aria-label={`Duplicate ${snippet.name}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#23293A] cursor-pointer"
                      >
                        <Files className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSnippet(snippet)}
                        title="Delete snippet"
                        aria-label={`Delete ${snippet.name}`}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Rename Folder Modal */}
      <Modal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title={editingFolder ? 'Rename Folder' : 'New Folder'}
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleSaveFolder} className="space-y-4">
          <div>
            <label
              htmlFor="folder-name-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Folder Name
            </label>
            <input
              id="folder-name-input"
              type="text"
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              placeholder="e.g. Sales Outreach"
              maxLength={60}
              required
              autoFocus
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFolderModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingFolder ? 'Save Name' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Snippet Confirmation Modal */}
      <Modal
        open={Boolean(deletingSnippet)}
        onClose={() => setDeletingSnippet(null)}
        title="Delete Snippet"
        maxWidthClass="max-w-sm"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete <strong className="font-semibold text-slate-900 dark:text-white">{deletingSnippet?.name}</strong>{' '}
          (<code className="font-mono text-xs">{deletingSnippet?.shortcut}</code>)? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingSnippet(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDeleteSnippet}>
            Delete Snippet
          </Button>
        </div>
      </Modal>

      {/* Delete Folder Confirmation Modal */}
      <Modal
        open={Boolean(deletingFolder)}
        onClose={() => setDeletingFolder(null)}
        title="Delete Folder"
        maxWidthClass="max-w-sm"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete folder <strong className="font-semibold text-slate-900 dark:text-white">{deletingFolder?.name}</strong>?
          Snippets inside will be kept and moved to Unfiled.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingFolder(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDeleteFolder}>
            Delete Folder
          </Button>
        </div>
      </Modal>
    </div>
  );
}
