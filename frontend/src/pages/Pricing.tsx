import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rehearseApi } from '../lib/api';
import { Check, Loader2, Crown, Zap, Building2 } from 'lucide-react';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  priceId: string;
  icon: React.ReactNode;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'Free',
    priceId: 'price_1ST2ZjRkz39e5tzDD5VPFMw7',
    icon: <Zap className="w-6 h-6" />,
    description: 'Perfect for getting started',
    features: [
      '5 interviews per month',
      '1 persona per interview',
      'Practice mode only',
      'Basic analytics',
      'Email support',
    ],
    cta: 'Current Plan',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    priceId: 'price_1ST2cmRkz39e5tzDWbajLTYW',
    icon: <Crown className="w-6 h-6" />,
    description: 'For serious interview preparation',
    features: [
      '50 interviews per month',
      'Up to 3 personas per interview',
      'Practice & graded modes',
      'Advanced analytics',
      'Export transcripts',
      'Custom personas',
      'Priority email support',
      '3-day free trial',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$99',
    priceId: 'price_1ST2eKRkz39e5tzDy7FPf9np',
    icon: <Building2 className="w-6 h-6" />,
    description: 'For teams and organizations',
    features: [
      'Unlimited interviews',
      'Unlimited personas per interview',
      'Practice & graded modes',
      'Advanced analytics',
      'Export transcripts',
      'Custom personas',
      'Team management',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Get Started',
  },
];

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: PricingTier) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!user) return;

    // Don't allow downgrade to basic or subscribing to current tier
    if (tier.id === 'basic' || tier.id === user.subscription_tier) {
      return;
    }

    setLoadingTier(tier.id);

    try {
      const response = await rehearseApi.createCheckoutSession({
        user_id: user.id,
        price_id: tier.priceId,
        success_url: `${window.location.origin}/dashboard?checkout=success`,
        cancel_url: `${window.location.origin}/pricing?checkout=cancelled`,
      });

      // Redirect to Stripe Checkout
      window.location.href = response.data.checkoutUrl;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setLoadingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setLoadingTier('manage');

    try {
      const response = await rehearseApi.createPortalSession({
        user_id: user.id,
        return_url: `${window.location.origin}/pricing`,
      });

      // Redirect to Stripe Billing Portal
      window.location.href = response.data.portalUrl;
    } catch (error) {
      console.error('Failed to create portal session:', error);
      setLoadingTier(null);
    }
  };

  const getButtonText = (tier: PricingTier) => {
    if (!isAuthenticated) return 'Sign in to Subscribe';
    if (user?.subscription_tier === tier.id) return 'Current Plan';
    if (tier.id === 'basic') return 'Downgrade';
    return tier.cta;
  };

  const isButtonDisabled = (tier: PricingTier) => {
    if (!isAuthenticated) return false;
    return tier.id === 'basic' || tier.id === user?.subscription_tier;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pricing Plans</h1>
              <p className="text-gray-600 mt-1">Choose the perfect plan for your needs</p>
            </div>
            {isAuthenticated && (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Current Subscription Banner */}
        {user && (
          <div className="max-w-4xl mx-auto mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800">
                <strong>Current Plan:</strong> {user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1)}
                {' • '}
                <span className="capitalize">{user.subscription_status}</span>
                {user.trial_ends_at && user.subscription_status === 'trial' && (
                  <span> (Trial ends {new Date(user.trial_ends_at).toLocaleDateString()})</span>
                )}
              </p>
            </div>
            <button
              onClick={handleManageSubscription}
              disabled={loadingTier === 'manage'}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loadingTier === 'manage' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Manage Subscription'
              )}
            </button>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
                tier.highlighted ? 'ring-2 ring-primary-600' : ''
              }`}
            >
              {tier.highlighted && (
                <div className="bg-primary-600 text-white text-center py-2 text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="p-8">
                {/* Icon & Name */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600">
                    {tier.icon}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{tier.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  {tier.price !== 'Free' && <span className="text-gray-600">/month</span>}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={isButtonDisabled(tier) || loadingTier === tier.id}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mb-6 flex items-center justify-center ${
                    tier.highlighted
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loadingTier === tier.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    getButtonText(tier)
                  )}
                </button>

                {/* Features */}
                <div className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="max-w-4xl mx-auto mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions about pricing?</h2>
          <p className="text-gray-600 mb-6">
            All plans include secure authentication, encrypted data storage, and regular updates.
          </p>
          <p className="text-sm text-gray-500">
            You can upgrade, downgrade, or cancel your subscription at any time.
          </p>
        </div>
      </main>
    </div>
  );
}
