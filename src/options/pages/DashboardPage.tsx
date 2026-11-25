import { ArrowRight, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import type { EntitlementState } from '../../core/entitlement/types';
import { formatTimeSaved } from '../../services/storage/statsService';
import type { Folder, Snippet, UsageStats } from '../../types/extension';

interface DashboardPageProps {
  snippets: Snippet[];
  folders: Folder[];
  stats: UsageStats;
  entitlement: EntitlementState;
  onNavigate: (tab: 'snippets' | 'templates' | 'plan') => void;
  onCreateSnippet: () => void;
}

export function DashboardPage({
  snippets,
  folders,
  stats,
  entitlement,
  onNavigate,
  onCreateSnippet,
}: DashboardPageProps) {
  const activeCount = useMemo(
    () => snippets.filter((s) => s.enabled).length,
    [snippets],
  );

  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const mostUsedSnippets = useMemo(() => {
    return [...snippets]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 6);
  }, [snippets]);

  const last14Days = useMemo(() => {
    const map = new Map(stats.dailyHistory.map((d) => [d.date, d]));
    const days: { date: string; shortLabel: string; expansions: number }[] = [];
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const record = map.get(key);
      days.push({
        date: key,
        shortLabel: `${Number(m)}/${Number(day)}`,
        expansions: record?.expansions ?? 0,
      });
    }
    return days;
  }, [stats.dailyHistory]);

  const maxDaily = useMemo(
    () => Math.max(1, ...last14Days.map((d) => d.expansions)),
    [last14Days],
  );

  const folderUsage = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of snippets) {
      const label = s.folderId ? folderMap.get(s.folderId) ?? 'Unfiled' : 'Unfiled';
      totals.set(label, (totals.get(label) ?? 0) + s.usageCount);
    }
    return Array.from(totals.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [snippets, folderMap]);

  return (
    <div className="space-y-8">
      {/* KPI Metrics Grid */}
      <section aria-label="Usage overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Snippets
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {snippets.length}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {activeCount} active · {folders.length} folders
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Expansions
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {stats.totalExpansions.toLocaleString()}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Recorded locally in Chrome
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Estimated Keystrokes Saved
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {stats.totalKeystrokesSaved.toLocaleString()}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Characters expanded automatically
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Estimated Time Saved
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {formatTimeSaved(stats.totalKeystrokesSaved)}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Calculated at 40 WPM baseline
            </div>
          </div>
        </div>
      </section>

      {/* Most Used Snippets */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Most Used Snippets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your highest-frequency shortcuts stored locally on this browser.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('snippets')}>
            View all snippets
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {snippets.length === 0 ? (
          <EmptyState
            title="No snippets created yet"
            description="Add your first shortcut or import from the template library to start tracking local time savings."
            action={
              <Button variant="primary" size="sm" onClick={onCreateSnippet}>
                Create First Snippet
              </Button>
            }
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#23293A] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Shortcut</th>
                  <th className="py-3 px-4">Snippet</th>
                  <th className="py-3 px-4">Folder</th>
                  <th className="py-3 px-4 text-right">Expansions</th>
                  <th className="py-3 px-4 text-right">Keystrokes Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#23293A] text-sm">
                {mostUsedSnippets.map((snippet) => {
                  const rec = stats.snippetStats[snippet.id];
                  const savedChars = rec?.keystrokesSaved ?? 0;
                  const folderName = snippet.folderId
                    ? folderMap.get(snippet.folderId) ?? 'Unfiled'
                    : 'Unfiled';
                  return (
                    <tr
                      key={snippet.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#181D2B] transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#6255E7] dark:text-[#8E84FF] whitespace-nowrap">
                        {snippet.shortcut}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {snippet.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-md">
                          {snippet.content.replace(/\n+/g, ' ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {folderName}
                      </td>
                      <td className="py-3 px-4 text-right text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {snippet.usageCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        {savedChars.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Advanced Local Analytics (Pro Feature) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              14-Day Activity &amp; Folder Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All analytics stay 100% local in Chrome storage and are never sent to external servers.
            </p>
          </div>
          {!entitlement.limits.advancedStats && (
            <Button variant="secondary" size="sm" onClick={() => onNavigate('plan')}>
              <Lock className="w-3.5 h-3.5" />
              Pro Feature
            </Button>
          )}
        </div>

        {entitlement.limits.advancedStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-4">
                Daily Expansions (Last 14 Days)
              </div>
              <div className="h-40 flex items-end gap-1.5">
                {last14Days.map((day) => {
                  const pct = day.expansions > 0 ? Math.max(8, Math.round((day.expansions / maxDaily) * 100)) : 4;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                    >
                      <div
                        title={`${day.date}: ${day.expansions} expansions`}
                        className="w-full flex items-end justify-center h-28"
                      >
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full max-w-[26px] rounded-t-md ${
                            day.expansions > 0
                              ? 'bg-[#6255E7] dark:bg-[#7C71F5]'
                              : 'bg-slate-200 dark:bg-[#23293A]'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums truncate">
                        {day.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-5">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-4">
                Expansions by Folder
              </div>
              {folderUsage.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No folder data yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {folderUsage.map((row) => (
                    <li
                      key={row.name}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {row.name}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                        {row.count.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-[#23293A] bg-white dark:bg-[#131722] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Unlock 14-day trends and folder analytics with Pro
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                Track daily expansion velocity, keystrokes saved by category, and unlimited snippets with a $14.99 one-time upgrade.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => onNavigate('plan')}>
              Compare Plans
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
