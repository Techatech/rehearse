import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Award, Target, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { rehearseApi } from '../lib/api';
import { useState } from 'react';

export default function Analytics() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [expandedResponse, setExpandedResponse] = useState<number | null>(null);

  // Fetch analytics data (sessionId is actually interview ID from the route)
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['analytics', sessionId],
    queryFn: () => rehearseApi.getInterviewAnalytics(Number(sessionId)),
    enabled: !!sessionId,
  });

  const analyticsData = analytics?.data;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getPerformanceMessage = (score: number): string => {
    if (score >= 90) return 'Excellent performance! You\'re doing great.';
    if (score >= 80) return 'Good performance! Keep practicing to improve further.';
    if (score >= 70) return 'Solid performance. Focus on the areas for improvement.';
    if (score >= 60) return 'Fair performance. More practice will help you improve.';
    return 'Keep practicing! Focus on the feedback to improve your skills.';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load analytics data</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Interview Analytics</h1>
          <p className="text-gray-600 mt-1">
            Interview #{sessionId} · {analyticsData.response_count} response{analyticsData.response_count !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Overall Score */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6 text-center">
          <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${getScoreBgColor(analyticsData.overall_grade)} mb-4`}>
            <span className={`text-4xl font-bold ${getScoreColor(analyticsData.overall_grade)}`}>
              {Math.round(analyticsData.overall_grade)}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Overall Score</h2>
          <p className="text-gray-600">{getPerformanceMessage(analyticsData.overall_grade)}</p>
        </div>

        {/* Detailed Scores */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <ScoreCard
            icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
            label="Confidence"
            score={analyticsData.confidence_score}
          />
          <ScoreCard
            icon={<Award className="w-6 h-6 text-green-600" />}
            label="Clarity"
            score={analyticsData.clarity_score}
          />
          <ScoreCard
            icon={<Target className="w-6 h-6 text-purple-600" />}
            label="Relevance"
            score={analyticsData.relevance_score}
          />
        </div>

        {/* Overall Performance Summary */}
        {analyticsData.overall_performance && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Performance Summary</h3>
            <p className="text-gray-700 leading-relaxed">{analyticsData.overall_performance}</p>
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Strengths</h3>
            {analyticsData.key_strengths && analyticsData.key_strengths.length > 0 ? (
              <ul className="space-y-2">
                {analyticsData.key_strengths.map((strength, index) => (
                  <li key={index} className="flex items-start text-gray-700">
                    <span className="inline-block w-1.5 h-1.5 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No strengths identified yet. Complete more responses to see detailed feedback.</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Areas to Improve</h3>
            {analyticsData.key_improvements && analyticsData.key_improvements.length > 0 ? (
              <ul className="space-y-2">
                {analyticsData.key_improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start text-gray-700">
                    <span className="inline-block w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">No improvements identified yet. Complete more responses to see detailed feedback.</p>
            )}
          </div>
        </div>

        {/* Individual Response Breakdown */}
        {analyticsData.response_breakdown && analyticsData.response_breakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Response Breakdown</h3>
            <div className="space-y-4">
              {analyticsData.response_breakdown.map((response, index) => (
                <div key={response.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedResponse(expandedResponse === index ? null : index)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-gray-600">Response {index + 1}</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-semibold ${getScoreColor(response.grade)}`}>
                          Score: {Math.round(response.grade)}
                        </span>
                      </div>
                    </div>
                    {expandedResponse === index ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedResponse === index && (
                    <div className="p-4 bg-white border-t border-gray-200">
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Question:</h4>
                        <p className="text-gray-600">{response.question_text}</p>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Your Response:</h4>
                        <p className="text-gray-600">{response.user_response_text}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <span className="text-xs text-gray-500">Confidence</span>
                          <p className="text-lg font-semibold text-blue-600">{Math.round(response.confidence_score)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Clarity</span>
                          <p className="text-lg font-semibold text-green-600">{Math.round(response.clarity_score)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Relevance</span>
                          <p className="text-lg font-semibold text-purple-600">{Math.round(response.relevance_score)}</p>
                        </div>
                      </div>

                      {response.ai_feedback && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <h4 className="text-sm font-semibold text-blue-900 mb-1">AI Feedback:</h4>
                          <p className="text-sm text-blue-800">
                            {typeof response.ai_feedback === 'string'
                              ? response.ai_feedback
                              : JSON.stringify(response.ai_feedback)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/interview/setup')}
            className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Practice Again
          </button>
        </div>
      </main>
    </div>
  );
}

interface ScoreCardProps {
  icon: React.ReactNode;
  label: string;
  score: number;
}

function ScoreCard({ icon, label, score }: ScoreCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="flex items-center mb-2">
        {icon}
        <span className="ml-2 text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{score}</div>
      <div className="mt-2 bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all"
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  );
}
