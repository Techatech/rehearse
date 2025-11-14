/**
 * Interview Orchestrator Service
 * Manages interview session flow, persona turn-taking, and conversation state
 */

import { createCerebrasService } from './cerebras-ai.service';
import { createElevenLabsService } from './elevenlabs.service';
import { createConversationManager } from './conversation-manager.service';

export interface InterviewPersona {
  id: number;
  name: string;
  role: string;
  voiceId: string;
  voiceName: string;
  gender: string;
  questioningStyle: string; // friendly, tough, neutral
  focusAreas: string[];
}

export interface InterviewConfig {
  interviewId: number;
  userId: number;
  documentContext?: string;
  scenarioType: string; // interview, meeting, presentation
  scenarioDescription?: string;
  personas: InterviewPersona[];
  durationMinutes: number;
  mode: 'practice' | 'graded';
}

export interface QuestionGenerationContext {
  persona: InterviewPersona;
  conversationHistory: string[];
  documentContext?: string;
  scenarioType: string;
  previousQuestions: string[];
  userResponses: string[];
}

export interface GeneratedQuestion {
  questionText: string;
  category: string;
  persona: InterviewPersona;
  audioData?: ArrayBuffer;
  questionNumber: number;
}

export interface SessionState {
  interviewId: number;
  sessionId: number;
  memorySessionId: string;
  currentPersonaIndex: number;
  questionCount: number;
  startTime: Date;
  conversationHistory: Array<{
    speaker: string;
    text: string;
    timestamp: Date;
  }>;
  questionsAsked: string[];
  userResponses: string[];
}

export class InterviewOrchestratorService {
  private cerebrasApiKey: string;
  private elevenLabsApiKey?: string;

  constructor(cerebrasApiKey: string, elevenLabsApiKey?: string) {
    this.cerebrasApiKey = cerebrasApiKey;
    this.elevenLabsApiKey = elevenLabsApiKey;
  }

  /**
   * Initialize a new interview session
   */
  async initializeSession(config: InterviewConfig, memorySessionId: string): Promise<SessionState> {
    return {
      interviewId: config.interviewId,
      sessionId: 0, // Will be set after DB insert
      memorySessionId,
      currentPersonaIndex: 0,
      questionCount: 0,
      startTime: new Date(),
      conversationHistory: [],
      questionsAsked: [],
      userResponses: [],
    };
  }

  /**
   * Generate next conversational turn (includes acknowledgments, follow-ups, questions)
   */
  async generateConversationalTurn(
    config: InterviewConfig,
    state: SessionState
  ): Promise<{
    acknowledgment?: string;
    question: GeneratedQuestion;
    isFollowUp: boolean;
  }> {
    const conversationManager = createConversationManager(this.cerebrasApiKey);

    // Get current persona
    const persona = config.personas[state.currentPersonaIndex % config.personas.length];
    if (!persona) {
      throw new Error('No persona available');
    }

    // Build conversational context
    const context = conversationManager.buildContext(state.conversationHistory);

    // Determine stage
    const maxQuestions = Math.ceil(config.durationMinutes / 2);
    const elapsedMinutes = (new Date().getTime() - state.startTime.getTime()) / 60000;
    const stage = conversationManager.determineStage(
      state.questionCount,
      maxQuestions,
      elapsedMinutes,
      config.durationMinutes
    );

    // Prepare all personas for greeting introduction
    const allPersonas = config.personas.map(p => ({
      name: p.name,
      role: p.role,
    }));

    // Generate conversational turn
    const turn = await conversationManager.generateConversationalTurn(
      context,
      persona.name,
      persona.role,
      persona.questioningStyle,
      persona.focusAreas,
      stage,
      allPersonas,
      config.scenarioDescription || 'this position' // Use scenario description as position
    );

    // Determine what to say based on stage and turn content
    let questionText: string;
    let isFollowUp = false;

    // Opening stage - use greeting
    if (stage === 'opening' && turn.mainTurn && turn.mainTurn.turnType === 'greeting') {
      questionText = turn.mainTurn.text;
      isFollowUp = false;
    }
    // Closing stage - use closing remarks
    else if (stage === 'closing' && turn.mainTurn && turn.mainTurn.turnType === 'closing') {
      questionText = turn.mainTurn.text;
      isFollowUp = false;
    }
    // Main stage - check for follow-up first
    else if (turn.followUp) {
      questionText = turn.followUp.text;
      isFollowUp = true;
    }
    // Default - generate new main question
    else {
      questionText = await this.generateMainQuestion(config, state, persona);
    }

    // Generate voice audio if available
    let audioData: ArrayBuffer | undefined;
    if (this.elevenLabsApiKey && persona.voiceId) {
      try {
        console.log('[InterviewOrchestrator] Generating audio:', {
          personaName: persona.name,
          voiceId: persona.voiceId,
          hasApiKey: !!this.elevenLabsApiKey,
          apiKeyLength: this.elevenLabsApiKey?.length,
        });

        const elevenlabs = createElevenLabsService(this.elevenLabsApiKey);

        // Combine acknowledgment and question for more natural audio
        const fullText = turn.acknowledgment
          ? `${turn.acknowledgment.text} ${questionText}`
          : questionText;

        const voiceResult = await elevenlabs.generateSpeech({
          text: fullText,
          voiceId: persona.voiceId,
          stability: persona.questioningStyle === 'tough' ? 0.6 : 0.5,
          similarityBoost: 0.75,
        });
        audioData = voiceResult.audioData;

        console.log('[InterviewOrchestrator] Audio generated successfully:', {
          audioSize: audioData?.byteLength || 0,
        });
      } catch (error) {
        console.error('[InterviewOrchestrator] Voice generation failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          personaName: persona.name,
          voiceId: persona.voiceId,
        });
      }
    } else {
      console.log('[InterviewOrchestrator] Skipping audio generation:', {
        hasApiKey: !!this.elevenLabsApiKey,
        hasVoiceId: !!persona.voiceId,
        personaName: persona.name,
      });
    }

    const category = this.categorizeQuestion(questionText, persona.focusAreas);

    return {
      acknowledgment: turn.acknowledgment?.text,
      question: {
        questionText,
        category,
        persona,
        audioData,
        questionNumber: state.questionCount + 1,
      },
      isFollowUp,
    };
  }

  /**
   * Generate main question (non-follow-up)
   */
  private async generateMainQuestion(
    config: InterviewConfig,
    state: SessionState,
    persona: InterviewPersona
  ): Promise<string> {
    const cerebras = createCerebrasService(this.cerebrasApiKey);

    return await cerebras.generateSimpleQuestion({
      personaName: persona.name,
      personaRole: persona.role,
      questioningStyle: persona.questioningStyle,
      focusAreas: persona.focusAreas,
      previousQuestions: state.questionsAsked,
      documentContext: config.documentContext,
    });
  }

  /**
   * Generate next question based on conversation context (backward compatible)
   */
  async generateQuestion(
    config: InterviewConfig,
    state: SessionState
  ): Promise<GeneratedQuestion> {
    const result = await this.generateConversationalTurn(config, state);
    return result.question;
  }

  /**
   * Process user response and provide feedback (for graded mode)
   */
  async evaluateResponse(
    config: InterviewConfig,
    question: string,
    response: string,
    persona: InterviewPersona
  ): Promise<{
    feedback: string;
    grade: number;
    strengths: string[];
    improvements: string[];
  }> {
    if (config.mode === 'practice') {
      return {
        feedback: 'Response recorded (practice mode)',
        grade: 0,
        strengths: [],
        improvements: [],
      };
    }

    const cerebras = createCerebrasService(this.cerebrasApiKey);

    const result = await cerebras.gradeResponse({
      question,
      response,
      expected_areas: persona.focusAreas,
      question_category: persona.focusAreas[0] || 'general',
    });

    return {
      feedback: result.detailed_feedback,
      grade: result.overall_grade,
      strengths: result.strengths,
      improvements: result.improvements,
    };
  }

  /**
   * Update session state after question/response cycle
   */
  updateSessionState(
    state: SessionState,
    question: GeneratedQuestion,
    userResponse?: string
  ): SessionState {
    const updatedState = { ...state };

    // Add question to history
    updatedState.conversationHistory.push({
      speaker: `${question.persona.name} (${question.persona.role})`,
      text: question.questionText,
      timestamp: new Date(),
    });

    updatedState.questionsAsked.push(question.questionText);

    // Add user response if provided
    if (userResponse) {
      updatedState.conversationHistory.push({
        speaker: 'Candidate',
        text: userResponse,
        timestamp: new Date(),
      });
      updatedState.userResponses.push(userResponse);
    }

    // Move to next persona
    updatedState.currentPersonaIndex++;
    updatedState.questionCount++;

    return updatedState;
  }

  /**
   * Check if session should end
   */
  shouldEndSession(state: SessionState, config: InterviewConfig): boolean {
    const elapsedMinutes = (new Date().getTime() - state.startTime.getTime()) / 60000;

    // End if time limit reached
    if (elapsedMinutes >= config.durationMinutes) {
      return true;
    }

    // End if maximum questions reached (roughly 2-3 min per question)
    const maxQuestions = Math.ceil(config.durationMinutes / 2);
    if (state.questionCount >= maxQuestions) {
      return true;
    }

    return false;
  }

  /**
   * Generate session summary
   */
  async generateSessionSummary(
    config: InterviewConfig,
    state: SessionState,
    grades: number[]
  ): Promise<{
    overallGrade: number;
    strengths: string[];
    improvements: string[];
    summary: string;
  }> {
    if (config.mode === 'practice') {
      return {
        overallGrade: 0,
        strengths: [],
        improvements: [],
        summary: 'Practice session completed',
      };
    }

    const cerebras = createCerebrasService(this.cerebrasApiKey);

    const avgGrade = grades.length > 0
      ? grades.reduce((a, b) => a + b, 0) / grades.length
      : 0;

    const result = await cerebras.generateSessionSummary(
      state.questionsAsked,
      state.userResponses,
      [] // We don't have full GradingResult objects, so pass empty array
    );

    return {
      overallGrade: avgGrade,
      strengths: result.key_strengths,
      improvements: result.key_improvements,
      summary: result.overall_performance,
    };
  }

  // Private helper methods

  private buildQuestionContext(
    config: InterviewConfig,
    state: SessionState,
    persona: InterviewPersona
  ): QuestionGenerationContext {
    return {
      persona,
      conversationHistory: state.conversationHistory.map(
        entry => `${entry.speaker}: ${entry.text}`
      ),
      documentContext: config.documentContext,
      scenarioType: config.scenarioType,
      previousQuestions: state.questionsAsked,
      userResponses: state.userResponses,
    };
  }

  private buildQuestionPrompt(
    persona: InterviewPersona,
    config: InterviewConfig,
    context: QuestionGenerationContext
  ): string {
    let prompt = `You are ${persona.name}, a ${persona.role} conducting a ${config.scenarioType}.

Your questioning style is ${persona.questioningStyle}.
Your focus areas are: ${persona.focusAreas.join(', ')}.

Generate ONE interview question that:
1. Is relevant to your role and focus areas
2. Matches your questioning style (${persona.questioningStyle})
3. Doesn't repeat previous questions
4. Is clear and conversational
5. Takes 30-60 seconds to answer`;

    if (context.documentContext) {
      prompt += `\n\nCandidate background: ${context.documentContext.substring(0, 300)}`;
    }

    if (context.previousQuestions.length > 0) {
      prompt += `\n\nPrevious questions (don't repeat): ${context.previousQuestions.slice(-2).join(', ')}`;
    }

    prompt += '\n\nReturn ONLY the question text.';

    return prompt;
  }

  private buildSystemPrompt(persona: InterviewPersona, config: InterviewConfig): string {
    return `You are ${persona.name}, a ${persona.role} conducting a ${config.scenarioType}.

Your questioning style is ${persona.questioningStyle}.
Your focus areas are: ${persona.focusAreas.join(', ')}.

Generate ONE interview question that:
1. Is relevant to your role and focus areas
2. Matches your questioning style (${persona.questioningStyle})
3. Doesn't repeat previous questions
4. Is clear and conversational
5. Takes 30-60 seconds to answer

Return ONLY the question text, no preamble or explanation.`;
  }

  private buildUserPrompt(context: QuestionGenerationContext): string {
    let prompt = `Generate the next interview question.

Scenario: ${context.scenarioType}`;

    if (context.documentContext) {
      prompt += `\n\nCandidate's Background:\n${context.documentContext.substring(0, 500)}`;
    }

    if (context.previousQuestions.length > 0) {
      prompt += `\n\nPrevious questions asked:\n${context.previousQuestions.slice(-3).join('\n')}`;
    }

    if (context.userResponses.length > 0) {
      prompt += `\n\nRecent responses:\n${context.userResponses.slice(-2).join('\n')}`;
    }

    prompt += '\n\nGenerate your question:';

    return prompt;
  }

  private categorizeQuestion(questionText: string, focusAreas: string[]): string {
    const lowerQuestion = questionText.toLowerCase();

    for (const area of focusAreas) {
      if (lowerQuestion.includes(area.toLowerCase())) {
        return area;
      }
    }

    // Fallback categorization
    if (lowerQuestion.includes('team') || lowerQuestion.includes('collaboration')) {
      return 'behavioral';
    }
    if (lowerQuestion.includes('code') || lowerQuestion.includes('technical')) {
      return 'technical';
    }
    if (lowerQuestion.includes('project') || lowerQuestion.includes('experience')) {
      return 'experience';
    }

    return 'general';
  }
}

/**
 * Factory function
 */
export function createInterviewOrchestrator(
  cerebrasApiKey: string,
  elevenLabsApiKey?: string
): InterviewOrchestratorService {
  return new InterviewOrchestratorService(cerebrasApiKey, elevenLabsApiKey);
}
