import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import StatCard from '../components/StatCard';
import { adminApi } from '../../../shared/api/client';
import { TrendingUp, Users, DollarSign, Activity, Loader2, AlertCircle } from 'lucide-react';

export default function Analytics() {
  const [activityPage, setActivityPage] = useState(1);
  const activityLimit = 20;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getSystemStats(),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-activity', activityPage],
    queryFn: () => adminApi.getUserActivity({ page: activityPage, limit: activityLimit }),
  });

  const activities = activityData?.data.activities || [];
  const totalActivities = activityData?.data.total || 0;
  const totalPages = Math.ceil(totalActivities / activityLimit);

  return (
    <div className="flex h-screen bg-gray-100">
      <Navigation />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-1">System performance and user activity</p>
          </div>

          {/* Key Metrics */}
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : stats ? (
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <StatCard
                icon={<Users className="w-6 h-6 text-primary-600" />}
                label="Total Users"
                value={stats.data.total_users || 0}
              />
              <StatCard
                icon={<Activity className="w-6 h-6 text-green-600" />}
                label="Active Users"
                value={stats.data.active_users || 0}
              />
              <StatCard
                icon={<DollarSign className="w-6 h-6 text-blue-600" />}
                label="Monthly Revenue"
                value={`$${stats.data.mrr || 0}`}
              />
              <StatCard
                icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
                label="Conversion"
                value={`${stats.data.conversion_rate || 0}%`}
              />
            </div>
          ) : null}

          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                <p>Revenue analytics integration pending</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                <p>User growth chart coming soon</p>
              </div>
            </div>
          </div>

          {/* User Activity Log */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>

            {activityLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activities.map((activity, index: number) => (
                        <tr key={activity.id || index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{activity.user_name}</div>
                              <div className="text-sm text-gray-500">{activity.user_email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {activity.activity_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {activity.details && typeof activity.details === 'object' ? (
                              <div className="text-xs">
                                {Object.entries(activity.details).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {String(value)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(activity.activity_date).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Page {activityPage} of {totalPages}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                        disabled={activityPage === 1}
                        className={`px-4 py-2 text-sm font-medium rounded-lg ${
                          activityPage === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setActivityPage(p => Math.min(totalPages, p + 1))}
                        disabled={activityPage === totalPages}
                        className={`px-4 py-2 text-sm font-medium rounded-lg ${
                          activityPage === totalPages
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
