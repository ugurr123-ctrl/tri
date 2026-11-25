import { createDefaultStats } from '../../data/defaultData';
import { STORAGE_KEYS, type Snippet, type UsageStats } from '../../types/extension';
import { ensureStorageInitialized, getSnippets } from './snippetRepository';
import { storageAdapter } from './storageAdapter';

// Standard average typing speed: 40 WPM = ~200 characters per minute
const CHARS_PER_MINUTE = 200;
const MAX_DAILY_HISTORY_DAYS = 30;

function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getStats(): Promise<UsageStats> {
  await ensureStorageInitialized();
  const stored = await storageAdapter.get<UsageStats>(STORAGE_KEYS.STATS);
  const defaults = createDefaultStats();
  if (!stored || typeof stored !== 'object') {
    return defaults;
  }
  return {
    totalExpansions: typeof stored.totalExpansions === 'number' ? stored.totalExpansions : 0,
    totalKeystrokesSaved:
      typeof stored.totalKeystrokesSaved === 'number' ? stored.totalKeystrokesSaved : 0,
    dailyHistory: Array.isArray(stored.dailyHistory) ? stored.dailyHistory : [],
    snippetStats:
      stored.snippetStats && typeof stored.snippetStats === 'object' ? stored.snippetStats : {},
  };
}

export async function recordExpansionStats(
  snippetId: string,
  shortcutLength: number,
  expandedLength: number,
): Promise<void> {
  const [stats, snippets] = await Promise.all([getStats(), getSnippets()]);
  const saved = Math.max(0, expandedLength - shortcutLength);
  const nowIso = new Date().toISOString();
  const todayKey = getLocalDateKey();

  const dailyHistory = [...stats.dailyHistory];
  const existingDayIdx = dailyHistory.findIndex((d) => d.date === todayKey);
  if (existingDayIdx >= 0) {
    dailyHistory[existingDayIdx] = {
      ...dailyHistory[existingDayIdx],
      expansions: dailyHistory[existingDayIdx].expansions + 1,
      keystrokesSaved: dailyHistory[existingDayIdx].keystrokesSaved + saved,
    };
  } else {
    dailyHistory.push({
      date: todayKey,
      expansions: 1,
      keystrokesSaved: saved,
    });
  }

  dailyHistory.sort((a, b) => a.date.localeCompare(b.date));
  const trimmedHistory = dailyHistory.slice(-MAX_DAILY_HISTORY_DAYS);

  const prevRecord = stats.snippetStats[snippetId];
  const nextSnippetStats = {
    ...stats.snippetStats,
    [snippetId]: {
      count: (prevRecord?.count ?? 0) + 1,
      keystrokesSaved: (prevRecord?.keystrokesSaved ?? 0) + saved,
      lastUsedAt: nowIso,
    },
  };

  const nextStats: UsageStats = {
    totalExpansions: stats.totalExpansions + 1,
    totalKeystrokesSaved: stats.totalKeystrokesSaved + saved,
    dailyHistory: trimmedHistory,
    snippetStats: nextSnippetStats,
  };

  const nextSnippets: Snippet[] = snippets.map((s) =>
    s.id === snippetId
      ? { ...s, usageCount: (s.usageCount || 0) + 1, lastUsedAt: nowIso }
      : s,
  );

  await storageAdapter.setMany({
    [STORAGE_KEYS.STATS]: nextStats,
    [STORAGE_KEYS.SNIPPETS]: nextSnippets,
  });
}

export function estimateMinutesSaved(keystrokesSaved: number): number {
  if (keystrokesSaved <= 0) return 0;
  return keystrokesSaved / CHARS_PER_MINUTE;
}

export function formatTimeSaved(keystrokesSaved: number): string {
  const totalSeconds = Math.round((keystrokesSaved / CHARS_PER_MINUTE) * 60);
  if (totalSeconds < 60) {
    return `${totalSeconds} sec`;
  }
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}
