import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { User, Mail, Calendar, Crown, Clock } from 'lucide-react';

export default function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const createdAt = new Date(user.created_at);
  const isTrialActive = user.subscription_status === 'trial' && trialEndsAt && trialEndsAt > new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-gray-600 mt-1">Manage your account and subscription details</p>
          </div>

          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h2>

            <div className="space-y-4">
              <div className="flex items-start">
                <User className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Full Name</p>
                  <p className="text-base text-gray-900 mt-1">{user.name}</p>
                </div>
              </div>

              <div className="flex items-start">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Email Address</p>
                  <p className="text-base text-gray-900 mt-1">{user.email}</p>
                </div>
              </div>

              <div className="flex items-start">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Member Since</p>
                  <p className="text-base text-gray-900 mt-1">
                    {createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Information */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscription Details</h2>

            <div className="space-y-4">
              <div className="flex items-start">
                <Crown className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Current Plan</p>
                  <p className="text-base text-gray-900 mt-1 capitalize">
                    {user.subscription_tier} Plan
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.subscription_status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : user.subscription_status === 'trial'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.subscription_status === 'active' && 'Active'}
                      {user.subscription_status === 'trial' && 'Free Trial'}
                      {user.subscription_status === 'cancelled' && 'Cancelled'}
                    </span>
                  </div>
                </div>
              </div>

              {isTrialActive && trialEndsAt && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Free Trial Active:</strong> Your 3-day Pro trial ends on{' '}
                    {trialEndsAt.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Upgrade to continue Pro features →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Manage Subscription</h2>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/pricing')}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <p className="font-medium text-gray-900">View Pricing Plans</p>
                <p className="text-sm text-gray-600 mt-1">
                  Compare plans and upgrade your subscription
                </p>
              </button>

              <button
                onClick={() => navigate('/billing')}
                className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
              >
                <p className="font-medium text-gray-900">Billing & Payment</p>
                <p className="text-sm text-gray-600 mt-1">
                  View payment history and manage payment methods
                </p>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
