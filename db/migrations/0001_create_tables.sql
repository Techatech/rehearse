-- Users table with subscription info
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workos_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'basic', -- basic, pro, enterprise
    subscription_status TEXT DEFAULT 'active', -- active, cancelled, expired, trial
    trial_ends_at DATETIME,
    subscription_started_at DATETIME,
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- Basic, Pro, Enterprise
    stripe_price_id TEXT,
    price_monthly REAL,
    max_session_minutes INTEGER, -- NULL for unlimited
    max_personas INTEGER,
    features TEXT, -- Array of feature flags (stored as JSON text)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Document uploads and analysis
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL, -- SmartBuckets key
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- pdf, docx, txt, md
    file_size INTEGER,
    analysis_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    analysis_result TEXT, -- Extracted skills, responsibilities, question categories (stored as JSON text)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Interviewer personas
CREATE TABLE IF NOT EXISTS interviewer_personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- Technical Manager, HR, CEO, etc.
    voice_id TEXT NOT NULL, -- ElevenLabs voice ID
    voice_name TEXT NOT NULL,
    gender TEXT NOT NULL, -- male, female
    questioning_style TEXT NOT NULL, -- friendly, tough, neutral
    focus_areas TEXT, -- technical, behavioral, scenario-based (stored as JSON text)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, role)
);

-- Session scenarios
CREATE TABLE IF NOT EXISTS scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- interview, meeting, presentation
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    recommended_personas TEXT, -- Array of persona roles (stored as JSON text)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Interviews/sessions configuration
CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id),
    scenario_id INTEGER REFERENCES scenarios(id),
    config TEXT, -- Session configuration (stored as JSON text)
    scheduled_at DATETIME,
    duration_minutes INTEGER DEFAULT 15, -- 15, 30, 60
    mode TEXT DEFAULT 'graded', -- practice, graded
    num_personas INTEGER DEFAULT 1, -- 1-6
    status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session personas (many-to-many between interviews and personas)
CREATE TABLE IF NOT EXISTS interview_personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    persona_id INTEGER NOT NULL REFERENCES interviewer_personas(id),
    turn_order INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Interview sessions (actual execution)
CREATE TABLE IF NOT EXISTS interview_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    memory_session_id TEXT, -- SmartMemory session ID
    session_start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_end_time DATETIME,
    actual_duration_seconds INTEGER,
    status TEXT DEFAULT 'active', -- active, completed, interrupted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Questions asked during session
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    persona_id INTEGER NOT NULL REFERENCES interviewer_personas(id),
    question_text TEXT NOT NULL,
    question_category TEXT, -- technical, behavioral, scenario-based
    question_number INTEGER NOT NULL,
    audio_url TEXT, -- ElevenLabs generated audio URL
    asked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User responses
CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    user_response_text TEXT,
    transcription_confidence REAL,
    ai_feedback TEXT, -- Detailed feedback from Cerebras (stored as JSON text)
    grade REAL,
    response_duration_seconds INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session analytics
CREATE TABLE IF NOT EXISTS session_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    overall_grade REAL,
    confidence_score REAL,
    clarity_score REAL,
    relevance_score REAL,
    avg_response_time REAL,
    strengths TEXT, -- Array of strengths (stored as JSON text)
    improvements TEXT, -- Array of improvement areas (stored as JSON text)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES interview_sessions(id),
    object_storage_key TEXT UNIQUE NOT NULL,
    report_type TEXT DEFAULT 'pdf', -- pdf, json
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Booking/scheduling slots
CREATE TABLE IF NOT EXISTS booking_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_time DATETIME NOT NULL UNIQUE,
    capacity INTEGER DEFAULT 100, -- Max concurrent sessions per slot
    booked INTEGER DEFAULT 0,
    is_available INTEGER DEFAULT 1, -- SQLite uses INTEGER for BOOLEAN (0 = false, 1 = true)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL, -- pending, succeeded, failed, refunded
    transaction_type TEXT NOT NULL, -- subscription, upgrade, renewal
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_analysis_status ON documents(analysis_status);
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_interview_id ON interview_sessions(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_questions_session_id ON questions(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_reports_interview_id ON reports(interview_id);
CREATE INDEX IF NOT EXISTS idx_booking_slots_slot_time ON booking_slots(slot_time);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
