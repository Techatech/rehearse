-- Add missing columns to responses table for detailed scoring
ALTER TABLE responses ADD COLUMN question_text TEXT;
ALTER TABLE responses ADD COLUMN confidence_score REAL DEFAULT 0;
ALTER TABLE responses ADD COLUMN clarity_score REAL DEFAULT 0;
ALTER TABLE responses ADD COLUMN relevance_score REAL DEFAULT 0;
