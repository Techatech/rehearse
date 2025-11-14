// Common types shared between frontend, admin, and backend

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

// Admin-specific types
export interface AdminUser extends User {
  interview_count: number;
  total_practice_time: number;
  last_active?: string;
}

export interface SystemStats {
  total_users: number;
  active_users: number;
  total_interviews: number;
  total_practice_hours: number;
  mrr: number;
  conversion_rate: number;
  churn_rate: number;
}

export interface UserActivity {
  id?: number;
  user_id: number;
  user_email: string;
  user_name: string;
  activity_type: string;
  activity_date: string;
  details?: any;
}
