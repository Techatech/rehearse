import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import { adminApi } from '../../../shared/api/client';
import { Loader2, AlertCircle, CheckCircle, Activity, Database, Server } from 'lucide-react';

export default function SystemHealth() {
  const { data: health, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => adminApi.getSystemHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const healthData = health?.data;
  const isHealthy = healthData?.status === 'healthy';

  return (
    <div className="flex h-screen bg-gray-100">
      <Navigation />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
              <p className="text-gray-600 mt-1">Monitor system status and performance</p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
            >
              <Activity className="w-4 h-4 mr-2" />
              Refresh
            </button>
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
                <h3 className="text-sm font-medium text-red-800">Failed to check system health</h3>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {/* Health Status */}
          {healthData && (
            <>
              {/* Overall Status Card */}
              <div className={`rounded-lg p-6 mb-8 ${
                isHealthy
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center">
                  {isHealthy ? (
                    <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600 mr-4" />
                  )}
                  <div>
                    <h2 className={`text-2xl font-bold ${
                      isHealthy ? 'text-green-900' : 'text-red-900'
                    }`}>
                      System {healthData.status === 'healthy' ? 'Healthy' : 'Degraded'}
                    </h2>
                    <p className={`${
                      isHealthy ? 'text-green-700' : 'text-red-700'
                    }`}>
                      All services are operational
                    </p>
                  </div>
                </div>
              </div>

              {/* Component Health */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Database */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <Database className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Database</h3>
                        <p className="text-sm text-gray-500">SQL Database</p>
                      </div>
                    </div>
                    {healthData.database?.connected ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status</span>
                      <span className={`font-medium ${
                        healthData.database?.connected ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {healthData.database?.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* API Server */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <Server className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">API Server</h3>
                        <p className="text-sm text-gray-500">Cloudflare Workers</p>
                      </div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status</span>
                      <span className="font-medium text-green-600">Running</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Info */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Last Check</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date().toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Platform</p>
                    <p className="text-sm font-medium text-gray-900">Cloudflare Workers</p>
                  </div>
                </div>
              </div>

              {/* Logs Section */}
              <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Logs</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                  <p>Log integration pending - use Cloudflare Dashboard for now</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
