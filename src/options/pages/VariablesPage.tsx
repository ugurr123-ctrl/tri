import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Modal } from '../../components/ui/Modal';
import type { EntitlementState } from '../../core/entitlement/types';
import { toUserErrorMessage } from '../../core/errors/ExtensionError';
import { formatDateToken, formatTimeToken } from '../../core/expander/variableEngine';
import { sanitizeVariableKey } from '../../core/sanitize/sanitize';
import {
  deleteCustomVariable,
  saveCustomVariable,
} from '../../services/storage/settingsService';
import type { CustomVariable, ExtensionSettings } from '../../types/extension';

interface VariablesPageProps {
  settings: ExtensionSettings;
  entitlement: EntitlementState;
  onNavigatePlan: () => void;
}

export function VariablesPage({
  settings,
  entitlement,
  onNavigatePlan,
}: VariablesPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomVariable | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const builtInRows = [
    {
      token: '{{date}}',
      tier: 'Free',
      description: 'Current local date (short format)',
      example: formatDateToken(now),
    },
    {
      token: '{{date:YYYY-MM-DD}}',
      tier: 'Free',
      description: 'Current ISO date',
      example: formatDateToken(now, 'YYYY-MM-DD'),
    },
    {
      token: '{{date:long}}',
      tier: 'Free',
      description: 'Current full written date',
      example: formatDateToken(now, 'long'),
    },
    {
      token: '{{time}}',
      tier: 'Free',
      description: 'Current 12-hour local time',
      example: formatTimeToken(now),
    },
    {
      token: '{{time:24h}}',
      tier: 'Free',
      description: 'Current 24-hour local time',
      example: formatTimeToken(now, '24h'),
    },
    {
      token: '{{cursor}}',
      tier: 'Free',
      description: 'Places the text caret here after expansion',
      example: 'Cursor lands at marker',
    },
    {
      token: '{{input:Client Name}}',
      tier: 'Pro',
      description: 'Opens a quick prompt when expanding to fill in a value',
      example: 'Prompts for "Client Name"',
    },
    {
      token: '{{input:Plan|default=Team}}',
      tier: 'Pro',
      description: 'Interactive prompt field with a prefilled default value',
      example: 'Defaults to "Team"',
    },
    {
      token: '{{var:company}}',
      tier: 'Pro',
      description: 'Substitutes a custom user-defined variable below',
      example:
        settings.customVariables.find((v) => v.key === 'company')?.value ||
        'Acme Studio',
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setKeyInput('');
    setLabelInput('');
    setValueInput('');
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (variable: CustomVariable) => {
    setEditing(variable);
    setKeyInput(variable.key);
    setLabelInput(variable.label);
    setValueInput(variable.value);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await saveCustomVariable({
        id: editing?.id,
        key: keyInput,
        label: labelInput || keyInput,
        value: valueInput,
      });
      setModalOpen(false);
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteCustomVariable(id);
    } catch (err) {
      setError(toUserErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Built-in Placeholder Reference */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Supported Template Variables
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Insert any of these placeholders into your snippet text to dynamically compute values at expansion time.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#23293A] text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Placeholder</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Behavior</th>
                <th className="py-3 px-4">Live Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#23293A] text-xs">
              {builtInRows.map((row) => (
                <tr key={row.token} className="hover:bg-slate-50 dark:hover:bg-[#181D2B]">
                  <td className="py-3 px-4 font-mono font-medium text-[#6255E7] dark:text-[#8E84FF] whitespace-nowrap">
                    {row.token}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {row.tier}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {row.description}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {row.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Custom User-Defined Variables */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Custom User-Defined Variables
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reuse personal details like your name, company, or booking URL across snippets via <code className="font-mono">{'{{var:key}}'}</code>.
            </p>
          </div>

          {entitlement.limits.advancedVariables ? (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              New Variable
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onNavigatePlan}>
              <Lock className="w-3.5 h-3.5" />
              Pro Feature
            </Button>
          )}
        </div>

        {!entitlement.limits.advancedVariables && (
          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Advanced variables require Tavriqelo Pro
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                Free plan supports date, time, and cursor positioning. Upgrade to Pro ($14.99 one-time) to create reusable custom variables and interactive prompt placeholders.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onNavigatePlan}>
              View Plan Details
            </Button>
          </div>
        )}

        {settings.customVariables.length === 0 ? (
          <EmptyState
            title="No custom variables defined"
            description="Add reusable fields such as your full name, company, or calendar link."
            action={
              entitlement.limits.advancedVariables ? (
                <Button variant="primary" size="sm" onClick={openCreate}>
                  Add Custom Variable
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] divide-y divide-slate-200 dark:divide-[#23293A]">
            {settings.customVariables.map((variable) => (
              <div
                key={variable.id}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <code className="font-mono font-semibold text-[#6255E7] dark:text-[#8E84FF]">
                      {`{{var:${variable.key}}}`}
                    </code>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {variable.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 truncate">
                    {variable.value}
                  </p>
                </div>

                {entitlement.limits.advancedVariables && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(variable)}
                      aria-label={`Edit ${variable.label}`}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#23293A] cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(variable.id)}
                      aria-label={`Delete ${variable.label}`}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Custom Variable' : 'New Custom Variable'}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="var-key"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Variable Key
            </label>
            <input
              id="var-key"
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(sanitizeVariableKey(e.target.value))}
              placeholder="e.g. signature"
              required
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] font-mono text-sm"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Referenced as <code className="font-mono">{`{{var:${keyInput || 'key'}}}`}</code>
            </p>
          </div>

          <div>
            <label
              htmlFor="var-label"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Display Label
            </label>
            <input
              id="var-label"
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="e.g. Email Signature"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="var-value"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Value
            </label>
            <textarea
              id="var-value"
              rows={3}
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder="Text substituted whenever this variable is used"
              required
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-[#2A3145] bg-white dark:bg-[#0B0E14] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Variable'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
