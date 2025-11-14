import { useParams, useNavigate } from 'react-router-dom';
import { Mic, Square, Play, Pause, Send, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { rehearseApi, type QuestionResponse } from '../lib/api';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

export default function InterviewSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [currentQuestion, setCurrentQuestion] = useState<QuestionResponse | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [sessionTime, setSessionTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [hasAutoEnded, setHasAutoEnded] = useState(false);

  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioURL,
    error: recordingError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useAudioRecorder();

  // Fetch initial question
  const { mutate: fetchQuestion, isPending: isLoadingQuestion } = useMutation({
    mutationFn: () => rehearseApi.generateQuestion(Number(sessionId)),
    onSuccess: (response) => {
      setCurrentQuestion(response.data);

      // Capture session duration from first question
      if (response.data.durationMinutes && !durationMinutes) {
        setDurationMinutes(response.data.durationMinutes);
      }

      // Auto-play audio if available
      if (response.data.audioUrl) {
        setTimeout(() => {
          audioRef.current?.play().catch((error) => {
            console.error('Error playing audio:', error);
          });
        }, 100);
      }
    },
    onError: (error) => {
      console.error('Error fetching question:', error);
    },
  });

  // Submit response
  const { mutate: submitResponse } = useMutation({
    mutationFn: (responseText: string) =>
      rehearseApi.submitResponse({
        session_id: Number(sessionId),
        question_text: currentQuestion?.question.question_text || '',
        user_response_text: responseText,
      }),
    onSuccess: () => {
      // Clear current response
      setTextResponse('');
      clearRecording();
      setIsSubmitting(false);

      // Fetch next question
      fetchQuestion();
    },
    onError: (error) => {
      console.error('Error submitting response:', error);
      setIsSubmitting(false);
    },
  });

  // End session
  const { mutate: endSession, isPending: isEndingSession } = useMutation({
    mutationFn: () => rehearseApi.endSession(Number(sessionId)),
    onSuccess: () => {
      // Navigate to analytics
      navigate(`/analytics/${sessionId}`);
    },
    onError: (error) => {
      console.error('Error ending session:', error);
    },
  });

  // Fetch first question on mount
  useEffect(() => {
    if (sessionId) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Start session timer (separate from question fetching)
  useEffect(() => {
    if (sessionId) {
      // Clear any existing timer first
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }

      // Start new timer
      sessionTimerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [sessionId]);

  // Auto-end session when time is up
  useEffect(() => {
    if (!durationMinutes || hasAutoEnded || isEndingSession) return;

    const durationSeconds = durationMinutes * 60;

    // Check if session time has reached or exceeded the duration
    if (sessionTime >= durationSeconds) {
      console.log('[InterviewSession] Auto-ending session - time limit reached', {
        sessionTime,
        durationSeconds,
        durationMinutes,
      });

      setHasAutoEnded(true);

      // Stop the timer
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }

      // End the session automatically
      endSession();
    }
  }, [sessionTime, durationMinutes, hasAutoEnded, isEndingSession]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    let responseText = textResponse.trim();

    // If audio was recorded but no text provided, transcribe the audio
    if (audioBlob && !responseText) {
      setIsSubmitting(true);
      try {
        // Transcribe audio using ElevenLabs Scribe
        const transcriptionResult = await rehearseApi.transcribeAudio(audioBlob);
        responseText = transcriptionResult.data.text;

        if (!responseText || responseText.trim() === '') {
          throw new Error('Transcription returned empty text');
        }
      } catch (error) {
        console.error('Transcription failed:', error);
        setIsSubmitting(false);
        alert('Failed to transcribe audio. Please try typing your response instead.');
        return;
      }
    }

    if (!responseText) {
      return;
    }

    setIsSubmitting(true);
    submitResponse(responseText);
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (isPaused) {
        resumeRecording();
      } else {
        pauseRecording();
      }
    } else {
      await startRecording();
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    setShowTextInput(true);
  };

  const handleEndSession = () => {
    if (confirm('Are you sure you want to end this interview session?')) {
      // Stop the timer
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      endSession();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoadingQuestion && !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading interview session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Interview Session #{sessionId}</h1>
            <p className="text-gray-400">Answer the questions to the best of your ability</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-400">
              <Clock className="w-5 h-5 mr-2" />
              <span className="font-mono">{formatTime(sessionTime)}</span>
            </div>
          </div>
        </div>

        {/* Interview Area */}
        <div className="max-w-4xl mx-auto">
          {/* Current Question */}
          {currentQuestion && (
            <div className="bg-gray-800 rounded-lg p-8 mb-8">
              <div className="text-sm text-gray-400 mb-2">
                Question {currentQuestion.question.question_number}
                {currentQuestion.isFollowUp && (
                  <span className="ml-2 px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                    Follow-up
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-medium mb-4">
                {currentQuestion.question.question_text}
              </h2>
              <div className="flex items-center justify-between text-gray-400 text-sm">
                <div className="flex items-center">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  AI Interviewer: {currentQuestion.persona.name} ({currentQuestion.persona.role})
                </div>
                {currentQuestion.hasAudio && currentQuestion.audioUrl && (
                  <span className="text-green-400 text-xs">Audio enabled</span>
                )}
              </div>
              {currentQuestion.acknowledgment && (
                <div className="mt-4 p-4 bg-gray-700/50 rounded-lg text-gray-300 text-sm">
                  <strong>Interviewer:</strong> {currentQuestion.acknowledgment}
                </div>
              )}
              {/* Hidden audio element for auto-play */}
              {currentQuestion.audioUrl && (
                <audio
                  ref={audioRef}
                  src={currentQuestion.audioUrl}
                  className="hidden"
                  onEnded={() => console.log('Audio finished playing')}
                />
              )}
            </div>
          )}

          {/* Recording Error */}
          {recordingError && (
            <div className="mb-6 p-4 bg-red-600/20 border border-red-600 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Recording Error</p>
                <p className="text-red-300 text-sm mt-1">{recordingError}</p>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="bg-gray-800 rounded-lg p-8 mb-8">
            <div className="text-center mb-6">
              {/* Main Record Button */}
              {!isRecording && !audioBlob && (
                <button
                  onClick={handleToggleRecording}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-600 hover:bg-primary-700 transition-all"
                >
                  <Mic className="w-8 h-8" />
                </button>
              )}

              {/* Recording Active */}
              {isRecording && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={handleToggleRecording}
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-600 hover:bg-yellow-700 transition-all"
                    >
                      {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={handleStopRecording}
                      className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 transition-all"
                    >
                      <Square className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="text-2xl font-mono text-red-400">
                    {formatTime(recordingTime)}
                  </div>
                </div>
              )}

              {/* Recording Complete */}
              {audioBlob && audioURL && (
                <div className="space-y-4">
                  <div className="text-green-400 mb-4">✓ Recording complete</div>
                  <audio src={audioURL} controls className="w-full max-w-md mx-auto" />
                  <button
                    onClick={clearRecording}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Record again
                  </button>
                </div>
              )}

              <p className="mt-4 text-gray-400 text-sm">
                {!isRecording && !audioBlob && 'Click to start recording your answer'}
                {isRecording && !isPaused && 'Recording... Click pause or stop when done'}
                {isRecording && isPaused && 'Paused - Click to resume or stop'}
                {audioBlob && 'Review your recording or type your response below'}
              </p>
            </div>

            {/* Text Input Alternative */}
            {(showTextInput || !audioBlob) && (
              <div className="mt-6">
                <label className="block text-sm text-gray-400 mb-2">
                  Or type your response:
                </label>
                <textarea
                  value={textResponse}
                  onChange={(e) => setTextResponse(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-primary-500 text-white resize-none"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!audioBlob && !textResponse.trim())}
              className="w-full mt-6 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Answer
                </>
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-center">
            <button
              onClick={handleEndSession}
              disabled={isEndingSession}
              className="px-6 py-3 border border-gray-600 rounded-lg hover:border-gray-500 transition-colors disabled:opacity-50"
            >
              {isEndingSession ? 'Ending...' : 'End Interview'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
