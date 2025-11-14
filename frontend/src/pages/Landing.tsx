import { useNavigate } from 'react-router-dom';
import { Mic, BarChart3, Users, Zap } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Mic className="w-8 h-8 text-primary-600" />
            <span className="text-2xl font-bold text-gray-900">Rehearse</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/pricing')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              Pricing
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Sign In
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Master Your Interview Skills
          <br />
          <span className="text-primary-600">with AI-Powered Practice</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Practice interviews with realistic AI personas. Get instant feedback,
          improve your answers, and land your dream job.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold text-lg"
          >
            Start Practicing
          </button>
          <button
            onClick={() => navigate('/pricing')}
            className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-primary-600 hover:text-primary-600 transition-colors font-semibold text-lg"
          >
            View Pricing
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Users className="w-12 h-12 text-primary-600" />}
            title="Multiple AI Personas"
            description="Practice with diverse interviewer personalities - from friendly to tough, each with unique questioning styles."
          />
          <FeatureCard
            icon={<BarChart3 className="w-12 h-12 text-primary-600" />}
            title="Detailed Analytics"
            description="Get comprehensive feedback on confidence, clarity, and relevance. Track your progress over time."
          />
          <FeatureCard
            icon={<Zap className="w-12 h-12 text-primary-600" />}
            title="Real-Time Feedback"
            description="Receive instant AI-powered feedback on your responses with specific suggestions for improvement."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="bg-primary-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to ace your next interview?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of professionals who have improved their interview skills with Rehearse.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-white text-primary-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg"
          >
            Get Started Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-600 border-t border-gray-200">
        <p>&copy; 2025 Rehearse. All rights reserved.</p>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
