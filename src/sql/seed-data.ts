export const seedDataSQL = `
-- Seed subscription plans
INSERT OR IGNORE INTO subscription_plans (name, stripe_price_id, price_monthly, max_session_minutes, max_personas, features)
VALUES
    ('Basic', NULL, 0, 15, 1, '["15min sessions", "1 persona", "practice mode", "basic reports"]'),
    ('Pro', 'price_pro_monthly', 29.99, NULL, 6, '["unlimited sessions", "up to 6 personas", "graded mode", "advanced analytics", "priority support", "30min & 60min sessions"]'),
    ('Enterprise', 'price_enterprise_monthly', 99.99, NULL, 6, '["unlimited sessions", "up to 6 personas", "graded mode", "advanced analytics", "priority support", "custom voices", "API access", "team management"]');

-- Seed interviewer personas with ElevenLabs voices (gender balanced)
INSERT OR IGNORE INTO interviewer_personas (name, role, voice_id, voice_name, gender, questioning_style, focus_areas)
VALUES
    -- Male personas
    ('Marcus', 'Technical Manager', '2EiwWnXFnvU5JabPnv8n', 'Clyde', 'male', 'neutral', '["technical", "problem-solving", "architecture"]'),
    ('David', 'Senior Engineer', 'CwhRBWXzGAHq8TQ4Fs17', 'Roger', 'male', 'friendly', '["technical", "coding", "best-practices"]'),
    ('Robert', 'VP of Engineering', 'IKne3meq5aSn9XLyUdCD', 'Charlie', 'male', 'tough', '["leadership", "technical", "strategic"]'),
    ('James', 'Product Manager', 'JBFqnCBsd6RMkjVDRZzb', 'George', 'male', 'neutral', '["product", "user-experience", "prioritization"]'),
    ('Michael', 'CTO', 'SOYHLrjzK2X1ezoPC6cr', 'Harry', 'male', 'tough', '["strategic", "technical", "vision"]'),
    ('Thomas', 'Team Lead', 'TX3LPaxmHKxFdv7VOQHJ', 'Liam', 'male', 'friendly', '["teamwork", "collaboration", "mentoring"]'),
    ('Christopher', 'Solutions Architect', 'bIHbv24MWmeRgasZH58o', 'Will', 'male', 'neutral', '["architecture", "scalability", "technical"]'),
    ('Daniel', 'DevOps Engineer', 'cjVigY5qzO86Huf0OWal', 'Eric', 'male', 'friendly', '["infrastructure", "automation", "reliability"]'),
    ('Andrew', 'Security Lead', 'iP95p4xoKVk53GoZ742B', 'Chris', 'male', 'tough', '["security", "compliance", "risk"]'),
    ('Joseph', 'Data Architect', 'onwK4e9ZLuTAKqWW03F9', 'Daniel', 'male', 'neutral', '["data", "analytics", "architecture"]'),

    -- Female personas
    ('Jennifer', 'HR Director', 'EXAVITQu4vr4xnSDxMaL', 'Sarah', 'female', 'friendly', '["behavioral", "culture-fit", "soft-skills"]'),
    ('Emily', 'Recruiter', 'FGY2WhTYpPnrIDTdsKH5', 'Laura', 'female', 'friendly', '["behavioral", "experience", "motivation"]'),
    ('Michelle', 'CEO', 'SAz9YHcvj6GT2YYXdXww', 'River', 'female', 'tough', '["vision", "leadership", "strategic"]'),
    ('Elizabeth', 'VP of Operations', 'Xb7hH8MSUJpSbSDYk0k2', 'Alice', 'female', 'neutral', '["operational", "process", "efficiency"]'),
    ('Patricia', 'Director of Engineering', 'XrExE9yKIg1WjnnlVkGX', 'Matilda', 'female', 'tough', '["technical", "leadership", "delivery"]'),
    ('Lisa', 'Senior Developer', 'cgSgspJ2msm6clMCkdW9', 'Jessica', 'female', 'friendly', '["technical", "coding", "collaboration"]'),
    ('Amy', 'Scrum Master', 'pFZP5JQG7iQjIQuC4Bku', 'Lily', 'female', 'friendly', '["agile", "process", "teamwork"]'),
    ('Rebecca', 'UX Lead', 'nPczCjzI2devNBz1zQrb', 'Brian', 'female', 'neutral', '["design", "user-experience", "research"]'),
    ('Susan', 'QA Manager', 'pqHfZKP75CvOlQylNhV4', 'Bill', 'female', 'neutral', '["quality", "testing", "processes"]'),
    ('Karen', 'Engineering Manager', '2EiwWnXFnvU5JabPnv8n', 'Clyde', 'female', 'tough', '["management", "technical", "delivery"]');

-- Seed scenarios
INSERT OR IGNORE INTO scenarios (type, name, description, recommended_personas)
VALUES
    ('interview', 'Technical Software Engineering Interview', 'Standard technical interview for software engineering roles', '["Technical Manager", "Senior Engineer", "HR Director"]'),
    ('interview', 'Senior Leadership Interview', 'Executive-level interview for leadership positions', '["CEO", "VP of Engineering", "HR Director"]'),
    ('interview', 'Product Manager Interview', 'Product management focused interview', '["Product Manager", "VP of Operations", "Technical Manager"]'),
    ('interview', 'Data Engineering Interview', 'Data-focused technical interview', '["Data Architect", "Technical Manager", "Senior Engineer"]'),
    ('meeting', 'Team Standup Presentation', 'Daily team standup meeting practice', '["Team Lead", "Scrum Master"]'),
    ('meeting', 'Executive Board Meeting', 'C-level executive board meeting', '["CEO", "CTO", "VP of Operations"]'),
    ('presentation', 'Technical Architecture Presentation', 'Present technical architecture to stakeholders', '["Solutions Architect", "CTO", "VP of Engineering"]'),
    ('presentation', 'Product Launch Presentation', 'Product launch presentation to executives', '["CEO", "Product Manager", "VP of Operations"]');

-- Seed initial booking slots (will be created on-demand by scheduling system)
-- SQLite doesn't have generate_series, slots will be created dynamically
`;
