import { STORAGE_KEYS, type PlanTier } from '../../types/extension';
import { storageAdapter } from '../../services/storage/storageAdapter';
import {
  PLAN_LIMITS,
  type EntitlementFeature,
  type EntitlementProvider,
  type EntitlementState,
} from './types';

/**
 * Development preview flag — strictly enabled ONLY in Vite dev mode (`npm run dev`).
 * In production builds (`npm run build`), `import.meta.env.DEV` is statically compiled to `false`
 * across popup, options, content script, and service worker bundles so local storage flags
 * can never unlock Pro features without a server-verified license adapter.
 */
export const ALLOW_DEV_ENTITLEMENT_PREVIEW: boolean =
  import.meta.env.DEV === true;

export function evaluateFeatureAccess(
  state: EntitlementState,
  feature: EntitlementFeature,
): boolean {
  switch (feature) {
    case 'unlimited_snippets':
      return !Number.isFinite(state.limits.maxSnippets);
    case 'unlimited_folders':
      return !Number.isFinite(state.limits.maxFolders);
    case 'advanced_variables':
      return state.limits.advancedVariables;
    case 'advanced_stats':
      return state.limits.advancedStats;
    case 'premium_templates':
      return state.limits.premiumTemplates;
  }
}

class LocalEntitlementService implements EntitlementProvider {
  async getEntitlement(): Promise<EntitlementState> {
    if (import.meta.env.DEV) {
      const devTier = await storageAdapter.get<PlanTier>(STORAGE_KEYS.DEV_ENTITLEMENT_TIER);
      if (devTier === 'pro') {
        return {
          tier: 'pro',
          source: 'dev-only-override',
          isDevelopmentPreview: true,
          limits: PLAN_LIMITS.pro,
          verifiedAt: null,
        };
      }
    }

    return {
      tier: 'free',
      source: 'default-free',
      isDevelopmentPreview: false,
      limits: PLAN_LIMITS.free,
      verifiedAt: null,
    };
  }

  async canUseFeature(feature: EntitlementFeature): Promise<boolean> {
    const state = await this.getEntitlement();
    return evaluateFeatureAccess(state, feature);
  }

  /**
   * Development-only helper to inspect Free vs Pro UX states during local development and QA.
   * Explicitly labeled in the UI as development-only — completely compiled out of production builds.
   */
  async setDevelopmentPreviewTier(tier: PlanTier): Promise<EntitlementState> {
    if (!import.meta.env.DEV) {
      return this.getEntitlement();
    }
    await storageAdapter.set(STORAGE_KEYS.DEV_ENTITLEMENT_TIER, tier);
    return this.getEntitlement();
  }
}

export const entitlementService = new LocalEntitlementService();
