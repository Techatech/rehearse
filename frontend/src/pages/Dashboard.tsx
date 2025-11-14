import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Clock, TrendingUp, Loader2, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { rehearseApi } from '../lib/api';
import { formatDate, formatDuration } from '../lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 1;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch interviews
  const { data: interviewsData, isLoading } = useQuery({
    queryKey: ['interviews', userId],
    queryFn: () => rehearseApi.getInterviews(userId),
  });

  const interviews = interviewsData?.data?.interviews || [];

  // Fetch analytics for completed interviews to calculate average score
  const completedInterviews = interviews.filter(i => i.status === 'completed');

  const { data: analyticsResults } = useQuery({
    queryKey: ['averageScore', completedInterviews.map(i => i.id)],
    queryFn: async () => {
      const results = await Promise.allSettled(
        completedInterviews.map(interview =>
          rehearseApi.getInterviewAnalytics(interview.id)
        )
      );
      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value.data);
    },
    enabled: completedInterviews.length > 0,
  });

  // Calculate stats
  const totalInterviews = interviews.length;
  const totalHours = interviews.reduce((sum, interview) => {
    return sum + (interview.duration_minutes || 0);
  }, 0);

  // Calculate average score from analytics
  const averageScore = (() => {
    if (!analyticsResults || analyticsResults.length === 0) return '--';
    const scores = analyticsResults
      .filter(a => a && a.overall_grade > 0)
      .map(a => a.overall_grade);
    if (scores.length === 0) return '--';
    const avg = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    return avg.toString();
  })();

  // Pagination logic
  const totalPages = Math.ceil(interviews.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInterviews = interviews.slice(startIndex, endIndex);

  // Reset to first page when interviews change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [interviews.length, currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your interview practice progress</p>
        </div>
        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={<Calendar className="w-8 h-8 text-blue-600" />}
            label="Total Interviews"
            value={totalInterviews.toString()}
          />
          <StatCard
            icon={<Clock className="w-8 h-8 text-green-600" />}
            label="Practice Time"
            value={formatDuration(totalHours)}
          />
          <StatCard
            icon={<TrendingUp className="w-8 h-8 text-purple-600" />}
            label="Average Score"
            value={averageScore}
          />
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-8 text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to practice?</h2>
          <p className="text-gray-600 mb-6">
            Start a new interview session to improve your skills.
          </p>
          <button
            onClick={() => navigate('/interview/setup')}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Interview Practice
          </button>
        </div>

        {/* Recent Interviews */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>

          {isLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary-600" />
              <p className="text-gray-500">Loading your interviews...</p>
            </div>
          ) : interviews.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
              No interview sessions yet. Start your first practice session above!
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedInterviews.map((interview) => (
                <div
                  key={interview.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Interview #{interview.id}
                        </h3>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                          {interview.mode === 'graded' ? 'Graded' : 'Practice'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {interview.duration_minutes} min
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(interview.created_at)}
                        </div>
                        {interview.personas && interview.personas.length > 0 && (
                          <div>
                            {interview.personas.length} persona
                            {interview.personas.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      {interview.personas && interview.personas.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {interview.personas.map((persona) => (
                            <div
                              key={persona.id}
                              className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
                            >
                              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                              {persona.name} ({persona.role})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => navigate(`/analytics/${interview.id}`)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center text-sm font-medium"
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, interviews.length)} of {interviews.length} sessions
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg flex items-center text-sm font-medium transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-lg flex items-center text-sm font-medium transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </>
          )}
        </div>
      </main>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  );
}
