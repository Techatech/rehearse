import axios from 'axios';

// API Configuration
// For production: use deployed Raindrop API
// For development: use VITE_API_URL or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run'
    : 'http://localhost:8787');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Interview {
  id: number;
  user_id: number;
  document_id?: number;
  scenario_id?: number;
  duration_minutes: number;
  mode: 'practice' | 'graded';
  num_personas: number;
  status: string;
  scheduled_at?: string;
  created_at: string;
  personas?: Persona[];
}

export interface Persona {
  id: number;
  name: string;
  role: string;
  voice_id: string;
  voice_name: string;
  gender: string;
  questioning_style: string;
  focus_areas: string[];
  turn_order?: number;
}

export interface Session {
  id: number;
  interview_id: number;
  session_start_time: string;
  session_end_time?: string;
  status: string;
  memory_session_id?: string;
}

export interface Question {
  id: number;
  question_text: string;
  question_category: string;
  question_number: number;
}

export interface QuestionResponse {
  acknowledgment?: string;
  isFollowUp: boolean;
  question: Question;
  persona: {
    name: string;
    role: string;
    voiceName: string;
  };
  hasAudio: boolean;
  audioUrl?: string;
  durationMinutes?: number;
  sessionStartTime?: string;
}

export interface Response {
  id: number;
  session_id: number;
  question_text: string;
  user_response_text: string;
  ai_feedback: any;
  grade: number;
  confidence_score: number;
  clarity_score: number;
  relevance_score: number;
  timestamp: string;
}

export interface Analytics {
  overall_grade: number;
  confidence_score: number;
  clarity_score: number;
  relevance_score: number;
  key_strengths: string[];
  key_improvements: string[];
  overall_performance: string;
  response_count: number;
  response_breakdown?: Response[];
}

export interface User {
  id: number;
  workos_id: string;
  email: string;
  name: string;
  subscription_tier: 'basic' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'trial' | 'cancelled';
  trial_ends_at?: string;
  subscription_started_at?: string;
  stripe_customer_id?: string;
  created_at: string;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export interface PortalSession {
  portalUrl: string;
}

// API Methods
export const rehearseApi = {
  // Interviews
  createInterview: (data: {
    user_id: number;
    document_id?: number;
    scenario_id?: number;
    persona_ids: number[];
    duration_minutes?: number;
    mode?: 'practice' | 'graded';
  }) => api.post<Interview>('/interviews', data),

  getInterviews: (userId?: number) =>
    api.get<{ interviews: Interview[] }>('/interviews', { params: { user_id: userId } }),

  getInterview: (id: number) => api.get<Interview>(`/interviews/${id}`),

  assignPersonas: (interviewId: number, personaIds: number[]) =>
    api.post(`/interviews/${interviewId}/personas`, { persona_ids: personaIds }),

  // Sessions
  startSession: (interviewId: number) =>
    api.post<Session>('/sessions/start', { interview_id: interviewId }),

  generateQuestion: (sessionId: number) =>
    api.post<QuestionResponse>(`/sessions/${sessionId}/questions`),

  endSession: (sessionId: number) =>
    api.post<{ session: Session; analytics: Analytics }>(`/sessions/${sessionId}/end`),

  getSessionAnalytics: (sessionId: number) =>
    api.get<Analytics>(`/sessions/${sessionId}/analytics`),

  getInterviewAnalytics: (interviewId: number) =>
    api.get<Analytics>(`/interviews/${interviewId}/analytics`),

  // Responses
  transcribeAudio: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return api.post<{ text: string; language_code: string; language_probability: number }>(
      '/responses/transcribe',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  submitResponse: (data: {
    session_id: number;
    question_text: string;
    user_response_text: string;
  }) => api.post<Response>('/responses', data),

  getSessionResponses: (sessionId: number) =>
    api.get<{ responses: Response[] }>(`/sessions/${sessionId}/responses`),

  // Personas
  listPersonas: () => api.get<{ count: number; personas: Persona[] }>('/personas'),

  getPersona: (id: number) => api.get<Persona>(`/personas/${id}`),

  recommendPersonas: (data: { document_text?: string; scenario_id?: number }) =>
    api.post<{ personas: Persona[] }>('/personas/recommend', data),

  // Documents
  uploadDocument: (formData: FormData) =>
    api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  // Authentication
  getAuthUrl: () => api.get<{ authUrl: string }>('/auth/login'),

  handleAuthCallback: (code: string, state?: string) =>
    api.post<{ user: User; sessionId: string }>('/auth/callback', { code, state }),

  getCurrentUser: (sessionId: string) =>
    api.get<{ user: User }>('/auth/me', { headers: { Authorization: `Bearer ${sessionId}` } }),

  logout: (sessionId: string) =>
    api.post('/auth/logout', { sessionId }),

  // Payments
  createCheckoutSession: (data: {
    user_id: number;
    price_id: string;
    success_url: string;
    cancel_url: string;
  }) => api.post<CheckoutSession>('/payments/checkout', data),

  createPortalSession: (data: { user_id: number; return_url: string }) =>
    api.post<PortalSession>('/payments/portal', data),

  startFreeTrial: (userId: number) =>
    api.post<{ subscription: any }>('/payments/trial/start', { user_id: userId }),
};
