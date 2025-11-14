import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { CreditCard, ExternalLink, Loader2, Receipt, AlertCircle } from 'lucide-react';
import { rehearseApi } from '../lib/api';

export default function Billing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const handleOpenBillingPortal = async () => {
    setIsLoadingPortal(true);
    setError(null);

    try {
      const response = await rehearseApi.createPortalSession({
        user_id: user.id,
        return_url: window.location.href,
      });

      // Redirect to Stripe Billing Portal
      window.location.href = response.data.portalUrl;
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setError('Failed to open billing portal. Please try again.');
      setIsLoadingPortal(false);
    }
  };

  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const isTrialActive = user.subscription_status === 'trial' && trialEndsAt && trialEndsAt > new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-gray-600 mt-1">Manage your payment methods and view billing history</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Current Subscription */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Subscription</h2>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {user.subscription_tier} Plan
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Status: <span className="capitalize font-medium">{user.subscription_status}</span>
                </p>
                {isTrialActive && trialEndsAt && (
                  <p className="text-sm text-blue-600 mt-1">
                    Trial ends on {trialEndsAt.toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate('/pricing')}
                className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium"
              >
                Change Plan
              </button>
            </div>
          </div>

          {/* Stripe Billing Portal */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment & Billing Management</h2>

            <p className="text-gray-600 mb-6">
              Access the Stripe Customer Portal to manage your payment methods, view invoices,
              and update your billing information.
            </p>

            <div className="space-y-4">
              {/* Billing Portal Button */}
              <button
                onClick={handleOpenBillingPortal}
                disabled={isLoadingPortal}
                className="w-full px-6 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingPortal ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Opening Billing Portal...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Open Billing Portal
                  </>
                )}
              </button>

              {/* Features List */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  In the Billing Portal, you can:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-600">
                    <CreditCard className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Update payment methods and billing details</span>
                  </li>
                  <li className="flex items-start text-sm text-gray-600">
                    <Receipt className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>View and download invoices and receipts</span>
                  </li>
                  <li className="flex items-start text-sm text-gray-600">
                    <CreditCard className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Manage your subscription and payment schedule</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Plan Features */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Plan Includes</h2>

            <div className="space-y-3">
              {user.subscription_tier === 'basic' && (
                <>
                  <FeatureItem text="5 interviews per month" />
                  <FeatureItem text="1 persona per interview" />
                  <FeatureItem text="Practice mode only" />
                  <FeatureItem text="Basic analytics" />
                </>
              )}
              {user.subscription_tier === 'pro' && (
                <>
                  <FeatureItem text="50 interviews per month" />
                  <FeatureItem text="Up to 3 personas per interview" />
                  <FeatureItem text="Practice & graded modes" />
                  <FeatureItem text="Advanced analytics" />
                  <FeatureItem text="Export transcripts" />
                  <FeatureItem text="Custom personas" />
                </>
              )}
              {user.subscription_tier === 'enterprise' && (
                <>
                  <FeatureItem text="Unlimited interviews" />
                  <FeatureItem text="Unlimited personas per interview" />
                  <FeatureItem text="Practice & graded modes" />
                  <FeatureItem text="Advanced analytics" />
                  <FeatureItem text="Export transcripts" />
                  <FeatureItem text="Custom personas" />
                  <FeatureItem text="Team management" />
                  <FeatureItem text="Dedicated support" />
                </>
              )}
            </div>

            {user.subscription_tier === 'basic' && (
              <button
                onClick={() => navigate('/pricing')}
                className="mt-6 w-full px-4 py-3 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium"
              >
                Upgrade to unlock more features
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center text-sm text-gray-700">
      <svg
        className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      {text}
    </div>
  );
}
