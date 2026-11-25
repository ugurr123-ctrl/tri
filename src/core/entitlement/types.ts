import type { PlanTier } from '../../types/extension';

export type EntitlementFeature =
  | 'unlimited_snippets'
  | 'unlimited_folders'
  | 'advanced_variables'
  | 'advanced_stats'
  | 'premium_templates';

export interface PlanLimits {
  maxSnippets: number;
  maxFolders: number;
  advancedVariables: boolean;
  advancedStats: boolean;
  premiumTemplates: boolean;
}

export interface EntitlementState {
  tier: PlanTier;
  source: 'default-free' | 'dev-only-override' | 'verified-server-license';
  isDevelopmentPreview: boolean;
  limits: PlanLimits;
  verifiedAt: string | null;
}

/**
 * Clean contract for future payment & server-side license verification integration.
 * Implementations MUST verify licenses on a trusted backend service rather than trusting client-side flags.
 */
export interface EntitlementProvider {
  getEntitlement(): Promise<EntitlementState>;
  canUseFeature(feature: EntitlementFeature): Promise<boolean>;
  /**
   * Future integration entry point for server-side license/checkout verification.
   * Intentionally unimplemented in MVP to avoid insecure client-only license validation.
   */
  refreshFromServer?: (signedToken: string) => Promise<EntitlementState>;
}

export const PLAN_PRICING = {
  proOneTimePriceUsd: 14.99,
  proDisplayPrice: '$14.99',
  proCadenceLabel: 'One-time purchase',
} as const;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxSnippets: 30,
    maxFolders: 3,
    advancedVariables: false,
    advancedStats: false,
    premiumTemplates: false,
  },
  pro: {
    maxSnippets: Number.POSITIVE_INFINITY,
    maxFolders: Number.POSITIVE_INFINITY,
    advancedVariables: true,
    advancedStats: true,
    premiumTemplates: true,
  },
};
