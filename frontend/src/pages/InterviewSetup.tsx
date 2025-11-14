import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Users, Loader2, CheckCircle2, Upload, FileText, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rehearseApi } from '../lib/api';

export default function InterviewSetup() {
  const navigate = useNavigate();
  const userId = 1; // TODO: Replace with actual user ID from auth

  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<'practice' | 'graded'>('graded');
  const [selectedPersonas, setSelectedPersonas] = useState<number[]>([]);
  const [uploadedDocument, setUploadedDocument] = useState<{ id: number; filename: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch available personas
  const { data: personasData, isLoading: isLoadingPersonas } = useQuery({
    queryKey: ['personas'],
    queryFn: () => rehearseApi.listPersonas(),
  });

  const personas = personasData?.data?.personas || [];

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, TXT, or DOC file');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId.toString());
      formData.append('document_type', 'resume');

      const response = await rehearseApi.uploadDocument(formData);
      setUploadedDocument({
        id: response.data.id,
        filename: response.data.filename,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Create interview and start session
  const { mutate: createAndStartInterview, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      // Ensure we have at least one persona selected
      const personaIds = selectedPersonas.length > 0
        ? selectedPersonas
        : personas.slice(0, 2).map((p) => p.id); // Default to first 2 personas

      // Create interview
      const interviewResponse = await rehearseApi.createInterview({
        user_id: userId,
        persona_ids: personaIds,
        duration_minutes: duration,
        mode: mode,
        document_id: uploadedDocument?.id,
      });

      const interview = interviewResponse.data;

      // Start session
      const sessionResponse = await rehearseApi.startSession(interview.id);
      return { interview, session: sessionResponse.data };
    },
    onSuccess: ({ session }) => {
      // Navigate to interview session
      navigate(`/interview/${session.id}`);
    },
    onError: (error) => {
      console.error('Error creating interview:', error);
      alert('Failed to start interview. Please try again.');
    },
  });

  const togglePersona = (personaId: number) => {
    setSelectedPersonas((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId]
    );
  };

  const handleStartInterview = () => {
    if (selectedPersonas.length === 0 && personas.length > 0) {
      // Auto-select first 2 personas if none selected
      setSelectedPersonas(personas.slice(0, 2).map((p) => p.id));
    }
    createAndStartInterview();
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Setup Interview</h1>
          <p className="text-gray-600 mt-1">Configure your practice session</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Duration */}
          <div className="mb-8">
            <label className="flex items-center text-lg font-semibold text-gray-900 mb-4">
              <Clock className="w-5 h-5 mr-2" />
              Interview Duration
            </label>
            <div className="grid grid-cols-3 gap-4">
              {[15, 30, 60].map((min) => (
                <button
                  key={min}
                  onClick={() => setDuration(min)}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    duration === min
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl font-bold">{min}</div>
                  <div className="text-sm text-gray-600">minutes</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div className="mb-8">
            <label className="text-lg font-semibold text-gray-900 mb-4 block">
              Interview Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setMode('practice')}
                className={`p-6 rounded-lg border-2 transition-colors ${
                  mode === 'practice'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-lg mb-2">Practice</div>
                <div className="text-sm text-gray-600">
                  Casual practice with basic feedback
                </div>
              </button>
              <button
                onClick={() => setMode('graded')}
                className={`p-6 rounded-lg border-2 transition-colors ${
                  mode === 'graded'
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-lg mb-2">Graded</div>
                <div className="text-sm text-gray-600">
                  Get detailed AI feedback and scoring
                </div>
              </button>
            </div>
          </div>

          {/* Document Upload */}
          <div className="mb-8">
            <label className="flex items-center text-lg font-semibold text-gray-900 mb-4">
              <Upload className="w-5 h-5 mr-2" />
              Upload Resume/Context Document (Optional)
            </label>
            <p className="text-gray-600 mb-4">
              Upload your resume, job description, or other context to help AI generate relevant questions
            </p>

            {uploadedDocument ? (
              <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-green-600 mr-3" />
                  <div>
                    <div className="font-medium text-green-900">{uploadedDocument.filename}</div>
                    <div className="text-sm text-green-600">Document uploaded successfully</div>
                  </div>
                </div>
                <button
                  onClick={() => setUploadedDocument(null)}
                  className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-green-600" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
                <input
                  type="file"
                  id="document-upload"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
                <label
                  htmlFor="document-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className={`w-12 h-12 mb-3 ${isUploading ? 'text-gray-400' : 'text-gray-400'}`} />
                  {isUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600 mb-2" />
                      <span className="text-gray-600">Uploading document...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-700 font-medium mb-1">Click to upload document</span>
                      <span className="text-sm text-gray-500">PDF, TXT, DOC up to 10MB</span>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Personas */}
          <div className="mb-8">
            <label className="flex items-center text-lg font-semibold text-gray-900 mb-4">
              <Users className="w-5 h-5 mr-2" />
              Select AI Interviewers
            </label>
            <p className="text-gray-600 mb-4">
              Choose the personas who will conduct your interview (optional - we'll select suitable ones if you skip)
            </p>

            {isLoadingPersonas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
                <span className="text-gray-600">Loading personas...</span>
              </div>
            ) : personas.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => togglePersona(persona.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left relative ${
                      selectedPersonas.includes(persona.id)
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {selectedPersonas.includes(persona.id) && (
                      <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary-600" />
                    )}
                    <div className="font-semibold text-gray-900 mb-1 pr-8">{persona.name}</div>
                    <div className="text-sm text-gray-600 mb-2">{persona.role}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {persona.gender}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {persona.questioning_style}
                      </span>
                    </div>
                    {persona.focus_areas && persona.focus_areas.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Focus: {persona.focus_areas.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No personas available. Using default personas.
              </div>
            )}

            {selectedPersonas.length > 0 && (
              <div className="mt-3 text-sm text-gray-600">
                {selectedPersonas.length} persona{selectedPersonas.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleStartInterview}
            disabled={isCreating}
            className="w-full py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold text-lg flex items-center justify-center"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating Interview...
              </>
            ) : (
              'Start Interview'
            )}
          </button>

          {isCreating && (
            <p className="mt-3 text-center text-sm text-gray-500">
              Setting up your interview session...
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
