import axios from 'axios';
import type { User, Interview, Persona, Session, Response, Analytics, AdminUser, SystemStats, UserActivity } from '../types';

// API Configuration
const getApiBaseUrl = () => {
  // Check if running in Vite environment
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_API_URL ||
      (import.meta.env.PROD
        ? 'https://rehearse-api.01k8kpv1gr6b34n7ftxj2whn2x.lmapp.run'
        : 'http://localhost:8787');
  }
  // Fallback for non-Vite environments
  return 'http://localhost:8787';
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Regular API Methods (used by frontend)
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
    api.post(`/sessions/${sessionId}/questions`),

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
  }) => api.post('/payments/checkout', data),

  createPortalSession: (data: { user_id: number; return_url: string }) =>
    api.post('/payments/portal', data),

  startFreeTrial: (userId: number) =>
    api.post<{ subscription: any }>('/payments/trial/start', { user_id: userId }),
};

// Admin API Methods
export const adminApi = {
  // Authentication
  getAdminAuthUrl: () => api.get<{ authUrl: string }>('/admin/auth/login'),

  handleAdminAuthCallback: (code: string, state?: string) =>
    api.post<{ user: User; sessionId: string }>('/admin/auth/callback', { code, state }),

  getCurrentAdmin: (sessionId: string) =>
    api.get<{ user: User }>('/admin/auth/me', { headers: { Authorization: `Bearer ${sessionId}` } }),

  logout: (sessionId: string) =>
    api.post('/admin/auth/logout', { sessionId }),

  // Users Management
  getUsers: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<{ users: AdminUser[]; total: number; page: number; limit: number }>('/admin/users', { params }),

  getUser: (userId: number) =>
    api.get<{ user: AdminUser; interviews: Interview[] }>(`/admin/users/${userId}`),

  updateUserSubscription: (userId: number, data: { subscription_tier?: string; subscription_status?: string }) =>
    api.patch(`/admin/users/${userId}/subscription`, data),

  deleteUser: (userId: number) =>
    api.delete(`/admin/users/${userId}`),

  // Analytics
  getSystemStats: () =>
    api.get<SystemStats>('/admin/analytics/stats'),

  getUserActivity: (params?: { page?: number; limit?: number; user_id?: number; activity_type?: string }) =>
    api.get<{ activities: UserActivity[]; total: number }>('/admin/analytics/activity', { params }),

  getRevenueAnalytics: (params?: { start_date?: string; end_date?: string }) =>
    api.get<{ daily_revenue: any[]; monthly_revenue: any[] }>('/admin/analytics/revenue', { params }),

  // Personas Management
  createPersona: (data: Omit<Persona, 'id'>) =>
    api.post<Persona>('/admin/personas', data),

  updatePersona: (personaId: number, data: Partial<Persona>) =>
    api.patch<Persona>(`/admin/personas/${personaId}`, data),

  deletePersona: (personaId: number) =>
    api.delete(`/admin/personas/${personaId}`),

  // System Management
  getSystemHealth: () =>
    api.get<{ status: string; uptime: number; memory: any; database: any }>('/admin/system/health'),

  getLogs: (params?: { level?: string; limit?: number; offset?: number }) =>
    api.get<{ logs: any[] }>('/admin/system/logs', { params }),
};
