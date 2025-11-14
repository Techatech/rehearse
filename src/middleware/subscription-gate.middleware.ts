export interface SubscriptionGateConfig {
  requiredTier: 'basic' | 'pro' | 'enterprise';
  featureName: string;
}

export interface UserSubscription {
  id: number;
  subscription_tier: string;
  subscription_status: string;
  trial_ends_at: string | null;
}

export class SubscriptionGate {
  private tierHierarchy: Record<string, number> = {
    basic: 1,
    pro: 2,
    enterprise: 3,
  };

  /**
   * Check if user has access to a feature based on their subscription
   */
  async checkAccess(
    user: UserSubscription,
    config: SubscriptionGateConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check if subscription is active or in trial
    if (!this.isSubscriptionActive(user)) {
      return {
        allowed: false,
        reason: 'Subscription expired or cancelled. Please renew your subscription.',
      };
    }

    // Check if user's tier meets the requirement
    const userTierLevel = this.tierHierarchy[user.subscription_tier] || 0;
    const requiredTierLevel = this.tierHierarchy[config.requiredTier] || 0;

    if (userTierLevel < requiredTierLevel) {
      return {
        allowed: false,
        reason: `This feature requires ${config.requiredTier} subscription. Your current plan: ${user.subscription_tier}.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if subscription is currently active (including trial period)
   */
  private isSubscriptionActive(user: UserSubscription): boolean {
    // Active subscriptions
    if (user.subscription_status === 'active') {
      return true;
    }

    // Check trial period
    if (user.subscription_status === 'trial' && user.trial_ends_at) {
      const trialEnd = new Date(user.trial_ends_at);
      const now = new Date();
      return now < trialEnd;
    }

    return false;
  }

  /**
   * Get feature limits based on subscription tier
   */
  getFeatureLimits(tier: string): {
    maxInterviewsPerMonth: number;
    maxPersonasPerInterview: number;
    advancedAnalytics: boolean;
    exportTranscripts: boolean;
    customPersonas: boolean;
  } {
    switch (tier) {
      case 'basic':
        return {
          maxInterviewsPerMonth: 5,
          maxPersonasPerInterview: 1,
          advancedAnalytics: false,
          exportTranscripts: false,
          customPersonas: false,
        };
      case 'pro':
        return {
          maxInterviewsPerMonth: 50,
          maxPersonasPerInterview: 3,
          advancedAnalytics: true,
          exportTranscripts: true,
          customPersonas: true,
        };
      case 'enterprise':
        return {
          maxInterviewsPerMonth: -1, // unlimited
          maxPersonasPerInterview: -1, // unlimited
          advancedAnalytics: true,
          exportTranscripts: true,
          customPersonas: true,
        };
      default:
        return {
          maxInterviewsPerMonth: 0,
          maxPersonasPerInterview: 0,
          advancedAnalytics: false,
          exportTranscripts: false,
          customPersonas: false,
        };
    }
  }

  /**
   * Check usage limits for the current billing period
   */
  async checkUsageLimit(
    user: UserSubscription,
    currentUsage: number,
    limitType: 'interviews'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const limits = this.getFeatureLimits(user.subscription_tier);

    if (limitType === 'interviews') {
      const limit = limits.maxInterviewsPerMonth;

      // Unlimited
      if (limit === -1) {
        return { allowed: true };
      }

      if (currentUsage >= limit) {
        return {
          allowed: false,
          reason: `Monthly interview limit reached (${limit}). Upgrade to continue.`,
        };
      }
    }

    return { allowed: true };
  }
}

export function createSubscriptionGate(): SubscriptionGate {
  return new SubscriptionGate();
}
