import { Service } from '@liquidmetal-ai/raindrop-framework';
import { corsAllowAll } from '@liquidmetal-ai/raindrop-framework/core/cors';
import { Env } from './raindrop.gen';
import { z } from 'zod';
import { createTablesSQL } from '../sql/rehearse-smart-sql';
import { seedDataSQL } from '../sql/seed-data';
import { createDocumentService } from '../services/document.service';
import { createCerebrasService } from '../services/cerebras-ai.service';
import { createInterviewOrchestrator, type InterviewConfig, type SessionState } from '../services/interview-orchestrator.service';
import { createWorkOSAuthService } from '../services/workos-auth.service';
import { createStripePaymentService } from '../services/stripe-payment.service';
import { createSubscriptionGate } from '../middleware/subscription-gate.middleware';

// Export CORS handler to enable cross-origin requests
export { corsAllowAll as cors };

// Validation schemas
const CreateUserSchema = z.object({
  workos_id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

const CreateInterviewSchema = z.object({
  user_id: z.number(),
  document_id: z.number().optional(),
  scenario_id: z.number().optional(),
  persona_ids: z.array(z.number()).min(1).max(6), // 1-6 personas
  duration_minutes: z.number().default(15), // 15, 30, or 60
  mode: z.enum(['practice', 'graded']).default('practice'),
  scheduled_at: z.string().optional(),
});

const AssignPersonasSchema = z.object({
  persona_ids: z.array(z.number()).min(1).max(6), // 1-6 personas
});

const StartSessionSchema = z.object({
  interview_id: z.number(),
});

const SubmitResponseSchema = z.object({
  session_id: z.number(),
  question_text: z.string(),
  user_response_text: z.string(),
});

const AuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

const CreateCheckoutSchema = z.object({
  user_id: z.number(),
  price_id: z.string(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

const StartTrialSchema = z.object({
  user_id: z.number(),
});

export default class extends Service<Env> {
  /**
   * Add CORS headers to response
   */
  private addCorsHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    this.env.logger.info(`${method} ${path}`);

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // Initialize database on first request (idempotent)
      await this.initializeDatabase();

      // Route handling
      if (path === '/health' && method === 'GET') {
        return this.addCorsHeaders(this.handleHealth() as Response);
      }

      // Admin endpoints
      if (path === '/admin/seed-database' && method === 'POST') {
        return this.addCorsHeaders((await this.handleSeedDatabase()) as Response);
      }
      if (path === '/admin/list-personas' && method === 'GET') {
        return this.addCorsHeaders((await this.handleListPersonas(url)) as Response);
      }
      if (path === '/admin/list-plans' && method === 'GET') {
        return this.addCorsHeaders((await this.handleListPlans()) as Response);
      }
      if (path === '/admin/test-insert' && method === 'POST') {
        return this.addCorsHeaders((await this.handleTestInsert()) as Response);
      }
      if (path === '/admin/diagnose-db' && method === 'GET') {
        return this.addCorsHeaders((await this.handleDiagnoseDatabase()) as Response);
      }
      if (path === '/admin/initialize-db' && method === 'POST') {
        return this.addCorsHeaders((await this.handleManualInitialization()) as Response);
      }
      if (path === '/admin/check-env' && method === 'GET') {
        return this.addCorsHeaders(this.handleCheckEnv() as Response);
      }
      if (path === '/admin/test-elevenlabs' && method === 'GET') {
        return this.addCorsHeaders((await this.handleTestElevenLabs()) as Response);
      }

      // Admin Authentication endpoints
      if (path === '/admin/auth/login' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminAuthLogin()) as Response);
      }
      if (path === '/admin/auth/callback' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminAuthCallback(request, url)) as Response);
      }
      if (path === '/admin/auth/me' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminAuthMe(request)) as Response);
      }
      if (path === '/admin/auth/logout' && method === 'POST') {
        return this.addCorsHeaders((await this.handleAuthLogout(request)) as Response);
      }

      // Admin User Management endpoints
      if (path === '/admin/users' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminGetUsers(url)) as Response);
      }
      if (path.match(/^\/admin\/users\/\d+$/) && method === 'GET') {
        const userId = parseInt(path.split('/')[3]!);
        return this.addCorsHeaders((await this.handleAdminGetUser(userId)) as Response);
      }
      if (path.match(/^\/admin\/users\/\d+\/subscription$/) && method === 'PATCH') {
        const userId = parseInt(path.split('/')[3]!);
        return this.addCorsHeaders((await this.handleAdminUpdateSubscription(userId, request)) as Response);
      }
      if (path.match(/^\/admin\/users\/\d+$/) && method === 'DELETE') {
        const userId = parseInt(path.split('/')[3]!);
        return this.addCorsHeaders((await this.handleAdminDeleteUser(userId)) as Response);
      }

      // Admin Analytics endpoints
      if (path === '/admin/analytics/stats' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminGetStats()) as Response);
      }
      if (path === '/admin/analytics/activity' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminGetActivity(url)) as Response);
      }
      if (path === '/admin/analytics/revenue' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminGetRevenue(url)) as Response);
      }

      // Admin Persona Management endpoints
      if (path === '/admin/personas' && method === 'POST') {
        return this.addCorsHeaders((await this.handleAdminCreatePersona(request)) as Response);
      }
      if (path.match(/^\/admin\/personas\/\d+$/) && method === 'PATCH') {
        const personaId = parseInt(path.split('/')[3]!);
        return this.addCorsHeaders((await this.handleAdminUpdatePersona(personaId, request)) as Response);
      }
      if (path.match(/^\/admin\/personas\/\d+$/) && method === 'DELETE') {
        const personaId = parseInt(path.split('/')[3]!);
        return this.addCorsHeaders((await this.handleAdminDeletePersona(personaId)) as Response);
      }

      // Admin System Management endpoints
      if (path === '/admin/system/health' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminSystemHealth()) as Response);
      }
      if (path === '/admin/system/logs' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAdminGetLogs(url)) as Response);
      }

      // User endpoints
      if (path === '/users' && method === 'POST') {
        return this.addCorsHeaders((await this.handleCreateUser(request)) as Response);
      }
      if (path.match(/^\/users\/\d+$/) && method === 'GET') {
        const userId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetUser(userId)) as Response);
      }

      // Authentication endpoints
      if (path === '/auth/login' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAuthLogin()) as Response);
      }
      if (path === '/auth/callback' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAuthCallback(request, url)) as Response);
      }
      if (path === '/auth/logout' && method === 'POST') {
        return this.addCorsHeaders((await this.handleAuthLogout(request)) as Response);
      }
      if (path === '/auth/me' && method === 'GET') {
        return this.addCorsHeaders((await this.handleAuthMe(request)) as Response);
      }

      // Payment endpoints
      if (path === '/payments/checkout' && method === 'POST') {
        return this.addCorsHeaders((await this.handleCreateCheckout(request)) as Response);
      }
      if (path === '/payments/portal' && method === 'POST') {
        return this.addCorsHeaders((await this.handleCreatePortal(request)) as Response);
      }
      if (path === '/payments/webhook' && method === 'POST') {
        return this.addCorsHeaders((await this.handleStripeWebhook(request)) as Response);
      }
      if (path === '/payments/trial/start' && method === 'POST') {
        return this.addCorsHeaders((await this.handleStartTrial(request)) as Response);
      }

      // Document endpoints
      if (path === '/documents' && method === 'POST') {
        return this.addCorsHeaders((await this.handleUploadDocument(request)) as Response);
      }
      if (path.match(/^\/documents\/\d+$/) && method === 'GET') {
        const documentId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetDocument(documentId)) as Response);
      }
      if (path.match(/^\/users\/\d+\/documents$/) && method === 'GET') {
        const userId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleListUserDocuments(userId)) as Response);
      }

      // Persona endpoints
      if (path === '/personas' && method === 'GET') {
        return this.addCorsHeaders((await this.handleListPersonas(url)) as Response);
      }
      if (path.match(/^\/personas\/\d+$/) && method === 'GET') {
        const personaId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetPersona(personaId)) as Response);
      }
      if (path === '/personas/recommend' && method === 'POST') {
        return this.addCorsHeaders((await this.handleRecommendPersonas(request)) as Response);
      }

      // Scenario endpoints
      if (path === '/scenarios' && method === 'GET') {
        return this.addCorsHeaders((await this.handleListScenarios()) as Response);
      }
      if (path.match(/^\/scenarios\/\d+$/) && method === 'GET') {
        const scenarioId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetScenario(scenarioId)) as Response);
      }

      // Booking slot endpoints
      if (path === '/booking/available-slots' && method === 'GET') {
        return this.addCorsHeaders((await this.handleGetAvailableSlots(url)) as Response);
      }
      if (path === '/booking/slots/seed' && method === 'POST') {
        return this.addCorsHeaders((await this.handleSeedBookingSlots()) as Response);
      }

      // Interview endpoints
      if (path === '/interviews' && method === 'POST') {
        return this.addCorsHeaders((await this.handleCreateInterview(request)) as Response);
      }
      if (path === '/interviews' && method === 'GET') {
        return this.addCorsHeaders((await this.handleListInterviews(url)) as Response);
      }
      if (path.match(/^\/interviews\/\d+$/) && method === 'GET') {
        const interviewId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetInterview(interviewId)) as Response);
      }
      if (path.match(/^\/interviews\/\d+\/cancel$/) && method === 'PATCH') {
        const interviewId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleCancelInterview(interviewId)) as Response);
      }
      if (path.match(/^\/interviews\/\d+\/personas$/) && method === 'POST') {
        const interviewId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleAssignPersonas(interviewId, request)) as Response);
      }

      // Session endpoints
      if (path === '/sessions/start' && method === 'POST') {
        return this.addCorsHeaders((await this.handleStartSession(request)) as Response);
      }
      if (path.match(/^\/sessions\/\d+\/questions$/) && method === 'POST') {
        const sessionId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGenerateQuestion(sessionId)) as Response);
      }
      if (path.match(/^\/sessions\/\d+\/end$/) && method === 'POST') {
        const sessionId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleEndSession(sessionId)) as Response);
      }
      if (path.match(/^\/sessions\/\d+\/analytics$/) && method === 'GET') {
        const sessionId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetSessionAnalytics(sessionId)) as Response);
      }

      // Response/conversation endpoints
      if (path === '/responses/transcribe' && method === 'POST') {
        return this.addCorsHeaders((await this.handleTranscribeAudio(request)) as Response);
      }
      if (path === '/responses' && method === 'POST') {
        return this.addCorsHeaders((await this.handleSubmitResponse(request)) as Response);
      }
      if (path.match(/^\/sessions\/\d+\/responses$/) && method === 'GET') {
        const sessionId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetSessionResponses(sessionId)) as Response);
      }

      // Report endpoints
      if (path.match(/^\/interviews\/\d+\/report$/) && method === 'GET') {
        const interviewId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetReport(interviewId)) as Response);
      }

      // Interview analytics endpoint (finds latest session for interview)
      if (path.match(/^\/interviews\/\d+\/analytics$/) && method === 'GET') {
        const interviewId = parseInt(path.split('/')[2]!);
        return this.addCorsHeaders((await this.handleGetInterviewAnalytics(interviewId)) as Response);
      }

      return this.addCorsHeaders(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    } catch (error) {
      this.env.logger.error('Request failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.addCorsHeaders(
        new Response(
          JSON.stringify({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        ) as Response
      );
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.env.logger.info('Initializing database with prepare().run()...');

      // Split schema SQL into individual statements
      const schemaStatements = createTablesSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      this.env.logger.info(`Executing ${schemaStatements.length} schema statements...`);

      // Execute each schema statement individually
      for (const stmt of schemaStatements) {
        try {
          await this.env.REHEARSE_DB.prepare(stmt).run();
        } catch (err) {
          // Log but continue - table might already exist
          this.env.logger.warn('Schema statement failed (might already exist)', {
            statement: stmt.substring(0, 100),
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Run migrations for existing tables (add new columns if they don't exist)
      this.env.logger.info('Running database migrations...');
      const migrations = [
        `ALTER TABLE responses ADD COLUMN question_text TEXT`,
        `ALTER TABLE responses ADD COLUMN confidence_score REAL`,
        `ALTER TABLE responses ADD COLUMN clarity_score REAL`,
        `ALTER TABLE responses ADD COLUMN relevance_score REAL`,
        `ALTER TABLE session_analytics ADD COLUMN overall_performance TEXT`,
      ];

      for (const migration of migrations) {
        try {
          await this.env.REHEARSE_DB.prepare(migration).run();
          this.env.logger.info('Migration executed successfully', { migration: migration.substring(0, 60) });
        } catch (err) {
          // Log but continue - column might already exist
          this.env.logger.warn('Migration failed (column might already exist)', {
            migration: migration.substring(0, 60),
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Split seed SQL into individual statements
      const seedStatements = seedDataSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      this.env.logger.info(`Executing ${seedStatements.length} seed statements...`);

      // Execute each seed statement individually
      for (const stmt of seedStatements) {
        try {
          await this.env.REHEARSE_DB.prepare(stmt).run();
        } catch (err) {
          // Log but continue - data might already exist (INSERT OR IGNORE)
          this.env.logger.warn('Seed statement failed (might already exist)', {
            statement: stmt.substring(0, 100),
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Verify tables were created
      const planCount = await this.executeSql('SELECT COUNT(*) as count FROM subscription_plans');
      const personaCount = await this.executeSql('SELECT COUNT(*) as count FROM interviewer_personas');

      this.env.logger.info('Database initialized successfully', {
        plans: planCount[0]?.count || 0,
        personas: personaCount[0]?.count || 0
      });
    } catch (error) {
      this.env.logger.error('Database initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw - allow app to continue
    }
  }

  private async executeSql(sqlQuery: string): Promise<any[]> {
    const stmt = this.env.REHEARSE_DB.prepare(sqlQuery);
    const result = await stmt.all();
    return result.results || [];
  }

  private handleHealth(): Response {
    return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private handleCheckEnv(): Response {
    const cerebrasKey = this.env.CEREBRAS_API_KEY;
    const elevenLabsKey = this.env.ELEVENLABS_API_KEY;

    return new Response(JSON.stringify({
      cerebras: {
        exists: !!cerebrasKey,
        length: cerebrasKey?.length || 0,
        firstChars: cerebrasKey?.substring(0, 10) || '',
      },
      elevenlabs: {
        exists: !!elevenLabsKey,
        length: elevenLabsKey?.length || 0,
        firstChars: elevenLabsKey?.substring(0, 10) || '',
      },
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleTestElevenLabs(): Promise<Response> {
    try {
      const elevenLabsKey = this.env.ELEVENLABS_API_KEY;

      if (!elevenLabsKey) {
        return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not set' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Test with Clyde voice (Marcus)
      const voiceId = '2EiwWnXFnvU5JabPnv8n';
      const testText = 'Hello, this is a test of the ElevenLabs integration.';

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text: testText,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({
          error: `ElevenLabs API error: ${response.status}`,
          details: errorText
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const audioData = await response.arrayBuffer();

      return new Response(JSON.stringify({
        success: true,
        audioSize: audioData.byteLength,
        voiceId,
        testText,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleSeedDatabase(): Promise<Response> {
    try {
      this.env.logger.info('Re-seeding database (migrations already ran automatically)...');

      // Re-run seed data (uses INSERT OR IGNORE for idempotency)
      const seedStatements = seedDataSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const stmt of seedStatements) {
        try {
          const prepared = this.env.REHEARSE_DB.prepare(stmt);
          await prepared.run();
        } catch (err) {
          this.env.logger.warn('Seed statement warning', {
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      this.env.logger.info('Re-seeding completed');

      // Verify seeding by counting records
      const planCount = await this.executeSql('SELECT COUNT(*) as count FROM subscription_plans');
      const personaCount = await this.executeSql('SELECT COUNT(*) as count FROM interviewer_personas');
      const scenarioCount = await this.executeSql('SELECT COUNT(*) as count FROM scenarios');
      const slotCount = await this.executeSql('SELECT COUNT(*) as count FROM booking_slots');

      this.env.logger.info('Count results', { planCount, personaCount, scenarioCount, slotCount });

      const result = {
        success: true,
        message: 'Database seeded successfully',
        counts: {
          subscription_plans: parseInt(planCount[0]?.count) || 0,
          interviewer_personas: parseInt(personaCount[0]?.count) || 0,
          scenarios: parseInt(scenarioCount[0]?.count) || 0,
          booking_slots: parseInt(slotCount[0]?.count) || 0,
        },
      };

      this.env.logger.info('Database seeding completed', result.counts);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('Database seeding failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database seeding failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      ) as Response;
    }
  }

  private async handleListPlans(): Promise<Response> {
    try {
      const plans = await this.executeSql('SELECT * FROM subscription_plans ORDER BY id');
      return new Response(JSON.stringify({ count: plans.length, plans }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ) as Response;
    }
  }

  private async handleTestInsert(): Promise<Response> {
    try {
      // Try to insert a single subscription plan (SQLite syntax)
      const insertSql = `INSERT INTO subscription_plans (name, stripe_price_id, price_monthly, max_session_minutes, max_personas, features)
        VALUES ('TestPlan', NULL, 9.99, 30, 2, '["test feature"]')`;

      this.env.logger.info('Attempting test insert');
      const insertStmt = this.env.REHEARSE_DB.prepare(insertSql);
      const insertResult = await insertStmt.run();
      this.env.logger.info('Insert result', {
        lastRowId: insertResult.meta.last_row_id,
        changes: insertResult.meta.changes
      });

      // Check count and plans
      const countData = await this.executeSql('SELECT COUNT(*) as count FROM subscription_plans');
      const plansData = await this.executeSql('SELECT * FROM subscription_plans');
      this.env.logger.info('Count and plans', { countData, plansData });

      return new Response(JSON.stringify({
        success: true,
        inserted_row_id: insertResult.meta.last_row_id,
        total_count: countData[0]?.count || 0,
        all_plans: plansData
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('Test insert failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ) as Response;
    }
  }

  private async handleDiagnoseDatabase(): Promise<Response> {
    const diagnostics: any = {
      steps: [],
      database_available: false,
      exec_works: false,
      prepare_works: false,
      tables_exist: false,
    };

    try {
      // Step 1: Check if database object exists
      diagnostics.steps.push('Checking database object...');
      diagnostics.database_available = !!this.env.REHEARSE_DB;
      diagnostics.steps.push(`Database object available: ${diagnostics.database_available}`);

      if (!this.env.REHEARSE_DB) {
        return new Response(JSON.stringify(diagnostics), {
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Step 2: Try exec() with simple CREATE TABLE
      diagnostics.steps.push('Testing exec() with simple CREATE TABLE...');
      try {
        const simpleCreateSQL = `
          CREATE TABLE IF NOT EXISTS diagnostic_test (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_value TEXT
          )
        `;
        const execResult = await this.env.REHEARSE_DB.exec(simpleCreateSQL);
        diagnostics.exec_result = execResult;
        diagnostics.exec_works = true;
        diagnostics.steps.push(`exec() succeeded: ${JSON.stringify(execResult)}`);
      } catch (err) {
        diagnostics.exec_error = err instanceof Error ? err.message : String(err);
        diagnostics.steps.push(`exec() failed: ${diagnostics.exec_error}`);
      }

      // Step 3: Try prepare() with simple table check
      diagnostics.steps.push('Testing prepare() with table existence check...');
      try {
        const tableCheck = await this.env.REHEARSE_DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table'"
        ).all();
        diagnostics.prepare_works = true;
        diagnostics.existing_tables = tableCheck.results;
        diagnostics.steps.push(`Found ${tableCheck.results.length} tables: ${JSON.stringify(tableCheck.results)}`);
      } catch (err) {
        diagnostics.prepare_error = err instanceof Error ? err.message : String(err);
        diagnostics.steps.push(`prepare() failed: ${diagnostics.prepare_error}`);
      }

      // Step 4: Check if our target table exists
      if (diagnostics.prepare_works) {
        diagnostics.steps.push('Checking for subscription_plans table...');
        const plans_table_exists = diagnostics.existing_tables?.some((t: any) => t.name === 'subscription_plans');
        diagnostics.tables_exist = plans_table_exists || false;
        diagnostics.steps.push(`subscription_plans exists: ${diagnostics.tables_exist}`);
      }

      // Step 5: If exec() worked, try the full schema
      if (diagnostics.exec_works && !diagnostics.tables_exist) {
        diagnostics.steps.push('Attempting to create full schema with exec()...');
        try {
          const schemaResult = await this.env.REHEARSE_DB.exec(createTablesSQL);
          diagnostics.full_schema_result = schemaResult;
          diagnostics.steps.push(`Full schema exec result: ${JSON.stringify(schemaResult)}`);

          // Re-check tables
          const recheckTables = await this.env.REHEARSE_DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table'"
          ).all();
          diagnostics.tables_after_schema = recheckTables.results;
          diagnostics.steps.push(`Tables after schema creation: ${JSON.stringify(recheckTables.results)}`);
        } catch (err) {
          diagnostics.full_schema_error = err instanceof Error ? err.message : String(err);
          diagnostics.steps.push(`Full schema creation failed: ${diagnostics.full_schema_error}`);
        }
      }

      return new Response(JSON.stringify(diagnostics, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      diagnostics.fatal_error = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify(diagnostics, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleManualInitialization(): Promise<Response> {
    const result: any = {
      schema_statements_executed: 0,
      schema_statements_failed: 0,
      seed_statements_executed: 0,
      seed_statements_failed: 0,
      errors: [],
      success: false,
      statements_found: []
    };

    try {
      // Split and execute schema statements
      // Remove comment lines first, then split by semicolons
      const cleanedSchema = createTablesSQL
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))  // Remove comment-only lines
        .join('\n');

      const schemaStatements = cleanedSchema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 10);  // Must be substantial

      result.statements_found = schemaStatements.map((stmt, i) => ({
        index: i,
        preview: stmt.substring(0, 80),
        length: stmt.length
      }));

      for (const stmt of schemaStatements) {
        try {
          await this.env.REHEARSE_DB.prepare(stmt).run();
          result.schema_statements_executed++;
        } catch (err) {
          result.schema_statements_failed++;
          result.errors.push({
            type: 'schema',
            statement: stmt.substring(0, 200),
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Split and execute seed statements
      const cleanedSeed = seedDataSQL
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))  // Remove comment-only lines
        .join('\n');

      const seedStatements = cleanedSeed
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 10);  // Must be substantial

      for (const stmt of seedStatements) {
        try {
          await this.env.REHEARSE_DB.prepare(stmt).run();
          result.seed_statements_executed++;
        } catch (err) {
          result.seed_statements_failed++;
          result.errors.push({
            type: 'seed',
            statement: stmt.substring(0, 200),
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // Verify tables were created
      const tableCheck = await this.env.REHEARSE_DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all();
      result.tables_created = tableCheck.results;

      // Check counts
      try {
        const planCount = await this.executeSql('SELECT COUNT(*) as count FROM subscription_plans');
        const personaCount = await this.executeSql('SELECT COUNT(*) as count FROM interviewer_personas');
        result.data_counts = {
          plans: planCount[0]?.count || 0,
          personas: personaCount[0]?.count || 0
        };
      } catch (err) {
        result.count_error = err instanceof Error ? err.message : String(err);
      }

      result.success = result.schema_statements_failed === 0 && result.seed_statements_failed === 0;

      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500
      }) as Response;
    } catch (error) {
      result.fatal_error = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify(result, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleCreateUser(request: Request): Promise<Response> {
    const body = await request.json();
    const validated = CreateUserSchema.parse(body);

    const rows = await this.executeSql(
      `INSERT INTO users (workos_id, email, name)
       VALUES ('${validated.workos_id}', '${validated.email}', '${validated.name}')
       RETURNING id, workos_id, email, name, created_at`
    );

    return new Response(JSON.stringify(rows[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleGetUser(userId: number): Promise<Response> {
    const rows = await this.executeSql(
      `SELECT id, workos_id, email, name, subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, created_at FROM users WHERE id = ${userId}`
    );

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    return new Response(JSON.stringify(rows[0]), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  // ============================================================================
  // AUTHENTICATION HANDLERS
  // ============================================================================

  private async handleAuthLogin(): Promise<Response> {
    try {
      const authService = createWorkOSAuthService({
        apiKey: this.env.WORKOS_API_KEY,
        clientId: this.env.WORKOS_CLIENT_ID,
        redirectUri: this.env.WORKOS_REDIRECT_URI,
      });

      const authUrl = authService.getAuthorizationUrl();

      return new Response(JSON.stringify({ authUrl }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AuthLogin] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to generate auth URL' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleAuthCallback(request: Request, url: URL): Promise<Response> {
    try {
      // Get code from query parameters
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        return new Response(JSON.stringify({ error: 'Authorization code required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const authService = createWorkOSAuthService({
        apiKey: this.env.WORKOS_API_KEY,
        clientId: this.env.WORKOS_CLIENT_ID,
        redirectUri: this.env.WORKOS_REDIRECT_URI,
      });

      const user = await authService.authenticateWithCode(code);

      // Check if user exists in database
      let dbUser = await this.executeSql(
        `SELECT * FROM users WHERE workos_id = '${user.workosId}'`
      );

      if (dbUser.length === 0) {
        // Create new user with Basic subscription and 3-day Pro trial
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 3);

        // Create Stripe customer
        const stripeService = createStripePaymentService(this.env.STRIPE_SECRET_KEY);
        const customer = await stripeService.createCustomer(user.email, user.name, user.workosId);

        await this.executeSql(
          `INSERT INTO users (workos_id, email, name, subscription_tier, subscription_status, trial_ends_at, stripe_customer_id)
           VALUES ('${user.workosId}', '${user.email}', '${user.name.replace(/'/g, "''")}', 'pro', 'trial', '${trialEndsAt.toISOString()}', '${customer.id}')`
        );

        dbUser = await this.executeSql(
          `SELECT * FROM users WHERE workos_id = '${user.workosId}'`
        );
      }

      // Create session
      const sessionId = await authService.createSession(user.workosId);

      // Encode user data and session for frontend
      const userData = encodeURIComponent(JSON.stringify(dbUser[0]));
      const frontendUrl = `https://capable-fairy-fa3b2a.netlify.app/auth/callback?sessionId=${sessionId}&user=${userData}`;

      // Redirect to frontend callback page
      return Response.redirect(frontendUrl, 302);
    } catch (error) {
      this.env.logger.error('[AuthCallback] Failed', { error: error instanceof Error ? error.message : String(error) });

      // Redirect to frontend with error
      const frontendUrl = `https://capable-fairy-fa3b2a.netlify.app/auth/callback?error=${encodeURIComponent('Authentication failed')}`;
      return Response.redirect(frontendUrl, 302);
    }
  }

  private async handleAuthLogout(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { sessionId?: string };
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Session ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const authService = createWorkOSAuthService({
        apiKey: this.env.WORKOS_API_KEY,
        clientId: this.env.WORKOS_CLIENT_ID,
        redirectUri: this.env.WORKOS_REDIRECT_URI,
      });

      await authService.deleteSession(sessionId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AuthLogout] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Logout failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleAuthMe(request: Request): Promise<Response> {
    try {
      // Get sessionId from Authorization header (Bearer token)
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix

      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // SessionId is the workosId, look up user directly from database
      const dbUser = await this.executeSql(
        `SELECT id, workos_id, email, name, subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, created_at FROM users WHERE workos_id = '${sessionId}'`
      );

      if (dbUser.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      return new Response(JSON.stringify({ user: dbUser[0] }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AuthMe] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to verify session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  // ============================================================================
  // PAYMENT HANDLERS
  // ============================================================================

  private async handleCreateCheckout(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const validated = CreateCheckoutSchema.parse(body);

      // Get user
      const userRows = await this.executeSql(
        `SELECT * FROM users WHERE id = ${validated.user_id}`
      );

      if (userRows.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const user = userRows[0];
      const stripeService = createStripePaymentService(this.env.STRIPE_SECRET_KEY);

      const session = await stripeService.createCheckoutSession(
        user.stripe_customer_id,
        validated.price_id,
        validated.success_url,
        validated.cancel_url
      );

      return new Response(JSON.stringify({ sessionUrl: session.url }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[CreateCheckout] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleCreatePortal(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { user_id?: number; return_url?: string };
      const { user_id, return_url } = body;

      // Get user
      const userRows = await this.executeSql(
        `SELECT * FROM users WHERE id = ${user_id}`
      );

      if (userRows.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const user = userRows[0];

      if (!user.stripe_customer_id) {
        return new Response(JSON.stringify({ error: 'No Stripe customer ID found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const stripeService = createStripePaymentService(this.env.STRIPE_SECRET_KEY);

      try {
        const session = await stripeService.createPortalSession(user.stripe_customer_id as string, return_url || '');

        return new Response(JSON.stringify({ portalUrl: session.url }), {
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      } catch (stripeError: any) {
        // Log the Stripe-specific error
        this.env.logger.error('[CreatePortal] Stripe error', {
          error: stripeError instanceof Error ? stripeError.message : String(stripeError),
          customerId: user.stripe_customer_id,
        });

        // Provide helpful error message
        const errorMessage = stripeError?.message || 'Failed to create portal session';

        return new Response(JSON.stringify({
          error: errorMessage,
          details: 'Please ensure the Stripe Customer Portal is configured in your Stripe Dashboard',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }
    } catch (error) {
      this.env.logger.error('[CreatePortal] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to create portal session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleStripeWebhook(request: Request): Promise<Response> {
    try {
      const body = await request.text();
      const signature = request.headers.get('stripe-signature');

      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const stripe = new (await import('stripe')).default(this.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-10-29.clover',
      });

      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        this.env.STRIPE_WEBHOOK_SECRET
      );

      this.env.logger.info('[StripeWebhook] Event received', { type: event.type });

      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;

          // Get user by stripe customer ID
          const userRows = await this.executeSql(
            `SELECT * FROM users WHERE stripe_customer_id = '${customerId}'`
          );

          if (userRows.length > 0) {
            const user = userRows[0];
            const status = subscription.status === 'active' ? 'active' : subscription.status === 'trialing' ? 'trial' : 'cancelled';

            // Get price ID to determine tier
            const priceId = subscription.items.data[0]?.price.id;
            const planRows = await this.executeSql(
              `SELECT * FROM subscription_plans WHERE stripe_price_id = '${priceId}'`
            );

            let tier = user.subscription_tier;
            if (planRows.length > 0) {
              tier = planRows[0].name.toLowerCase();
            }

            await this.executeSql(
              `UPDATE users
               SET subscription_tier = '${tier}',
                   subscription_status = '${status}',
                   subscription_started_at = '${new Date(subscription.current_period_start * 1000).toISOString()}'
               WHERE id = ${user.id}`
            );

            // Log transaction
            await this.executeSql(
              `INSERT INTO payment_transactions (user_id, stripe_subscription_id, amount, currency, status, transaction_type)
               VALUES (${user.id}, '${subscription.id}', ${(subscription.items.data[0]?.price.unit_amount || 0) / 100}, 'USD', 'succeeded', 'subscription')`
            );
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;

          const userRows = await this.executeSql(
            `SELECT * FROM users WHERE stripe_customer_id = '${customerId}'`
          );

          if (userRows.length > 0) {
            await this.executeSql(
              `UPDATE users
               SET subscription_tier = 'basic',
                   subscription_status = 'cancelled'
               WHERE id = ${userRows[0].id}`
            );
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer;

          const userRows = await this.executeSql(
            `SELECT * FROM users WHERE stripe_customer_id = '${customerId}'`
          );

          if (userRows.length > 0) {
            await this.executeSql(
              `INSERT INTO payment_transactions (user_id, stripe_subscription_id, amount, currency, status, transaction_type)
               VALUES (${userRows[0].id}, '${invoice.subscription || ''}', ${invoice.amount_paid / 100}, '${invoice.currency.toUpperCase()}', 'succeeded', 'renewal')`
            );
          }
          break;
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[StripeWebhook] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleStartTrial(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const validated = StartTrialSchema.parse(body);

      // Get user
      const userRows = await this.executeSql(
        `SELECT * FROM users WHERE id = ${validated.user_id}`
      );

      if (userRows.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const user = userRows[0];

      // Check if user already has an active subscription or trial
      if (user.subscription_status === 'active' || user.subscription_status === 'trial') {
        return new Response(JSON.stringify({ error: 'User already has an active subscription' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Get Pro plan price ID
      const planRows = await this.executeSql(
        `SELECT * FROM subscription_plans WHERE name = 'Pro'`
      );

      if (planRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Pro plan not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const proPlan = planRows[0];

      // Update user to trial status
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 3);

      await this.executeSql(
        `UPDATE users
         SET subscription_tier = 'pro',
             subscription_status = 'trial',
             trial_ends_at = '${trialEndsAt.toISOString()}',
             subscription_started_at = '${new Date().toISOString()}'
         WHERE id = ${user.id}`
      );

      return new Response(JSON.stringify({
        success: true,
        trial_ends_at: trialEndsAt.toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[StartTrial] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to start trial' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleUploadDocument(request: Request): Promise<Response> {
    try {
      // Parse multipart form data
      const formData = await request.formData();
      const userId = formData.get('user_id') as string;
      const file = formData.get('file') as File;

      if (!userId || !file) {
        return new Response(JSON.stringify({ error: 'Missing user_id or file' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Validate file type
      const filename = file.name;
      const fileType = filename.split('.').pop()?.toLowerCase() || '';
      const allowedTypes = ['pdf', 'docx', 'doc', 'txt', 'md'];

      if (!allowedTypes.includes(fileType)) {
        return new Response(JSON.stringify({
          error: `Unsupported file type: ${fileType}. Allowed: ${allowedTypes.join(', ')}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Read file buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileSize = buffer.length;

      // Validate file size (max 10MB)
      if (fileSize > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Generate storage key
      const timestamp = Date.now();
      const storageKey = `documents/${userId}/${timestamp}-${filename}`;

      // Upload to SmartBuckets
      await this.env.REHEARSE_SMART_BUCKETS.put(storageKey, buffer, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream'
        },
        customMetadata: {
          userId,
          filename,
          uploadedAt: new Date().toISOString()
        }
      });

      // Create database record with pending analysis
      const insertResult = await this.env.REHEARSE_DB.prepare(
        `INSERT INTO documents (user_id, storage_key, filename, file_type, file_size, analysis_status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      ).bind(parseInt(userId), storageKey, filename, fileType, fileSize).run();

      const documentId = insertResult.meta.last_row_id;

      // Parse document in background
      this.ctx.waitUntil(this.analyzeDocument(documentId, buffer, fileType, storageKey));

      // Return document record
      const docResult = await this.env.REHEARSE_DB.prepare(
        `SELECT id, user_id, storage_key, filename, file_type, file_size, analysis_status, created_at
         FROM documents WHERE id = ?`
      ).bind(documentId).first();

      return new Response(JSON.stringify(docResult), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      this.env.logger.error('Document upload failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response(JSON.stringify({
        error: 'Document upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async analyzeDocument(documentId: number, buffer: Buffer, fileType: string, storageKey: string): Promise<void> {
    try {
      // Update status to processing
      await this.env.REHEARSE_DB.prepare(
        `UPDATE documents SET analysis_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(documentId).run();

      // Parse document with Workers-compatible libraries
      const documentService = createDocumentService();
      const parsed = await documentService.parseDocument(buffer, fileType);

      // Validate document
      const validation = documentService.validateDocument(parsed);
      if (!validation.valid) {
        await this.env.REHEARSE_DB.prepare(
          `UPDATE documents SET analysis_status = 'failed', analysis_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(JSON.stringify({ errors: validation.errors }), documentId).run();
        this.env.logger.warn('Document validation failed', { documentId, errors: validation.errors });
        return;
      }

      // Analyze with Cerebras (requires API key from env)
      const cerebrasKey = this.env.CEREBRAS_API_KEY;
      if (!cerebrasKey) {
        this.env.logger.warn('CEREBRAS_API_KEY not set, skipping AI analysis');
        await this.env.REHEARSE_DB.prepare(
          `UPDATE documents SET analysis_status = 'completed', analysis_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(JSON.stringify({ parsed, ai_analysis: null }), documentId).run();
        return;
      }

      const cerebrasService = createCerebrasService(cerebrasKey);
      const analysis = await cerebrasService.analyzeDocument(parsed.text, fileType);

      // Store analysis results
      const analysisResult = JSON.stringify({
        parsed,
        ai_analysis: analysis
      });

      await this.env.REHEARSE_DB.prepare(
        `UPDATE documents SET analysis_status = 'completed', analysis_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(analysisResult, documentId).run();

      this.env.logger.info('Document analysis completed', { documentId, storageKey, wordCount: parsed.wordCount });
    } catch (error) {
      this.env.logger.error('Document analysis failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error)
      });
      await this.env.REHEARSE_DB.prepare(
        `UPDATE documents SET analysis_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(documentId).run();
    }
  }

  private async handleGetDocument(documentId: number): Promise<Response> {
    try {
      const doc = await this.env.REHEARSE_DB.prepare(
        `SELECT id, user_id, storage_key, filename, file_type, file_size, analysis_status, analysis_result, created_at, updated_at
         FROM documents WHERE id = ?`
      ).bind(documentId).first();

      if (!doc) {
        return new Response(JSON.stringify({ error: 'Document not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      return new Response(JSON.stringify(doc), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to retrieve document',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleListUserDocuments(userId: number): Promise<Response> {
    try {
      const docs = await this.env.REHEARSE_DB.prepare(
        `SELECT id, user_id, storage_key, filename, file_type, file_size, analysis_status, created_at, updated_at
         FROM documents WHERE user_id = ? ORDER BY created_at DESC`
      ).bind(userId).all();

      return new Response(JSON.stringify({
        count: docs.results.length,
        documents: docs.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to list documents',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleListPersonas(url: URL): Promise<Response> {
    try {
      // Parse query parameters for filtering
      const role = url.searchParams.get('role');
      const gender = url.searchParams.get('gender');
      const style = url.searchParams.get('questioning_style');
      const focusArea = url.searchParams.get('focus_area');

      let query = 'SELECT * FROM interviewer_personas WHERE 1=1';
      const params: any[] = [];

      if (role) {
        query += ' AND role LIKE ?';
        params.push(`%${role}%`);
      }
      if (gender) {
        query += ' AND gender = ?';
        params.push(gender);
      }
      if (style) {
        query += ' AND questioning_style = ?';
        params.push(style);
      }
      if (focusArea) {
        query += ' AND focus_areas LIKE ?';
        params.push(`%${focusArea}%`);
      }

      query += ' ORDER BY name';

      const stmt = this.env.REHEARSE_DB.prepare(query);
      const result = await stmt.bind(...params).all();

      // Parse focus_areas from JSON string to array
      const personas = result.results.map((persona: any) => ({
        ...persona,
        focus_areas: persona.focus_areas ? JSON.parse(persona.focus_areas) : []
      }));

      return new Response(JSON.stringify({
        count: personas.length,
        personas: personas
      }), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to list personas',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleGetPersona(personaId: number): Promise<Response> {
    try {
      const persona = await this.env.REHEARSE_DB.prepare(
        'SELECT * FROM interviewer_personas WHERE id = ?'
      ).bind(personaId).first();

      if (!persona) {
        return new Response(JSON.stringify({ error: 'Persona not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Parse focus_areas from JSON string to array
      const personaData: any = persona;
      if (personaData.focus_areas) {
        personaData.focus_areas = JSON.parse(personaData.focus_areas);
      }

      return new Response(JSON.stringify(personaData), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to retrieve persona',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleRecommendPersonas(request: Request): Promise<Response> {
    try {
      const body: any = await request.json();
      const { documentId, scenarioType, maxPersonas = 3 } = body;

      if (!documentId && !scenarioType) {
        return new Response(JSON.stringify({
          error: 'Either documentId or scenarioType is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      let recommendedPersonas: any[] = [];

      // Get document analysis if provided
      if (documentId) {
        const doc = await this.env.REHEARSE_DB.prepare(
          'SELECT analysis_result FROM documents WHERE id = ?'
        ).bind(documentId).first();

        if (doc && doc.analysis_result) {
          const analysis = JSON.parse(doc.analysis_result as string);

          // Recommend based on document analysis
          if (analysis.ai_analysis) {
            const { role_level, question_categories } = analysis.ai_analysis;

            // Select personas based on role level and focus areas
            let query = 'SELECT * FROM interviewer_personas WHERE ';
            const conditions: string[] = [];

            // Match role level
            if (role_level === 'senior' || role_level === 'executive') {
              conditions.push("role IN ('VP of Engineering', 'CTO', 'CEO', 'Director of Engineering')");
            } else if (role_level === 'mid') {
              conditions.push("role IN ('Technical Manager', 'Senior Engineer', 'Team Lead')");
            } else {
              conditions.push("role IN ('Senior Engineer', 'Recruiter', 'HR Director')");
            }

            query += conditions.join(' OR ');
            query += ' ORDER BY RANDOM() LIMIT ?';

            const result = await this.env.REHEARSE_DB.prepare(query).bind(maxPersonas).all();
            recommendedPersonas = result.results;
          }
        }
      }

      // Fallback: Get personas by scenario type
      if (recommendedPersonas.length === 0 && scenarioType) {
        const scenario = await this.env.REHEARSE_DB.prepare(
          'SELECT recommended_personas FROM scenarios WHERE type = ? LIMIT 1'
        ).bind(scenarioType).first();

        if (scenario && scenario.recommended_personas) {
          const roleNames = JSON.parse(scenario.recommended_personas as string);

          const placeholders = roleNames.map(() => '?').join(',');
          const result = await this.env.REHEARSE_DB.prepare(
            `SELECT * FROM interviewer_personas WHERE role IN (${placeholders}) LIMIT ?`
          ).bind(...roleNames, maxPersonas).all();

          recommendedPersonas = result.results;
        }
      }

      // Final fallback: Random selection with variety
      if (recommendedPersonas.length === 0) {
        // Select a mix: 1 technical, 1 behavioral, 1 varied
        const technicalResult = await this.env.REHEARSE_DB.prepare(
          "SELECT * FROM interviewer_personas WHERE focus_areas LIKE '%technical%' ORDER BY RANDOM() LIMIT 1"
        ).all();

        const behavioralResult = await this.env.REHEARSE_DB.prepare(
          "SELECT * FROM interviewer_personas WHERE focus_areas LIKE '%behavioral%' ORDER BY RANDOM() LIMIT 1"
        ).all();

        recommendedPersonas = [...technicalResult.results, ...behavioralResult.results];

        if (recommendedPersonas.length < maxPersonas) {
          const remaining = maxPersonas - recommendedPersonas.length;
          const moreResult = await this.env.REHEARSE_DB.prepare(
            'SELECT * FROM interviewer_personas ORDER BY RANDOM() LIMIT ?'
          ).bind(remaining).all();
          recommendedPersonas = [...recommendedPersonas, ...moreResult.results];
        }
      }

      return new Response(JSON.stringify({
        count: recommendedPersonas.length,
        personas: recommendedPersonas,
        recommendation_basis: documentId ? 'document_analysis' : scenarioType ? 'scenario_type' : 'random_selection'
      }), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      this.env.logger.error('Persona recommendation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response(JSON.stringify({
        error: 'Failed to recommend personas',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleListScenarios(): Promise<Response> {
    try {
      const result = await this.env.REHEARSE_DB.prepare(
        'SELECT * FROM scenarios ORDER BY type, name'
      ).all();

      return new Response(JSON.stringify({
        count: result.results.length,
        scenarios: result.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to list scenarios',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleGetScenario(scenarioId: number): Promise<Response> {
    try {
      const scenario = await this.env.REHEARSE_DB.prepare(
        'SELECT * FROM scenarios WHERE id = ?'
      ).bind(scenarioId).first();

      if (!scenario) {
        return new Response(JSON.stringify({ error: 'Scenario not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Get recommended personas for this scenario
      if (scenario.recommended_personas) {
        const roleNames = JSON.parse(scenario.recommended_personas as string);
        const placeholders = roleNames.map(() => '?').join(',');
        const personasResult = await this.env.REHEARSE_DB.prepare(
          `SELECT * FROM interviewer_personas WHERE role IN (${placeholders})`
        ).bind(...roleNames).all();

        return new Response(JSON.stringify({
          ...scenario,
          personas: personasResult.results
        }), {
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      return new Response(JSON.stringify(scenario), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to retrieve scenario',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleCreateInterview(request: Request): Promise<Response> {
    const body = await request.json();
    const validated = CreateInterviewSchema.parse(body);

    // Check user subscription and limits
    const userRows = await this.executeSql(
      `SELECT * FROM users WHERE id = ${validated.user_id}`
    );

    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    const user = userRows[0];
    const subscriptionGate = createSubscriptionGate();

    // Check if subscription is active
    const accessCheck = await subscriptionGate.checkAccess(user, {
      requiredTier: 'basic',
      featureName: 'interview_creation',
    });

    if (!accessCheck.allowed) {
      return new Response(JSON.stringify({
        error: accessCheck.reason,
        requiresUpgrade: true,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    // Check persona limit for user's tier
    const limits = subscriptionGate.getFeatureLimits(user.subscription_tier);
    const numPersonas = validated.persona_ids.length;

    if (limits.maxPersonasPerInterview !== -1 && numPersonas > limits.maxPersonasPerInterview) {
      return new Response(JSON.stringify({
        error: `Your ${user.subscription_tier} plan allows up to ${limits.maxPersonasPerInterview} persona(s) per interview. Upgrade to add more.`,
        requiresUpgrade: true,
        currentLimit: limits.maxPersonasPerInterview,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    // Check monthly interview limit
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const interviewCountRows = await this.executeSql(
      `SELECT COUNT(*) as count FROM interviews
       WHERE user_id = ${validated.user_id}
       AND created_at >= '${firstDayOfMonth.toISOString()}'`
    );

    const currentMonthInterviews = interviewCountRows[0]?.count || 0;
    const usageCheck = await subscriptionGate.checkUsageLimit(user, currentMonthInterviews, 'interviews');

    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({
        error: usageCheck.reason,
        requiresUpgrade: true,
        currentUsage: currentMonthInterviews,
        limit: limits.maxInterviewsPerMonth,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    const docId = validated.document_id || 'NULL';
    const scenarioId = validated.scenario_id || 'NULL';
    const schedAt = validated.scheduled_at ? `'${validated.scheduled_at}'` : 'NULL';

    // Insert interview
    const interviewRows = await this.executeSql(
      `INSERT INTO interviews (user_id, document_id, scenario_id, duration_minutes, mode, num_personas, scheduled_at, status)
       VALUES (${validated.user_id}, ${docId}, ${scenarioId}, ${validated.duration_minutes}, '${validated.mode}', ${numPersonas}, ${schedAt}, 'scheduled')
       RETURNING id, user_id, document_id, scenario_id, duration_minutes, mode, num_personas, scheduled_at, status, created_at`
    );

    const interview = interviewRows[0];
    if (!interview) {
      return new Response(JSON.stringify({ error: 'Failed to create interview' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    // Assign personas with turn order
    for (let i = 0; i < validated.persona_ids.length; i++) {
      await this.executeSql(
        `INSERT INTO interview_personas (interview_id, persona_id, turn_order)
         VALUES (${interview.id}, ${validated.persona_ids[i]}, ${i + 1})`
      );
    }

    // Fetch assigned personas with details
    const personaRows = await this.executeSql(
      `SELECT ip.turn_order, p.id, p.name, p.role, p.voice_id, p.voice_name, p.gender, p.questioning_style, p.focus_areas
       FROM interview_personas ip
       JOIN interviewer_personas p ON ip.persona_id = p.id
       WHERE ip.interview_id = ${interview.id}
       ORDER BY ip.turn_order`
    );

    return new Response(JSON.stringify({
      ...interview,
      personas: personaRows,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleListInterviews(url: URL): Promise<Response> {
    const userId = url.searchParams.get('user_id');

    let query = 'SELECT * FROM interviews';

    if (userId) {
      query += ` WHERE user_id = ${userId}`;
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.executeSql(query);

    return new Response(JSON.stringify({ interviews: rows }), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleGetInterview(interviewId: number): Promise<Response> {
    const rows = await this.executeSql(
      `SELECT * FROM interviews WHERE id = ${interviewId}`
    );

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    return new Response(JSON.stringify(rows[0]), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleStartSession(request: Request): Promise<Response> {
    const body = await request.json();
    const validated = StartSessionSchema.parse(body);

    // Create interview session
    const rows = await this.executeSql(
      `INSERT INTO interview_sessions (interview_id, status)
       VALUES (${validated.interview_id}, 'active')
       RETURNING id, interview_id, session_start_time, status`
    );

    const session = rows[0];

    // Initialize SmartMemory working memory session for AI conversation
    const memorySession = await this.env.REHEARSE_SMART_MEMORY.startWorkingMemorySession();

    // Update session with memory session ID
    await this.executeSql(
      `UPDATE interview_sessions
       SET memory_session_id = '${memorySession.sessionId}'
       WHERE id = ${session.id}`
    );

    this.env.logger.info('Started SmartMemory session', {
      memorySessionId: memorySession.sessionId,
      interviewSessionId: session.id
    });

    return new Response(JSON.stringify({
      ...session,
      memory_session_id: memorySession.sessionId
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleGenerateQuestion(sessionId: number): Promise<Response> {
    try {
      // Get session with interview details
      const sessionRows = await this.executeSql(
        `SELECT s.*, i.user_id, i.document_id, i.scenario_id, i.duration_minutes, i.mode, i.config
         FROM interview_sessions s
         JOIN interviews i ON s.interview_id = i.id
         WHERE s.id = ${sessionId}`
      );

      if (sessionRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const session = sessionRows[0];

      // Get interview personas
      const personaRows = await this.executeSql(
        `SELECT p.*, ip.turn_order
         FROM interview_personas ip
         JOIN interviewer_personas p ON ip.persona_id = p.id
         WHERE ip.interview_id = ${session.interview_id}
         ORDER BY ip.turn_order`
      );

      if (personaRows.length === 0) {
        return new Response(JSON.stringify({ error: 'No personas configured for interview' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Get scenario details
      let scenarioType = 'interview';
      let scenarioDescription = '';
      if (session.scenario_id) {
        const scenarioRows = await this.executeSql(
          `SELECT * FROM scenarios WHERE id = ${session.scenario_id}`
        );
        if (scenarioRows.length > 0) {
          scenarioType = scenarioRows[0].type;
          scenarioDescription = scenarioRows[0].description;
        }
      }

      // Get document context if available
      let documentContext = '';
      if (session.document_id) {
        const docRows = await this.executeSql(
          `SELECT analysis_result FROM documents WHERE id = ${session.document_id}`
        );
        if (docRows.length > 0 && docRows[0].analysis_result) {
          try {
            const analysis = JSON.parse(docRows[0].analysis_result);
            documentContext = analysis.parsed?.text || '';
          } catch (e) {
            this.env.logger.warn('Failed to parse document analysis', {
              error: e instanceof Error ? e.message : String(e)
            });
          }
        }
      }

      // Get previous questions and responses
      const questionRows = await this.executeSql(
        `SELECT question_text, question_number FROM questions
         WHERE session_id = ${sessionId}
         ORDER BY question_number DESC LIMIT 5`
      );

      const responseRows = await this.executeSql(
        `SELECT user_response_text FROM responses
         WHERE session_id = ${sessionId}
         ORDER BY timestamp DESC LIMIT 3`
      );

      // Build interview config
      const personas = personaRows.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        voiceId: p.voice_id,
        voiceName: p.voice_name,
        gender: p.gender,
        questioningStyle: p.questioning_style,
        focusAreas: JSON.parse(p.focus_areas || '[]'),
      }));

      const config: InterviewConfig = {
        interviewId: session.interview_id,
        userId: session.user_id,
        documentContext: documentContext.substring(0, 1000), // Limit context
        scenarioType,
        scenarioDescription,
        personas,
        durationMinutes: session.duration_minutes || 15,
        mode: session.mode || 'practice',
      };

      // Build session state
      const sessionState: SessionState = {
        interviewId: session.interview_id,
        sessionId: session.id,
        memorySessionId: session.memory_session_id || '',
        currentPersonaIndex: questionRows.length,
        questionCount: questionRows.length,
        startTime: new Date(session.session_start_time),
        conversationHistory: [],
        questionsAsked: questionRows.map((q: any) => q.question_text).reverse(),
        userResponses: responseRows.map((r: any) => r.user_response_text).reverse(),
      };

      // Create orchestrator and generate question
      const cerebrasKey = this.env.CEREBRAS_API_KEY;
      if (!cerebrasKey) {
        return new Response(JSON.stringify({ error: 'CEREBRAS_API_KEY not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const elevenLabsKey = this.env.ELEVENLABS_API_KEY;

      // Log audio generation setup
      this.env.logger.info('Audio generation setup', {
        hasElevenLabsKey: !!elevenLabsKey,
        elevenLabsKeyLength: elevenLabsKey?.length || 0,
        personas: personas.map(p => ({ name: p.name, voiceId: p.voiceId, voiceName: p.voiceName })),
      });

      const orchestrator = createInterviewOrchestrator(cerebrasKey, elevenLabsKey);
      const conversationalTurn = await orchestrator.generateConversationalTurn(config, sessionState);
      const question = conversationalTurn.question;

      // Log audio generation result
      this.env.logger.info('Audio generation result', {
        hasAudioData: !!question.audioData,
        audioDataSize: question.audioData?.byteLength || 0,
        questionPersona: question.persona.name,
        questionPersonaVoiceId: (question.persona as any).voiceId,
      });

      // Store question in database
      const questionTextEscaped = question.questionText.replace(/'/g, "''");

      const insertedQuestions = await this.executeSql(
        `INSERT INTO questions (session_id, persona_id, question_text, question_category, question_number)
         VALUES (${sessionId}, ${question.persona.id}, '${questionTextEscaped}', '${question.category}', ${question.questionNumber})
         RETURNING id, question_text, question_category, question_number`
      );

      // Convert audio to base64 data URL if available
      let audioUrl: string | undefined;
      if (question.audioData) {
        try {
          // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
          const uint8Array = new Uint8Array(question.audioData);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const audioBase64 = btoa(binary);
          audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
        } catch (error) {
          this.env.logger.error('Failed to convert audio to base64', { error: String(error) });
        }
      }

      // TODO: Store conversation in SmartMemory
      // if (session.memory_session_id) {
      //   await this.env.REHEARSE_SMART_MEMORY.storeMemory(
      //     session.memory_session_id,
      //     `${question.persona.name} (${question.persona.role}): ${question.questionText}`
      //   );
      // }

      return new Response(JSON.stringify({
        // Conversational elements
        acknowledgment: conversationalTurn.acknowledgment,
        isFollowUp: conversationalTurn.isFollowUp,

        // Question details
        question: insertedQuestions[0],
        persona: {
          name: question.persona.name,
          role: question.persona.role,
          voiceName: question.persona.voiceName,
          voiceId: (question.persona as any).voiceId, // DEBUG: check if voiceId is present
        },
        hasAudio: !!audioUrl,
        audioUrl: audioUrl,

        // Session timing info for auto-end
        durationMinutes: config.durationMinutes,
        sessionStartTime: session.session_start_time,

        debug: {
          hasElevenLabsKey: !!elevenLabsKey,
          personaVoiceId: (question.persona as any).voiceId,
          audioDataSize: question.audioData?.byteLength || 0,
        },
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('Question generation failed', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      return new Response(JSON.stringify({
        error: 'Failed to generate question',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleEndSession(sessionId: number): Promise<Response> {
    // Get session with interview details
    const sessionRows = await this.executeSql(
      `SELECT s.*, i.mode, i.user_id
       FROM interview_sessions s
       JOIN interviews i ON s.interview_id = i.id
       WHERE s.id = ${sessionId}`
    );

    if (sessionRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    const session = sessionRows[0];
    const mode = session.mode || 'practice';

    // Update session status to completed
    await this.executeSql(
      `UPDATE interview_sessions
       SET session_end_time = CURRENT_TIMESTAMP, status = 'completed'
       WHERE id = ${sessionId}`
    );

    // Get all responses for this session
    const responseRows = await this.executeSql(
      `SELECT * FROM responses WHERE session_id = ${sessionId} ORDER BY timestamp ASC`
    );

    // Calculate analytics
    let overallGrade = 0;
    let avgConfidence = 0;
    let avgClarity = 0;
    let avgRelevance = 0;
    let keyStrengths: string[] = [];
    let keyImprovements: string[] = [];

    if (mode === 'graded' && responseRows.length > 0) {
      // Calculate averages and round to nearest integer
      const grades = responseRows.map((r: any) => r.grade || 0);
      overallGrade = Math.round(grades.reduce((a: number, b: number) => a + b, 0) / grades.length);

      const confidenceScores = responseRows.map((r: any) => r.confidence_score || 0);
      avgConfidence = Math.round(confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length);

      const clarityScores = responseRows.map((r: any) => r.clarity_score || 0);
      avgClarity = Math.round(clarityScores.reduce((a: number, b: number) => a + b, 0) / clarityScores.length);

      const relevanceScores = responseRows.map((r: any) => r.relevance_score || 0);
      avgRelevance = Math.round(relevanceScores.reduce((a: number, b: number) => a + b, 0) / relevanceScores.length);

      // Aggregate strengths and improvements from all responses
      const strengthsSet = new Set<string>();
      const improvementsSet = new Set<string>();

      responseRows.forEach((r: any) => {
        if (r.ai_feedback) {
          const feedback = typeof r.ai_feedback === 'string'
            ? JSON.parse(r.ai_feedback)
            : r.ai_feedback;

          if (feedback.strengths) {
            feedback.strengths.forEach((s: string) => strengthsSet.add(s));
          }
          if (feedback.improvements) {
            feedback.improvements.forEach((i: string) => improvementsSet.add(i));
          }
        }
      });

      keyStrengths = Array.from(strengthsSet).slice(0, 5);
      keyImprovements = Array.from(improvementsSet).slice(0, 5);
    }

    // Generate overall performance summary for graded mode
    let overallPerformance = 'Practice session completed';
    if (mode === 'graded') {
      const performanceLevel = overallGrade >= 80 ? 'Excellent' :
                               overallGrade >= 70 ? 'Good' :
                               overallGrade >= 60 ? 'Fair' : 'Needs Improvement';

      overallPerformance = `${performanceLevel} performance with an overall grade of ${overallGrade.toFixed(1)}%. Strong performance in ${keyStrengths.length > 0 ? keyStrengths[0] : 'multiple areas'}. Consider focusing on ${keyImprovements.length > 0 ? keyImprovements[0] : 'continued practice'}.`;
    }

    // Store session analytics
    const strengthsJson = JSON.stringify(keyStrengths).replace(/'/g, "''");
    const improvementsJson = JSON.stringify(keyImprovements).replace(/'/g, "''");
    const overallPerformanceEscaped = overallPerformance.replace(/'/g, "''");

    await this.executeSql(
      `INSERT INTO session_analytics (session_id, overall_grade, confidence_score, clarity_score, relevance_score, overall_performance, strengths, improvements)
       VALUES (${sessionId}, ${overallGrade}, ${avgConfidence}, ${avgClarity}, ${avgRelevance}, '${overallPerformanceEscaped}', '${strengthsJson}', '${improvementsJson}')`
    );

    // Get final session data
    const finalSessionRows = await this.executeSql(
      `SELECT * FROM interview_sessions WHERE id = ${sessionId}`
    );

    return new Response(JSON.stringify({
      session: finalSessionRows[0],
      analytics: {
        overall_grade: overallGrade,
        confidence_score: avgConfidence,
        clarity_score: avgClarity,
        relevance_score: avgRelevance,
        key_strengths: keyStrengths,
        key_improvements: keyImprovements,
        overall_performance: overallPerformance,
        response_count: responseRows.length,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleSubmitResponse(request: Request): Promise<Response> {
    const body = await request.json();
    const validated = SubmitResponseSchema.parse(body);

    // Get session and interview details
    const sessionRows = await this.executeSql(
      `SELECT s.*, i.mode, i.scenario_id, i.document_id
       FROM interview_sessions s
       JOIN interviews i ON s.interview_id = i.id
       WHERE s.id = ${validated.session_id}`
    );

    if (sessionRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    const session = sessionRows[0];
    const mode = session.mode || 'practice';

    let feedback: any;
    let grade = 0;
    let confidence_score = 0;
    let clarity_score = 0;
    let relevance_score = 0;

    if (mode === 'graded') {
      // Get the persona that asked this question (from most recent question)
      const questionRows = await this.executeSql(
        `SELECT persona_id FROM questions
         WHERE session_id = ${validated.session_id}
         ORDER BY id DESC LIMIT 1`
      );

      if (questionRows.length > 0) {
        const personaRows = await this.executeSql(
          `SELECT * FROM interviewer_personas WHERE id = ${questionRows[0].persona_id}`
        );

        if (personaRows.length > 0) {
          const persona = personaRows[0];
          const focusAreas = JSON.parse(persona.focus_areas || '[]');

          // Use interview orchestrator for comprehensive grading
          const cerebrasKey = this.env.CEREBRAS_API_KEY;
          if (!cerebrasKey) {
            throw new Error('CEREBRAS_API_KEY not configured');
          }

          const orchestrator = createInterviewOrchestrator(cerebrasKey);
          const evaluation = await orchestrator.evaluateResponse(
            { mode: mode as 'practice' | 'graded' } as any,
            validated.question_text,
            validated.user_response_text,
            {
              id: persona.id,
              name: persona.name,
              role: persona.role,
              voiceId: persona.voice_id,
              voiceName: persona.voice_name,
              gender: persona.gender,
              questioningStyle: persona.questioning_style,
              focusAreas: focusAreas,
            }
          );

          feedback = {
            detailed_feedback: evaluation.feedback,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
          };
          grade = Math.round(evaluation.grade);

          // Estimate component scores and round to nearest integer
          confidence_score = Math.round(Math.min(100, grade + Math.random() * 10 - 5));
          clarity_score = Math.round(Math.min(100, grade + Math.random() * 10 - 5));
          relevance_score = Math.round(Math.min(100, grade + Math.random() * 10 - 5));
        }
      }
    } else {
      // Practice mode - minimal feedback
      feedback = {
        detailed_feedback: 'Response recorded (practice mode)',
        strengths: [],
        improvements: [],
      };
    }

    const responseEscaped = validated.user_response_text.replace(/'/g, "''");
    const feedbackJson = JSON.stringify(feedback).replace(/'/g, "''");

    // Get the most recent question for this session
    const recentQuestionRows = await this.executeSql(
      `SELECT id, question_text FROM questions WHERE session_id = ${validated.session_id} ORDER BY id DESC LIMIT 1`
    );

    if (recentQuestionRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No question found for this session' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    const questionId = recentQuestionRows[0].id;
    const questionText = (recentQuestionRows[0].question_text || '').replace(/'/g, "''");

    // Store the response with comprehensive feedback (including all score fields)
    const rows = await this.executeSql(
      `INSERT INTO responses (question_id, session_id, question_text, user_response_text, ai_feedback, grade, confidence_score, clarity_score, relevance_score)
       VALUES (${questionId}, ${validated.session_id}, '${questionText}', '${responseEscaped}', '${feedbackJson}', ${grade}, ${confidence_score}, ${clarity_score}, ${relevance_score})
       RETURNING *`
    );

    // Store detailed scores in session analytics if in graded mode
    if (mode === 'graded') {
      // Check if analytics row exists
      const analyticsRows = await this.executeSql(
        `SELECT id FROM session_analytics WHERE session_id = ${validated.session_id}`
      );

      if (analyticsRows.length === 0) {
        // Create new analytics row
        await this.executeSql(
          `INSERT INTO session_analytics (session_id, overall_grade, confidence_score, clarity_score, relevance_score)
           VALUES (${validated.session_id}, ${grade}, ${confidence_score}, ${clarity_score}, ${relevance_score})`
        );
      } else {
        // Update existing analytics row (average scores)
        await this.executeSql(
          `UPDATE session_analytics
           SET overall_grade = (overall_grade + ${grade}) / 2,
               confidence_score = (confidence_score + ${confidence_score}) / 2,
               clarity_score = (clarity_score + ${clarity_score}) / 2,
               relevance_score = (relevance_score + ${relevance_score}) / 2
           WHERE session_id = ${validated.session_id}`
        );
      }
    }

    return new Response(JSON.stringify(rows[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  /**
   * Transcribe audio using ElevenLabs Scribe
   */
  private async handleTranscribeAudio(request: Request): Promise<Response> {
    try {
      const elevenLabsKey = this.env.ELEVENLABS_API_KEY;
      if (!elevenLabsKey) {
        return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Parse multipart form data
      const formData = await request.formData();
      const audioFile = formData.get('audio');

      if (!audioFile || !(audioFile instanceof File)) {
        return new Response(JSON.stringify({ error: 'No audio file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      this.env.logger.info('[TranscribeAudio] Processing audio file', {
        fileName: audioFile.name,
        fileSize: audioFile.size,
        fileType: audioFile.type,
      });

      // Use the File directly - it extends Blob
      const audioBlob: Blob = audioFile;

      this.env.logger.info('[TranscribeAudio] Converted to Blob', {
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
      });

      // Use ElevenLabs service to transcribe
      const { createElevenLabsService } = await import('../services/elevenlabs.service');
      const elevenLabs = createElevenLabsService(elevenLabsKey);

      this.env.logger.info('[TranscribeAudio] Calling ElevenLabs API', {
        modelId: 'scribe_v1',
        blobSize: audioBlob.size,
      });

      const result = await elevenLabs.transcribeAudio({
        audioFile: audioBlob,
        modelId: 'scribe_v1',
      });

      this.env.logger.info('[TranscribeAudio] ElevenLabs API success', {
        textLength: result.text?.length || 0,
      });

      this.env.logger.info('[TranscribeAudio] Transcription successful', {
        textLength: result.text.length,
        languageCode: result.languageCode,
        languageProbability: result.languageProbability,
      });

      return new Response(JSON.stringify({
        text: result.text,
        language_code: result.languageCode,
        language_probability: result.languageProbability,
        transcription_id: result.transcriptionId,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;

    } catch (error) {
      this.env.logger.error('[TranscribeAudio] Failed to transcribe audio', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });

      return new Response(JSON.stringify({
        error: 'Failed to transcribe audio',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleGetSessionResponses(sessionId: number): Promise<Response> {
    const rows = await this.executeSql(
      `SELECT * FROM responses WHERE session_id = ${sessionId} ORDER BY timestamp ASC`
    );

    return new Response(JSON.stringify({ responses: rows }), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleGetInterviewAnalytics(interviewId: number): Promise<Response> {
    try {
      this.env.logger.info('[GetInterviewAnalytics] Fetching analytics for interview', { interviewId });

      // Verify interview exists
      const interviewRows = await this.executeSql(
        `SELECT id FROM interviews WHERE id = ${interviewId}`
      );

      if (interviewRows.length === 0) {
        return new Response(JSON.stringify({ error: 'Interview not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Find the most recent completed session for this interview
      const sessionRows = await this.executeSql(
        `SELECT id FROM interview_sessions
         WHERE interview_id = ${interviewId}
         AND status = 'completed'
         ORDER BY session_end_time DESC
         LIMIT 1`
      );

      if (sessionRows.length === 0) {
        this.env.logger.warn('[GetInterviewAnalytics] No completed sessions found', { interviewId });
        return new Response(JSON.stringify({
          error: 'No completed sessions found',
          message: 'This interview has no completed sessions yet. Complete a session to see analytics.',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const sessionId = sessionRows[0].id;
      this.env.logger.info('[GetInterviewAnalytics] Found session', { interviewId, sessionId });

      // Reuse the existing session analytics logic
      return await this.handleGetSessionAnalytics(sessionId);
    } catch (error) {
      this.env.logger.error('[GetInterviewAnalytics] Failed', {
        interviewId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return new Response(JSON.stringify({
        error: 'Failed to fetch interview analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  private async handleGetReport(interviewId: number): Promise<Response> {
    // Check if report exists
    const reportRows = await this.executeSql(
      `SELECT * FROM reports WHERE interview_id = ${interviewId}`
    );

    if (reportRows.length === 0) {
      // Generate new report
      return await this.generateReport(interviewId);
    }

    // Retrieve existing report from SmartBucket
    const report = reportRows[0];
    const reportObj = await this.env.REHEARSE_SMART_BUCKETS.get(report.object_storage_key);

    if (!reportObj) {
      return new Response(JSON.stringify({ error: 'Report file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    const reportData = await reportObj.text();

    return new Response(JSON.stringify({
      report_id: report.id,
      interview_id: report.interview_id,
      generated_at: report.generated_at,
      data: JSON.parse(reportData),
    }), {
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async generateAIFeedback(question: string, response: string): Promise<any> {
    const prompt = `You are an expert interview coach. Evaluate the following interview response:

Question: ${question}

Response: ${response}

Provide detailed feedback in JSON format with the following structure:
{
  "grade": <number between 0-100>,
  "strengths": [<list of strengths>],
  "improvements": [<list of areas for improvement>],
  "suggestions": [<specific suggestions for better responses>],
  "overall_feedback": "<overall assessment>"
}`;

    try {
      const aiResponse = await this.env.AI.run('llama-3.3-70b', {
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract content from AI response
      let feedbackText = '';
      if ('response' in aiResponse && typeof aiResponse.response === 'string') {
        feedbackText = aiResponse.response;
      } else if ('content' in aiResponse) {
        feedbackText = String(aiResponse.content);
      } else if (typeof aiResponse === 'object' && aiResponse !== null) {
        // Try to extract message from response structure
        const resp = aiResponse as any;
        if (resp.choices && resp.choices[0]?.message?.content) {
          feedbackText = resp.choices[0].message.content;
        }
      }

      const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback if JSON parsing fails
      return {
        grade: 70,
        strengths: ['Response provided'],
        improvements: ['Could provide more detail'],
        suggestions: ['Add specific examples'],
        overall_feedback: feedbackText || 'No feedback generated',
      };
    } catch (error) {
      this.env.logger.error('AI feedback generation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        grade: 70,
        strengths: [],
        improvements: [],
        suggestions: [],
        overall_feedback: 'Feedback generation failed',
      };
    }
  }

  private async generateReport(interviewId: number): Promise<Response> {
    // Get all sessions for this interview
    const sessions = await this.executeSql(
      `SELECT * FROM interview_sessions WHERE interview_id = ${interviewId}`
    );

    if (sessions.length === 0) {
      return new Response(JSON.stringify({ error: 'No sessions found for this interview' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    // Aggregate all responses across sessions
    const sessionIds = sessions.map((s: any) => s.id);
    const responses = await this.executeSql(
      `SELECT * FROM responses WHERE session_id IN (${sessionIds.join(',')})`
    );

    const totalResponses = responses.length;
    const averageGrade = totalResponses > 0
      ? responses.reduce((sum: number, r: any) => sum + parseFloat(r.grade), 0) / totalResponses
      : 0;

    const report = {
      interview_id: interviewId,
      generated_at: new Date().toISOString(),
      summary: {
        total_sessions: sessions.length,
        total_responses: totalResponses,
        average_grade: averageGrade.toFixed(2),
      },
      responses: responses.map((r: any) => ({
        question: r.question_text,
        response: r.user_response_text,
        feedback: r.ai_feedback,
        grade: r.grade,
        timestamp: r.timestamp,
      })),
    };

    // Store report in SmartBucket
    const reportKey = `reports/interview_${interviewId}_${Date.now()}.json`;
    await this.env.REHEARSE_SMART_BUCKETS.put(reportKey, JSON.stringify(report));

    // Store reference in database
    await this.executeSql(
      `INSERT INTO reports (interview_id, object_storage_key) VALUES (${interviewId}, '${reportKey}')`
    );

    return new Response(JSON.stringify(report), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  // ===== BOOKING SLOT HANDLERS =====

  private async handleGetAvailableSlots(url: URL): Promise<Response> {
    try {
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = `SELECT * FROM booking_slots WHERE is_available = 1 AND booked < capacity`;
      const params: any[] = [];

      if (startDate) {
        query += ' AND slot_time >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND slot_time <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY slot_time ASC LIMIT ?';
      params.push(limit);

      const result = await this.env.REHEARSE_DB.prepare(query).bind(...params).all();

      return new Response(JSON.stringify({
        count: result.results.length,
        slots: result.results
      }), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      this.env.logger.error('Failed to get available slots', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response(JSON.stringify({
        error: 'Failed to get available slots',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleSeedBookingSlots(): Promise<Response> {
    try {
      // Generate hourly slots for next 7 days
      const now = new Date();
      const slotsCreated: string[] = [];

      for (let day = 0; day < 7; day++) {
        for (let hour = 9; hour < 18; hour++) { // 9 AM to 6 PM
          const slotDate = new Date(now);
          slotDate.setDate(now.getDate() + day);
          slotDate.setHours(hour, 0, 0, 0);
          const slotTime = slotDate.toISOString().slice(0, 19).replace('T', ' ');

          try {
            await this.env.REHEARSE_DB.prepare(
              `INSERT OR IGNORE INTO booking_slots (slot_time, capacity, booked, is_available)
               VALUES (?, 100, 0, 1)`
            ).bind(slotTime).run();

            slotsCreated.push(slotTime);
          } catch (err) {
            // Slot already exists, skip
            this.env.logger.debug('Slot already exists', { slotTime });
          }
        }
      }

      return new Response(JSON.stringify({
        message: `Created ${slotsCreated.length} booking slots`,
        slots_created: slotsCreated.length
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      this.env.logger.error('Failed to seed booking slots', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response(JSON.stringify({
        error: 'Failed to seed booking slots',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleCancelInterview(interviewId: number): Promise<Response> {
    try {
      // Get interview details
      const interview = await this.env.REHEARSE_DB.prepare(
        'SELECT * FROM interviews WHERE id = ?'
      ).bind(interviewId).first();

      if (!interview) {
        return new Response(JSON.stringify({ error: 'Interview not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      if (interview.status === 'cancelled') {
        return new Response(JSON.stringify({ error: 'Interview already cancelled' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }) as Response;
      }

      // Update interview status
      await this.env.REHEARSE_DB.prepare(
        `UPDATE interviews SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(interviewId).run();

      // Free up booking slot
      if (interview.scheduled_at) {
        await this.env.REHEARSE_DB.prepare(
          `UPDATE booking_slots SET booked = booked - 1, updated_at = CURRENT_TIMESTAMP
           WHERE slot_time = ?`
        ).bind(interview.scheduled_at).run();
      }

      return new Response(JSON.stringify({
        message: 'Interview cancelled successfully',
        interview_id: interviewId
      }), {
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    } catch (error) {
      this.env.logger.error('Failed to cancel interview', {
        error: error instanceof Error ? error.message : String(error)
      });
      return new Response(JSON.stringify({
        error: 'Failed to cancel interview',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }) as Response;
    }
  }

  private async handleAssignPersonas(interviewId: number, request: Request): Promise<Response> {
    const body = await request.json();
    const validated = AssignPersonasSchema.parse(body);

    // Verify interview exists
    const interviewRows = await this.executeSql(
      `SELECT id, num_personas FROM interviews WHERE id = ${interviewId}`
    );

    if (interviewRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }

    // Delete existing persona assignments
    await this.executeSql(
      `DELETE FROM interview_personas WHERE interview_id = ${interviewId}`
    );

    // Insert new persona assignments with turn order
    for (let i = 0; i < validated.persona_ids.length; i++) {
      await this.executeSql(
        `INSERT INTO interview_personas (interview_id, persona_id, turn_order)
         VALUES (${interviewId}, ${validated.persona_ids[i]}, ${i + 1})`
      );
    }

    // Update num_personas on interview
    await this.executeSql(
      `UPDATE interviews SET num_personas = ${validated.persona_ids.length}
       WHERE id = ${interviewId}`
    );

    // Fetch assigned personas with details
    const personaRows = await this.executeSql(
      `SELECT ip.turn_order, p.id, p.name, p.role, p.voice_id, p.voice_name, p.gender, p.questioning_style, p.focus_areas
       FROM interview_personas ip
       JOIN interviewer_personas p ON ip.persona_id = p.id
       WHERE ip.interview_id = ${interviewId}
       ORDER BY ip.turn_order`
    );

    return new Response(JSON.stringify({
      interview_id: interviewId,
      personas: personaRows,
      message: 'Personas assigned successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  }

  private async handleGetSessionAnalytics(sessionId: number): Promise<Response> {
    try {
      this.env.logger.info('[GetSessionAnalytics] Fetching analytics', { sessionId });

      // Get session analytics
      const analyticsRows = await this.executeSql(
        `SELECT * FROM session_analytics WHERE session_id = ${sessionId}`
      );

      if (analyticsRows.length === 0) {
        this.env.logger.warn('[GetSessionAnalytics] No analytics found, checking responses', { sessionId });

        // Check if there are any responses for this session
        const responseRows = await this.executeSql(
          `SELECT id FROM responses WHERE session_id = ${sessionId} LIMIT 1`
        );

        if (responseRows.length === 0) {
          // No responses yet - return empty analytics
          this.env.logger.warn('[GetSessionAnalytics] No responses found', { sessionId });
          return new Response(JSON.stringify({
            session_id: sessionId,
            overall_grade: 0,
            confidence_score: 0,
            clarity_score: 0,
            relevance_score: 0,
            overall_performance: 'No responses recorded yet. Please submit at least one response to see analytics.',
            key_strengths: [],
            key_improvements: [],
            response_count: 0,
            response_breakdown: [],
          }), {
            headers: { 'Content-Type': 'application/json' },
          }) as Response;
        }

        // Responses exist but no analytics - this shouldn't happen but return default
        this.env.logger.error('[GetSessionAnalytics] Responses found but no analytics', { sessionId });
        return new Response(JSON.stringify({
          error: 'Analytics not generated yet',
          message: 'Analytics are being generated. Please try again in a moment.',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

    const analytics = analyticsRows[0];

    // Get all responses for detailed breakdown
    const responseRows = await this.executeSql(
      `SELECT id, question_text, user_response_text, ai_feedback, grade, confidence_score, clarity_score, relevance_score, timestamp
       FROM responses
       WHERE session_id = ${sessionId}
       ORDER BY timestamp ASC`
    );

    // Parse strengths and improvements JSON columns with error handling
    let keyStrengths: string[] = [];
    let keyImprovements: string[] = [];

    try {
      if (analytics.strengths) {
        keyStrengths = typeof analytics.strengths === 'string'
          ? JSON.parse(analytics.strengths)
          : analytics.strengths;
      }
    } catch (error) {
      this.env.logger.warn('[GetSessionAnalytics] Failed to parse strengths', {
        error: error instanceof Error ? error.message : String(error),
        strengths: analytics.strengths,
      });
    }

    try {
      if (analytics.improvements) {
        keyImprovements = typeof analytics.improvements === 'string'
          ? JSON.parse(analytics.improvements)
          : analytics.improvements;
      }
    } catch (error) {
      this.env.logger.warn('[GetSessionAnalytics] Failed to parse improvements', {
        error: error instanceof Error ? error.message : String(error),
        improvements: analytics.improvements,
      });
    }

    // Use stored overall performance or generate based on grade
    let overallPerformance = analytics.overall_performance || 'Session completed';

    // Generate fallback message if not stored
    if (!analytics.overall_performance) {
      const grade = analytics.overall_grade || 0;
      if (grade >= 90) {
        overallPerformance = 'Excellent performance! You demonstrated strong skills across all areas.';
      } else if (grade >= 80) {
        overallPerformance = 'Good performance with room for improvement in some areas.';
      } else if (grade >= 70) {
        overallPerformance = 'Solid effort. Focus on the improvement areas to enhance your skills.';
      } else if (grade >= 60) {
        overallPerformance = 'Fair performance. Continue practicing to build confidence and clarity.';
      } else if (grade > 0) {
        overallPerformance = 'Keep practicing! Review the feedback to improve your interview skills.';
      }
    }

      this.env.logger.info('[GetSessionAnalytics] Returning analytics', {
        sessionId,
        responseCount: responseRows.length,
      });

      // Round all scores to nearest integer for user-friendly display
      const roundedResponseRows = responseRows.map((row: any) => ({
        ...row,
        grade: Math.round(row.grade || 0),
        confidence_score: Math.round(row.confidence_score || 0),
        clarity_score: Math.round(row.clarity_score || 0),
        relevance_score: Math.round(row.relevance_score || 0),
      }));

      return new Response(JSON.stringify({
        session_id: sessionId,
        overall_grade: Math.round(analytics.overall_grade || 0),
        confidence_score: Math.round(analytics.confidence_score || 0),
        clarity_score: Math.round(analytics.clarity_score || 0),
        relevance_score: Math.round(analytics.relevance_score || 0),
        overall_performance: overallPerformance,
        key_strengths: keyStrengths,
        key_improvements: keyImprovements,
        response_count: responseRows.length,
        response_breakdown: roundedResponseRows,
        created_at: analytics.created_at,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[GetSessionAnalytics] Failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return new Response(JSON.stringify({
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  // ============================================================================
  // ADMIN AUTHENTICATION HANDLERS
  // ============================================================================

  /**
   * Handle admin authentication login
   */
  private async handleAdminAuthLogin(): Promise<Response> {
    try {
      // Use a separate admin redirect URI if configured
      const adminRedirectUri = this.env.ADMIN_WORKOS_REDIRECT_URI || this.env.WORKOS_REDIRECT_URI;

      const authService = createWorkOSAuthService({
        apiKey: this.env.WORKOS_API_KEY,
        clientId: this.env.WORKOS_CLIENT_ID,
        redirectUri: adminRedirectUri,
      });

      const authUrl = authService.getAuthorizationUrl('admin');

      return new Response(JSON.stringify({ authUrl }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminAuthLogin] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to generate admin auth URL' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Handle admin authentication callback
   */
  private async handleAdminAuthCallback(request: Request, url: URL): Promise<Response> {
    try {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        return new Response(JSON.stringify({ error: 'Authorization code required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Verify this is an admin login attempt
      if (state !== 'admin') {
        return new Response(JSON.stringify({ error: 'Invalid authentication state' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const adminRedirectUri = this.env.ADMIN_WORKOS_REDIRECT_URI || this.env.WORKOS_REDIRECT_URI;

      const authService = createWorkOSAuthService({
        apiKey: this.env.WORKOS_API_KEY,
        clientId: this.env.WORKOS_CLIENT_ID,
        redirectUri: adminRedirectUri,
      });

      const user = await authService.authenticateWithCode(code);

      // Check if user exists in database and has admin role
      let dbUser = await this.executeSql(
        `SELECT * FROM users WHERE workos_id = '${user.workosId}'`
      );

      if (dbUser.length === 0) {
        // For admin, do not auto-create - require manual setup
        const frontendUrl = `${this.env.ADMIN_FRONTEND_URL || 'http://localhost:5174'}/auth/callback?error=${encodeURIComponent('Admin account not found. Please contact support.')}`;
        return Response.redirect(frontendUrl, 302);
      }

      // TODO: Add role check when roles table is implemented
      // For now, we assume all users with workos_id can access admin
      // In production, check: WHERE workos_id = ? AND role = 'admin'

      // Create session
      const sessionId = await authService.createSession(user.workosId);

      const userData = encodeURIComponent(JSON.stringify(dbUser[0]));
      const frontendUrl = `${this.env.ADMIN_FRONTEND_URL || 'http://localhost:5174'}/auth/callback?sessionId=${sessionId}&user=${userData}`;

      return Response.redirect(frontendUrl, 302);
    } catch (error) {
      this.env.logger.error('[AdminAuthCallback] Failed', { error: error instanceof Error ? error.message : String(error) });

      const frontendUrl = `${this.env.ADMIN_FRONTEND_URL || 'http://localhost:5174'}/auth/callback?error=${encodeURIComponent('Admin authentication failed')}`;
      return Response.redirect(frontendUrl, 302);
    }
  }

  /**
   * Handle admin authentication verification
   */
  private async handleAdminAuthMe(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      const sessionId = authHeader.substring(7);

      const dbUser = await this.executeSql(
        `SELECT id, workos_id, email, name, subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, created_at FROM users WHERE workos_id = '${sessionId}'`
      );

      if (dbUser.length === 0) {
        return new Response(JSON.stringify({ error: 'Admin user not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // TODO: Verify admin role when roles table is implemented

      return new Response(JSON.stringify({ user: dbUser[0] }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminAuthMe] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to verify admin session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  // ============================================================================
  // ADMIN USER MANAGEMENT HANDLERS
  // ============================================================================

  /**
   * Get all users with pagination and filtering
   */
  private async handleAdminGetUsers(url: URL): Promise<Response> {
    try {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const search = url.searchParams.get('search') || '';
      const status = url.searchParams.get('status') || '';
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      if (search) {
        whereClause += ` AND (email LIKE '%${search}%' OR name LIKE '%${search}%')`;
      }
      if (status) {
        whereClause += ` AND subscription_status = '${status}'`;
      }

      // Get users with interview count
      const usersQuery = `
        SELECT
          u.*,
          COUNT(DISTINCT i.id) as interview_count,
          SUM(i.duration_minutes) as total_practice_time,
          MAX(i.created_at) as last_active
        FROM users u
        LEFT JOIN interviews i ON u.id = i.user_id
        ${whereClause}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const users = await this.executeSql(usersQuery);

      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      const countResult = await this.executeSql(countQuery);
      const total = countResult[0]?.total || 0;

      return new Response(JSON.stringify({
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminGetUsers] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Get single user with full details
   */
  private async handleAdminGetUser(userId: number): Promise<Response> {
    try {
      const userQuery = `
        SELECT
          u.*,
          COUNT(DISTINCT i.id) as interview_count,
          SUM(i.duration_minutes) as total_practice_time,
          MAX(i.created_at) as last_active
        FROM users u
        LEFT JOIN interviews i ON u.id = i.user_id
        WHERE u.id = ${userId}
        GROUP BY u.id
      `;

      const users = await this.executeSql(userQuery);

      if (users.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      // Get user's interviews
      const interviews = await this.executeSql(
        `SELECT * FROM interviews WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10`
      );

      return new Response(JSON.stringify({
        user: users[0],
        interviews,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminGetUser] Failed', { userId, error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to fetch user' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Update user subscription
   */
  private async handleAdminUpdateSubscription(userId: number, request: Request): Promise<Response> {
    try {
      const body = await request.json() as { subscription_tier?: string; subscription_status?: string };

      const updates: string[] = [];
      if (body.subscription_tier) {
        updates.push(`subscription_tier = '${body.subscription_tier}'`);
      }
      if (body.subscription_status) {
        updates.push(`subscription_status = '${body.subscription_status}'`);
      }

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No updates provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      await this.executeSql(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ${userId}`
      );

      const updatedUser = await this.executeSql(`SELECT * FROM users WHERE id = ${userId}`);

      return new Response(JSON.stringify({ user: updatedUser[0] }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminUpdateSubscription] Failed', { userId, error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to update subscription' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Delete user (soft delete - mark as deleted)
   */
  private async handleAdminDeleteUser(userId: number): Promise<Response> {
    try {
      // In production, implement soft delete
      // For now, we'll just mark subscription as cancelled
      await this.executeSql(
        `UPDATE users SET subscription_status = 'cancelled' WHERE id = ${userId}`
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminDeleteUser] Failed', { userId, error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to delete user' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  // ============================================================================
  // ADMIN ANALYTICS HANDLERS
  // ============================================================================

  /**
   * Get system statistics
   */
  private async handleAdminGetStats(): Promise<Response> {
    try {
      // Total users
      const totalUsersResult = await this.executeSql('SELECT COUNT(*) as count FROM users');
      const totalUsers = totalUsersResult[0]?.count || 0;

      // Active users (used service in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsersResult = await this.executeSql(
        `SELECT COUNT(DISTINCT user_id) as count FROM interviews WHERE created_at >= '${thirtyDaysAgo.toISOString()}'`
      );
      const activeUsers = activeUsersResult[0]?.count || 0;

      // Total interviews
      const totalInterviewsResult = await this.executeSql('SELECT COUNT(*) as count FROM interviews');
      const totalInterviews = totalInterviewsResult[0]?.count || 0;

      // Total practice hours
      const totalHoursResult = await this.executeSql('SELECT SUM(duration_minutes) as total FROM interviews');
      const totalMinutes = totalHoursResult[0]?.total || 0;
      const totalPracticeHours = Math.round(totalMinutes / 60);

      // MRR calculation (simplified - assumes all Pro users)
      const paidUsersResult = await this.executeSql(
        `SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active' AND subscription_tier IN ('pro', 'enterprise')`
      );
      const paidUsers = paidUsersResult[0]?.count || 0;
      const mrr = paidUsers * 29; // Assuming $29/month for Pro

      // Conversion rate (paid / total)
      const conversionRate = totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0;

      // Churn rate calculation (cancelled in last 30 days / active at start of period)
      const churnedResult = await this.executeSql(
        `SELECT COUNT(*) as count FROM users WHERE subscription_status = 'cancelled'`
      );
      const churned = churnedResult[0]?.count || 0;
      const churnRate = paidUsers > 0 ? Math.round((churned / (paidUsers + churned)) * 100) : 0;

      return new Response(JSON.stringify({
        total_users: totalUsers,
        active_users: activeUsers,
        total_interviews: totalInterviews,
        total_practice_hours: totalPracticeHours,
        mrr,
        conversion_rate: conversionRate,
        churn_rate: churnRate,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminGetStats] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Get user activity log
   */
  private async handleAdminGetActivity(url: URL): Promise<Response> {
    try {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const userId = url.searchParams.get('user_id');
      const activityType = url.searchParams.get('activity_type');
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      if (userId) {
        whereClause += ` AND i.user_id = ${userId}`;
      }
      if (activityType) {
        whereClause += ` AND i.status = '${activityType}'`;
      }

      const activitiesQuery = `
        SELECT
          i.id,
          i.user_id,
          u.email as user_email,
          u.name as user_name,
          i.status as activity_type,
          i.created_at as activity_date,
          json_object(
            'interview_id', i.id,
            'mode', i.mode,
            'duration', i.duration_minutes
          ) as details
        FROM interviews i
        JOIN users u ON i.user_id = u.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const activities = await this.executeSql(activitiesQuery);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM interviews i
        JOIN users u ON i.user_id = u.id
        ${whereClause}
      `;
      const countResult = await this.executeSql(countQuery);
      const total = countResult[0]?.total || 0;

      return new Response(JSON.stringify({
        activities,
        total,
        page,
        limit,
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminGetActivity] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to fetch activity' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Get revenue analytics
   */
  private async handleAdminGetRevenue(url: URL): Promise<Response> {
    try {
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      // For now, return placeholder data
      // In production, integrate with Stripe API for actual revenue data
      const dailyRevenue: any[] = [];
      const monthlyRevenue: any[] = [];

      return new Response(JSON.stringify({
        daily_revenue: dailyRevenue,
        monthly_revenue: monthlyRevenue,
        message: 'Revenue analytics will be integrated with Stripe in production',
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminGetRevenue] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to fetch revenue data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  // ============================================================================
  // ADMIN PERSONA MANAGEMENT HANDLERS
  // ============================================================================

  /**
   * Create new persona
   */
  private async handleAdminCreatePersona(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        name: string;
        role: string;
        voice_id: string;
        voice_name: string;
        gender: string;
        questioning_style: string;
        focus_areas: string[];
      };

      const focusAreasJson = JSON.stringify(body.focus_areas);

      const result = await this.executeSql(
        `INSERT INTO personas (name, role, voice_id, voice_name, gender, questioning_style, focus_areas)
         VALUES ('${body.name}', '${body.role}', '${body.voice_id}', '${body.voice_name}', '${body.gender}', '${body.questioning_style}', '${focusAreasJson}')`
      );

      const newPersona = await this.executeSql(
        `SELECT * FROM personas WHERE id = last_insert_rowid()`
      );

      return new Response(JSON.stringify({ persona: newPersona[0] }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminCreatePersona] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to create persona' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Update persona
   */
  private async handleAdminUpdatePersona(personaId: number, request: Request): Promise<Response> {
    try {
      const body = await request.json() as Partial<{
        name: string;
        role: string;
        voice_id: string;
        voice_name: string;
        gender: string;
        questioning_style: string;
        focus_areas: string[];
      }>;

      const updates: string[] = [];
      if (body.name) updates.push(`name = '${body.name}'`);
      if (body.role) updates.push(`role = '${body.role}'`);
      if (body.voice_id) updates.push(`voice_id = '${body.voice_id}'`);
      if (body.voice_name) updates.push(`voice_name = '${body.voice_name}'`);
      if (body.gender) updates.push(`gender = '${body.gender}'`);
      if (body.questioning_style) updates.push(`questioning_style = '${body.questioning_style}'`);
      if (body.focus_areas) updates.push(`focus_areas = '${JSON.stringify(body.focus_areas)}'`);

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No updates provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }) as Response;
      }

      await this.executeSql(
        `UPDATE personas SET ${updates.join(', ')} WHERE id = ${personaId}`
      );

      const updatedPersona = await this.executeSql(`SELECT * FROM personas WHERE id = ${personaId}`);

      return new Response(JSON.stringify({ persona: updatedPersona[0] }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminUpdatePersona] Failed', { personaId, error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to update persona' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Delete persona
   */
  private async handleAdminDeletePersona(personaId: number): Promise<Response> {
    try {
      await this.executeSql(`DELETE FROM personas WHERE id = ${personaId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminDeletePersona] Failed', { personaId, error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to delete persona' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  // ============================================================================
  // ADMIN SYSTEM MANAGEMENT HANDLERS
  // ============================================================================

  /**
   * Get system health
   */
  private async handleAdminSystemHealth(): Promise<Response> {
    try {
      // Test database connection
      const dbTest = await this.executeSql('SELECT 1 as test');
      const dbHealthy = dbTest.length > 0 && dbTest[0].test === 1;

      return new Response(JSON.stringify({
        status: dbHealthy ? 'healthy' : 'degraded',
        uptime: 0, // Cloudflare Workers don't have a traditional uptime metric
        memory: {
          used: 0,
          total: 0,
        },
        database: {
          connected: dbHealthy,
          responseTime: 0,
        },
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminSystemHealth] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }

  /**
   * Get system logs (placeholder - integrate with your logging system)
   */
  private async handleAdminGetLogs(url: URL): Promise<Response> {
    try {
      const level = url.searchParams.get('level') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // This is a placeholder - integrate with your actual logging system
      // For Cloudflare Workers, you might want to use:
      // - Logpush to send logs to external storage
      // - Workers Analytics Engine
      // - External logging service like Sentry or Datadog

      return new Response(JSON.stringify({
        logs: [],
        message: 'Log integration pending - use Cloudflare Dashboard for now',
      }), {
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    } catch (error) {
      this.env.logger.error('[AdminGetLogs] Failed', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Failed to fetch logs' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }) as Response;
    }
  }
}