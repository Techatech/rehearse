import { useQuery } from '@tanstack/react-query';
import Navigation from '../components/Navigation';
import { api } from '../../../shared/api/client';
import { Loader2, AlertCircle, UserCircle, Plus } from 'lucide-react';

export default function Personas() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.get('/personas'),
  });

  const personas = data?.data?.personas || [];

  return (
    <div className="flex h-screen bg-gray-100">
      <Navigation />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Persona Management</h1>
              <p className="text-gray-600 mt-1">Manage interview personas and their characteristics</p>
            </div>
            <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              <Plus className="w-5 h-5 mr-2" />
              Add Persona
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
                <h3 className="text-sm font-medium text-red-800">Failed to load personas</h3>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {/* Personas Grid */}
          {!isLoading && !error && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {personas.map((persona: any) => (
                <div
                  key={persona.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-7 h-7 text-primary-600" />
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      persona.gender === 'male'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-pink-100 text-pink-800'
                    }`}>
                      {persona.gender}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {persona.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">{persona.role}</p>

                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Voice</p>
                      <p className="text-sm text-gray-900">{persona.voice_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Questioning Style</p>
                      <p className="text-sm text-gray-900">{persona.questioning_style}</p>
                    </div>
                    {persona.focus_areas && persona.focus_areas.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Focus Areas</p>
                        <div className="flex flex-wrap gap-1">
                          {persona.focus_areas.map((area: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button className="flex-1 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
                      Edit
                    </button>
                    <button className="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && personas.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <UserCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No personas found</h3>
              <p className="text-gray-600 mb-6">Get started by creating your first interview persona.</p>
              <button className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                <Plus className="w-5 h-5 mr-2" />
                Add Persona
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
