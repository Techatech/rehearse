import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import StatCard from '../components/StatCard';
import { adminApi } from '../../../shared/api/client';
import { Users, Activity, DollarSign, TrendingUp, Loader2, AlertCircle } from 'lucide-react';

export default function Overview() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getSystemStats(),
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <Navigation />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-gray-600 mt-1">System statistics and key metrics</p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Failed to load stats</h3>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {stats && (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={<Users className="w-6 h-6 text-primary-600" />}
                  label="Total Users"
                  value={stats.data.total_users || 0}
                />
                <StatCard
                  icon={<Activity className="w-6 h-6 text-green-600" />}
                  label="Active Users (30d)"
                  value={stats.data.active_users || 0}
                />
                <StatCard
                  icon={<DollarSign className="w-6 h-6 text-blue-600" />}
                  label="MRR"
                  value={`$${stats.data.mrr || 0}`}
                />
                <StatCard
                  icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
                  label="Conversion Rate"
                  value={`${stats.data.conversion_rate || 0}%`}
                />
              </div>

              {/* Secondary Stats */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Interviews</h3>
                  <p className="text-2xl font-bold text-gray-900">{stats.data.total_interviews || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Practice Hours</h3>
                  <p className="text-2xl font-bold text-gray-900">{stats.data.total_practice_hours || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Churn Rate</h3>
                  <p className="text-2xl font-bold text-gray-900">{stats.data.churn_rate || 0}%</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <a
                    href="/users"
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <Users className="w-6 h-6 text-primary-600 mb-2" />
                    <h4 className="font-medium text-gray-900">Manage Users</h4>
                    <p className="text-sm text-gray-600 mt-1">View and edit user accounts</p>
                  </a>
                  <a
                    href="/analytics"
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <TrendingUp className="w-6 h-6 text-primary-600 mb-2" />
                    <h4 className="font-medium text-gray-900">View Analytics</h4>
                    <p className="text-sm text-gray-600 mt-1">Detailed analytics and reports</p>
                  </a>
                  <a
                    href="/system"
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <Activity className="w-6 h-6 text-primary-600 mb-2" />
                    <h4 className="font-medium text-gray-900">System Health</h4>
                    <p className="text-sm text-gray-600 mt-1">Monitor system status</p>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
