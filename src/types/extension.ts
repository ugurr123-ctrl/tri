export type ThemeMode = 'light' | 'dark' | 'system';

export type ExpansionTrigger = 'space' | 'tab';

export type PlanTier = 'free' | 'pro';

export type TemplateCategory =
  | 'customer-support'
  | 'sales'
  | 'ecommerce'
  | 'freelancers'
  | 'business-emails'
  | 'recruitment'
  | 'social-media';

export interface Snippet {
  id: string;
  name: string;
  shortcut: string;
  content: string;
  folderId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt: string | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomVariable {
  id: string;
  key: string;
  label: string;
  value: string;
  updatedAt: string;
}

export interface ExtensionSettings {
  enabled: boolean;
  trigger: ExpansionTrigger;
  theme: ThemeMode;
  excludedDomains: string[];
  caseSensitiveShortcuts: boolean;
  showExpansionFeedback: boolean;
  customVariables: CustomVariable[];
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  expansions: number;
  keystrokesSaved: number;
}

export interface SnippetUsageRecord {
  count: number;
  keystrokesSaved: number;
  lastUsedAt: string;
}

export interface UsageStats {
  totalExpansions: number;
  totalKeystrokesSaved: number;
  dailyHistory: DailyStat[];
  snippetStats: Record<string, SnippetUsageRecord>;
}

export interface LibraryTemplate {
  id: string;
  name: string;
  shortcut: string;
  category: TemplateCategory;
  description: string;
  content: string;
  tier: PlanTier;
}

export interface BackupPayload {
  schemaVersion: number;
  app: 'tavriqelo';
  exportedAt: string;
  snippets: Snippet[];
  folders: Folder[];
  settings: ExtensionSettings;
}

export interface ExtensionStorageState {
  initialized: boolean;
  snippets: Snippet[];
  folders: Folder[];
  settings: ExtensionSettings;
  stats: UsageStats;
  devEntitlementTier?: PlanTier;
}

export const STORAGE_KEYS = {
  INITIALIZED: 'tavriqelo_initialized',
  SNIPPETS: 'tavriqelo_snippets',
  FOLDERS: 'tavriqelo_folders',
  SETTINGS: 'tavriqelo_settings',
  STATS: 'tavriqelo_stats',
  DEV_ENTITLEMENT_TIER: 'tavriqelo_dev_entitlement_tier',
} as const;
