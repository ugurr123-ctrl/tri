import { Check, FlaskConical, Minus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import {
  ALLOW_DEV_ENTITLEMENT_PREVIEW,
  entitlementService,
} from '../../core/entitlement/entitlementService';
import {
  PLAN_PRICING,
  type EntitlementState,
} from '../../core/entitlement/types';
import { toUserErrorMessage } from '../../core/errors/ExtensionError';
import type { PlanTier } from '../../types/extension';

interface PlanPageProps {
  entitlement: EntitlementState;
  snippetCount: number;
  folderCount: number;
}

const COMPARISON_ROWS = [
  {
    feature: 'Saved snippets',
    free: 'Up to 30 snippets',
    pro: 'Unlimited snippets',
  },
  {
    feature: 'Snippet folders',
    free: 'Up to 3 folders',
    pro: 'Unlimited folders',
  },
  {
    feature: 'Basic text expansion (Space / Tab, multiline, undo)',
    free: true,
    pro: true,
  },
  {
    feature: 'Built-in variables (Date, Time, Cursor position)',
    free: true,
    pro: true,
  },
  {
    feature: 'JSON backup import & export',
    free: true,
    pro: true,
  },
  {
    feature: 'Custom user-defined variables ({{var:...}})',
    free: false,
    pro: true,
  },
  {
    feature: 'Interactive placeholder prompts ({{input:...}})',
    free: false,
    pro: true,
  },
  {
    feature: 'Advanced local statistics (14-day trends & folder breakdown)',
    free: false,
    pro: true,
  },
  {
    feature: 'Premium English template library (all 28 templates)',
    free: '14 starter templates',
    pro: 'Full 28-template catalog',
  },
];

export function PlanPage({
  entitlement,
  snippetCount,
  folderCount,
}: PlanPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const handleDevPreviewSwitch = async (tier: PlanTier) => {
    setError(null);
    setSwitching(true);
    try {
      await entitlementService.setDevelopmentPreviewTier(tier);
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Current Plan Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`rounded-xl border p-6 bg-white dark:bg-[#131722] flex flex-col justify-between ${
            entitlement.tier === 'free'
              ? 'border-[#6255E7] dark:border-[#7C71F5]'
              : 'border-slate-200 dark:border-[#23293A]'
          }`}
        >
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Free Plan
              </h2>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {entitlement.tier === 'free' ? 'Current plan' : 'Included'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              For everyday personal shortcuts and quick replies.
            </p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                $0
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                forever
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#23293A] text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            Current usage: {snippetCount} / 30 snippets · {folderCount} / 3 folders
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 bg-white dark:bg-[#131722] flex flex-col justify-between ${
            entitlement.tier === 'pro'
              ? 'border-[#6255E7] dark:border-[#7C71F5]'
              : 'border-slate-200 dark:border-[#23293A]'
          }`}
        >
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Tavriqelo Pro
              </h2>
              <span className="text-xs font-medium text-[#6255E7] dark:text-[#A39BFF]">
                {entitlement.tier === 'pro'
                  ? entitlement.isDevelopmentPreview
                    ? 'Active (Dev-only preview)'
                    : 'Active'
                  : PLAN_PRICING.proCadenceLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              For power users, support teams, recruiters, and founders.
            </p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                {PLAN_PRICING.proDisplayPrice}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                one-time purchase · no subscription
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#23293A] text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Checkout and server-verified license activation are intentionally not stubbed in this MVP. See the integration contract below.
          </div>
        </div>
      </div>

      {/* Concrete Plan Matrix */}
      <section className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#23293A] text-xs font-medium text-slate-500 dark:text-slate-400">
              <th className="py-3.5 px-5">Capability</th>
              <th className="py-3.5 px-5">Free</th>
              <th className="py-3.5 px-5">Pro ({PLAN_PRICING.proDisplayPrice} one-time)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#23293A] text-xs">
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.feature}>
                <td className="py-3 px-5 font-medium text-slate-800 dark:text-slate-200">
                  {row.feature}
                </td>
                <td className="py-3 px-5 text-slate-600 dark:text-slate-400">
                  {typeof row.free === 'boolean' ? (
                    row.free ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Included
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Minus className="w-3.5 h-3.5" /> Not included
                      </span>
                    )
                  ) : (
                    row.free
                  )}
                </td>
                <td className="py-3 px-5 text-slate-800 dark:text-slate-200 font-medium">
                  {typeof row.pro === 'boolean' ? (
                    row.pro ? (
                      <span className="inline-flex items-center gap-1 text-[#6255E7] dark:text-[#A39BFF]">
                        <Check className="w-3.5 h-3.5" /> Included
                      </span>
                    ) : (
                      <Minus className="w-3.5 h-3.5 text-slate-400" />
                    )
                  ) : (
                    row.pro
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Transparent Server-Verified Entitlement Architecture Note */}
      <section className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5 space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <ShieldCheck className="w-4 h-4 text-[#6255E7] dark:text-[#8E84FF]" />
          <span>Entitlement &amp; License Verification Architecture</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          All feature gates and plan quotas route through the typed{' '}
          <code className="font-mono text-slate-800 dark:text-slate-200">
            EntitlementProvider
          </code>{' '}
          interface in <code className="font-mono">src/core/entitlement/</code>. To uphold security and Chrome Web Store policy compliance, this release does not include fake payment screens or client-only license validation. Production payments ($14.99 one-time) will connect to a hosted payment provider (such as Stripe Checkout or Lemon Squeezy) paired with a lightweight server endpoint issuing cryptographically signed entitlement tokens.
        </p>
      </section>

      {/* Development-Only Test Entitlement Switcher */}
      {ALLOW_DEV_ENTITLEMENT_PREVIEW && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <FlaskConical className="w-4 h-4 shrink-0" />
              <span>Development-Only Entitlement Preview (Not a Real License)</span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 max-w-xl leading-relaxed">
              For local testing and QA only. Toggle between Free and Pro UI states to inspect quota limits, advanced variables, premium templates, and 14-day statistics before connecting a production billing backend.
            </p>
          </div>

          <div
            className="inline-flex items-center p-1 rounded-lg bg-white dark:bg-[#131722] border border-amber-200 dark:border-amber-900/60 shrink-0"
            role="group"
            aria-label="Development entitlement tier preview"
          >
            <button
              type="button"
              disabled={switching}
              onClick={() => handleDevPreviewSwitch('free')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                entitlement.tier === 'free'
                  ? 'bg-[#6255E7] text-white'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              Free (Default)
            </button>
            <button
              type="button"
              disabled={switching}
              onClick={() => handleDevPreviewSwitch('pro')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                entitlement.tier === 'pro'
                  ? 'bg-[#6255E7] text-white'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              Pro (Dev Only)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
