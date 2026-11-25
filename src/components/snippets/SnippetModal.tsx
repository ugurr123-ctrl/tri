import { AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  containsAdvancedVariables,
  extractInputPlaceholders,
  resolveTemplate,
} from '../../core/expander/variableEngine';
import { toUserErrorMessage } from '../../core/errors/ExtensionError';
import {
  normalizeShortcut,
  validateShortcut,
} from '../../core/sanitize/sanitize';
import { findShortcutConflict } from '../../services/storage/snippetRepository';
import type {
  CustomVariable,
  Folder,
  Snippet,
} from '../../types/extension';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

interface SnippetModalProps {
  open: boolean;
  onClose: () => void;
  editingSnippet: Snippet | null;
  snippets: Snippet[];
  folders: Folder[];
  customVariables: CustomVariable[];
  caseSensitive: boolean;
  allowAdvancedVariables: boolean;
  defaultFolderId?: string | null;
  onSave: (payload: {
    id?: string;
    name: string;
    shortcut: string;
    content: string;
    folderId: string | null;
    enabled: boolean;
  }) => Promise<void>;
}

const BASIC_TOKENS = [
  { label: 'Date', token: '{{date}}' },
  { label: 'ISO Date', token: '{{date:YYYY-MM-DD}}' },
  { label: 'Time', token: '{{time}}' },
  { label: 'Cursor', token: '{{cursor}}' },
];

const ADVANCED_TOKENS = [
  { label: 'Prompt Field', token: '{{input:Client Name}}' },
  { label: 'Custom Var', token: '{{var:name}}' },
];

export function SnippetModal({
  open,
  onClose,
  editingSnippet,
  snippets,
  folders,
  customVariables,
  caseSensitive,
  allowAdvancedVariables,
  defaultFolderId = null,
  onSave,
}: SnippetModalProps) {
  const [name, setName] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingSnippet) {
      setName(editingSnippet.name);
      setShortcut(editingSnippet.shortcut);
      setContent(editingSnippet.content);
      setFolderId(editingSnippet.folderId);
      setEnabled(editingSnippet.enabled);
    } else {
      setName('');
      setShortcut('/');
      setContent('');
      setFolderId(defaultFolderId);
      setEnabled(true);
    }
    setError(null);
  }, [open, editingSnippet, defaultFolderId]);

  const shortcutValidation = useMemo(() => validateShortcut(shortcut), [shortcut]);

  const conflictingSnippet = useMemo(() => {
    if (!shortcutValidation.valid) return null;
    return findShortcutConflict(
      snippets,
      shortcutValidation.normalized,
      caseSensitive,
      editingSnippet?.id,
    );
  }, [snippets, shortcutValidation, caseSensitive, editingSnippet]);

  const usesAdvanced = useMemo(() => containsAdvancedVariables(content), [content]);

  const resolvedPreview = useMemo(() => {
    if (!content.trim()) return '';
    const sampleInputs: Record<string, string> = {};
    const placeholders = extractInputPlaceholders(content);
    for (const spec of placeholders) {
      sampleInputs[spec.key] = spec.defaultValue || `[${spec.label}]`;
    }
    const resolved = resolveTemplate(content, {
      customVariables,
      inputValues: sampleInputs,
      allowAdvancedVariables,
    });
    if (resolved.cursorOffset !== null) {
      return (
        resolved.text.slice(0, resolved.cursorOffset) +
        '|' +
        resolved.text.slice(resolved.cursorOffset)
      );
    }
    return resolved.text;
  }, [content, customVariables, allowAdvancedVariables]);

  const insertTokenAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!shortcutValidation.valid) {
      setError(shortcutValidation.error ?? 'Enter a valid shortcut.');
      return;
    }
    if (conflictingSnippet) {
      setError(
        `Shortcut "${shortcutValidation.normalized}" is already used by "${conflictingSnippet.name}".`,
      );
      return;
    }
    if (!content.trim()) {
      setError('Enter the expanded snippet text.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        id: editingSnippet?.id,
        name: name.trim() || shortcutValidation.normalized,
        shortcut: shortcutValidation.normalized,
        content,
        folderId,
        enabled,
      });
      onClose();
    } catch (err) {
      setError(toUserErrorMessage(err, 'Could not save snippet.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingSnippet ? 'Edit Snippet' : 'New Snippet'}
      description="Type the shortcut followed by your configured trigger key to expand."
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="snippet-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Snippet Name
            </label>
            <input
              id="snippet-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thank-You Reply"
              maxLength={100}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label
              htmlFor="snippet-shortcut"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Shortcut
            </label>
            <input
              id="snippet-shortcut"
              type="text"
              value={shortcut}
              onChange={(e) => setShortcut(normalizeShortcut(e.target.value))}
              placeholder="/thanks"
              maxLength={32}
              required
              className={`w-full h-9 px-3 rounded-lg border bg-white dark:bg-[#0B0E14] font-mono text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 ${
                conflictingSnippet
                  ? 'border-amber-500 dark:border-amber-500'
                  : 'border-slate-200 dark:border-[#2A3145]'
              }`}
            />
            {conflictingSnippet && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Duplicate shortcut already used by "{conflictingSnippet.name}".</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label
              htmlFor="snippet-folder"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Folder
            </label>
            <select
              id="snippet-folder"
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Unfiled</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-slate-50 dark:bg-[#0F131E]">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Snippet active
            </span>
            <Toggle
              checked={enabled}
              onChange={setEnabled}
              label="Enable snippet"
              size="sm"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="snippet-content"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Expanded Text (multiline supported)
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {BASIC_TOKENS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => insertTokenAtCursor(item.token)}
                  className="px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-[#2A3145] bg-slate-50 hover:bg-slate-100 dark:bg-[#181D2B] dark:hover:bg-[#22293C] text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  + {item.label}
                </button>
              ))}
              {ADVANCED_TOKENS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => insertTokenAtCursor(item.token)}
                  title={
                    allowAdvancedVariables
                      ? `Insert ${item.token}`
                      : 'Pro variable syntax'
                  }
                  className="px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-[#2A3145] bg-slate-50 hover:bg-slate-100 dark:bg-[#181D2B] dark:hover:bg-[#22293C] text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            id="snippet-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the full text that will replace your shortcut..."
            required
            className="w-full p-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-y"
          />

          {usesAdvanced && !allowAdvancedVariables && (
            <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
              Custom variables and interactive prompt fields require Tavriqelo Pro to resolve automatically during expansion.
            </p>
          )}
        </div>

        {resolvedPreview && (
          <div className="rounded-lg border border-slate-200 dark:border-[#23293A] bg-slate-50 dark:bg-[#0F131E] p-3">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Expansion preview (| marks final cursor position)
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              {resolvedPreview}
            </pre>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#23293A]">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting || Boolean(conflictingSnippet)}
          >
            {submitting
              ? 'Saving...'
              : editingSnippet
                ? 'Save Changes'
                : 'Create Snippet'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
