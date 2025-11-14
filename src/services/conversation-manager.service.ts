/**
 * Conversation Manager Service
 * Manages conversational flow, follow-ups, and natural interview dialogue
 */

import { createCerebrasService } from './cerebras-ai.service';

export interface ConversationTurn {
  speaker: 'interviewer' | 'candidate';
  personaName?: string;
  text: string;
  turnType: 'greeting' | 'question' | 'response' | 'followup' | 'transition' | 'acknowledgment' | 'closing';
  timestamp: Date;
}

export interface ConversationalContext {
  turns: ConversationTurn[];
  lastCandidateResponse?: string;
  lastQuestion?: string;
  interviewStage: 'opening' | 'main' | 'closing';
  questionCount: number;
}

export interface ConversationalResponse {
  text: string;
  turnType: 'greeting' | 'question' | 'followup' | 'transition' | 'acknowledgment' | 'closing';
  shouldWaitForResponse: boolean;
  audioData?: ArrayBuffer;
}

export class ConversationManagerService {
  private cerebrasApiKey: string;

  constructor(cerebrasApiKey: string) {
    this.cerebrasApiKey = cerebrasApiKey;
  }

  /**
   * Generate opening greeting and ice breaker
   */
  async generateOpening(
    personaName: string,
    personaRole: string,
    allPersonas: Array<{ name: string; role: string }>,
    candidateName?: string,
    questioningStyle: string = 'friendly',
    position?: string
  ): Promise<ConversationalResponse> {
    const cerebras = createCerebrasService(this.cerebrasApiKey);

    // Build list of other interviewers
    const otherInterviewers = allPersonas
      .filter(p => p.name !== personaName)
      .map(p => `${p.name}, ${p.role}`)
      .join(' and ');

    const prompt = `You are ${personaName}, a ${personaRole}, starting an interview. Say your greeting directly as if you're speaking to the candidate right now.

Example format: "Hi, I'm Sarah, the Tech Lead. Thanks for joining us today. I'm joined by Mike, our Senior Developer${otherInterviewers ? `, and ${otherInterviewers}` : ''}. We'll be interviewing you for the Software Engineer position. Let's get started."

Now generate YOUR greeting as ${personaName}, ${personaRole}:
- Greet the candidate warmly
- Introduce yourself
- Mention the other interviewers: ${otherInterviewers || 'none'}
${position ? `- Mention the position: ${position}` : ''}
- End with "Let's get started" or similar

Speak directly as the interviewer. Return ONLY your spoken greeting (2-3 sentences).`;

    const greeting = await cerebras.generateSimpleQuestion({
      personaName,
      personaRole,
      questioningStyle,
      focusAreas: [],
      previousQuestions: [],
      documentContext: prompt,
    });

    // Clean up any meta-commentary
    const cleanedGreeting = greeting
      .replace(/^(Here is |Here's |This is ).*/i, '')
      .replace(/^"(.+)"$/, '$1')
      .trim();

    // Add opening question based on number of interviewers
    const hasMultipleInterviewers = allPersonas.length > 1;
    const openingQuestion = hasMultipleInterviewers
      ? "Tell us about yourself."
      : "Tell me about yourself.";

    const fullOpening = `${cleanedGreeting} ${openingQuestion}`;

    return {
      text: fullOpening,
      turnType: 'greeting',
      shouldWaitForResponse: true, // Changed to true so we wait for response
    };
  }

  /**
   * Generate acknowledgment of candidate's response
   */
  async generateAcknowledgment(
    personaName: string,
    personaRole: string,
    questionAsked: string,
    candidateResponse: string,
    questioningStyle: string
  ): Promise<ConversationalResponse> {
    const cerebras = createCerebrasService(this.cerebrasApiKey);

    const acknowledgment = await cerebras.generateLiveFeedback(
      questionAsked,
      `You are ${personaName}, a ${personaRole} (${questioningStyle} style).

      The candidate just answered: "${candidateResponse}"

      Generate a brief, natural acknowledgment (1-2 sentences) that:
      1. Shows you listened and understood
      2. Provides a quick positive reaction
      3. Feels conversational (not robotic)

      Examples of natural acknowledgments:
      - "That's interesting, I like how you approached that."
      - "Great, thanks for sharing that perspective."
      - "I appreciate the detail you went into there."

      Return ONLY the acknowledgment text.`
    );

    return {
      text: acknowledgment,
      turnType: 'acknowledgment',
      shouldWaitForResponse: false,
    };
  }

  /**
   * Decide if a follow-up question is needed based on response
   */
  async shouldAskFollowUp(
    questionAsked: string,
    candidateResponse: string,
    questioningStyle: string
  ): Promise<{
    shouldFollowUp: boolean;
    reason?: string;
  }> {
    // Simple heuristics for now
    const responseLength = candidateResponse.split(' ').length;

    // Very short responses might need follow-up
    if (responseLength < 15) {
      return {
        shouldFollowUp: true,
        reason: 'response_too_brief',
      };
    }

    // Tough questioning style follows up more frequently
    if (questioningStyle === 'tough' && Math.random() > 0.5) {
      return {
        shouldFollowUp: true,
        reason: 'probing_deeper',
      };
    }

    // Interesting keywords might warrant follow-up
    const interestingKeywords = ['challenge', 'difficult', 'problem', 'solution', 'team', 'conflict'];
    const hasInterestingContent = interestingKeywords.some(keyword =>
      candidateResponse.toLowerCase().includes(keyword)
    );

    if (hasInterestingContent && Math.random() > 0.6) {
      return {
        shouldFollowUp: true,
        reason: 'interesting_content',
      };
    }

    return { shouldFollowUp: false };
  }

  /**
   * Generate a natural follow-up question
   */
  async generateFollowUp(
    personaName: string,
    personaRole: string,
    originalQuestion: string,
    candidateResponse: string,
    questioningStyle: string,
    followUpReason: string
  ): Promise<ConversationalResponse> {
    const cerebras = createCerebrasService(this.cerebrasApiKey);

    let prompt = `You are ${personaName}, a ${personaRole} (${questioningStyle} style).

Original question: "${originalQuestion}"
Candidate's response: "${candidateResponse}"

Reason for follow-up: ${followUpReason}

Generate ONE natural follow-up question that:`;

    if (followUpReason === 'response_too_brief') {
      prompt += `
1. Encourages the candidate to elaborate
2. Shows genuine interest
3. Asks for specific examples or details
4. Feels supportive, not interrogating`;
    } else if (followUpReason === 'probing_deeper') {
      prompt += `
1. Probes deeper into their answer
2. Challenges them to think more critically
3. Asks about edge cases or complications
4. Maintains professional but assertive tone`;
    } else {
      prompt += `
1. Builds on an interesting point they mentioned
2. Shows you were listening carefully
3. Explores that topic further
4. Feels like a natural conversation`;
    }

    prompt += '\n\nReturn ONLY the follow-up question text (1-2 sentences).';

    const followUp = await cerebras.generateLiveFeedback(originalQuestion, prompt);

    return {
      text: followUp,
      turnType: 'followup',
      shouldWaitForResponse: true,
    };
  }

  /**
   * Generate smooth transition between topics/personas
   */
  async generateTransition(
    fromPersona: string,
    toPersona: string,
    toPersonaRole: string,
    previousTopic: string,
    nextTopic: string
  ): Promise<ConversationalResponse> {
    const cerebras = createCerebrasService(this.cerebrasApiKey);

    const transition = await cerebras.generateLiveFeedback(
      `Transitioning from ${previousTopic} to ${nextTopic}`,
      `You are ${toPersona}, a ${toPersonaRole}.

      ${fromPersona} just finished asking about ${previousTopic}.
      You're now going to ask about ${nextTopic}.

      Generate a smooth 1-2 sentence transition that:
      1. Acknowledges the previous discussion
      2. Introduces the next topic naturally
      3. Feels like a conversation, not an interrogation

      Example: "Thanks for those insights. Now I'd like to shift gears and talk about..."

      Return ONLY the transition text.`
    );

    return {
      text: transition,
      turnType: 'transition',
      shouldWaitForResponse: false,
    };
  }

  /**
   * Generate interview closing
   */
  async generateClosing(
    personaName: string,
    personaRole: string,
    questioningStyle: string,
    companyName?: string,
    candidateName?: string
  ): Promise<ConversationalResponse> {
    const cerebras = createCerebrasService(this.cerebrasApiKey);

    const prompt = `You are ${personaName}, a ${personaRole}, ending an interview. Say your closing remarks directly as if you're speaking to the candidate right now.

Example format: "Thank you for taking the time to interview with us today. We appreciate your interest in our company. We'll be getting back to you soon with the outcome of your interview and next steps. Have a great day!"

Now generate YOUR closing as ${personaName}, ${personaRole}:
- Thank the candidate for their time
- Mention you'll get back to them with results and next steps
- Wish them well
- Keep it professional and warm

Speak directly as the interviewer. Return ONLY your spoken closing (2-3 sentences).`;

    const closing = await cerebras.generateSimpleQuestion({
      personaName,
      personaRole,
      questioningStyle,
      focusAreas: [],
      previousQuestions: [],
      documentContext: prompt,
    });

    // Clean up any meta-commentary
    const cleanedClosing = closing
      .replace(/^(Here is |Here's |This is ).*/i, '')
      .replace(/^"(.+)"$/, '$1')
      .trim();

    return {
      text: cleanedClosing,
      turnType: 'closing',
      shouldWaitForResponse: false,
    };
  }

  /**
   * Determine interview stage based on progress
   */
  determineStage(
    questionCount: number,
    maxQuestions: number,
    elapsedMinutes: number,
    totalMinutes: number
  ): 'opening' | 'main' | 'closing' {
    if (questionCount === 0) {
      return 'opening';
    }

    // If we're in the last 2 questions or last 2 minutes
    const questionsRemaining = maxQuestions - questionCount;
    const minutesRemaining = totalMinutes - elapsedMinutes;

    if (questionsRemaining <= 2 || minutesRemaining <= 2) {
      return 'closing';
    }

    return 'main';
  }

  /**
   * Build conversational context from session history
   */
  buildContext(conversationHistory: Array<{
    speaker: string;
    text: string;
    timestamp: Date;
  }>): ConversationalContext {
    const turns: ConversationTurn[] = conversationHistory.map(entry => ({
      speaker: entry.speaker === 'Candidate' ? 'candidate' : 'interviewer',
      personaName: entry.speaker !== 'Candidate' ? entry.speaker : undefined,
      text: entry.text,
      turnType: this.inferTurnType(entry.text),
      timestamp: entry.timestamp,
    }));

    const candidateTurns = turns.filter(t => t.speaker === 'candidate');
    const questionTurns = turns.filter(t => t.turnType === 'question' || t.turnType === 'followup');

    return {
      turns,
      lastCandidateResponse: candidateTurns[candidateTurns.length - 1]?.text,
      lastQuestion: questionTurns[questionTurns.length - 1]?.text,
      interviewStage: turns.length < 3 ? 'opening' : 'main',
      questionCount: questionTurns.length,
    };
  }

  /**
   * Infer turn type from text (simple heuristic)
   */
  private inferTurnType(text: string): ConversationTurn['turnType'] {
    const lower = text.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi ') || lower.includes('welcome')) {
      return 'greeting';
    }
    if (text.endsWith('?')) {
      return lower.includes('can you') || lower.includes('could you')
        ? 'followup'
        : 'question';
    }
    if (lower.includes('thank') || lower.includes('great') || lower.includes('interesting')) {
      return 'acknowledgment';
    }
    if (lower.includes('shift') || lower.includes('move on') || lower.includes('next')) {
      return 'transition';
    }
    if (lower.includes('thank you') && lower.includes('time')) {
      return 'closing';
    }

    return 'response';
  }

  /**
   * Generate complete conversational turn (orchestrates the flow)
   */
  async generateConversationalTurn(
    context: ConversationalContext,
    personaName: string,
    personaRole: string,
    questioningStyle: string,
    focusAreas: string[],
    stage: 'opening' | 'main' | 'closing',
    allPersonas?: Array<{ name: string; role: string }>,
    position?: string
  ): Promise<{
    mainTurn: ConversationalResponse;
    acknowledgment?: ConversationalResponse;
    followUp?: ConversationalResponse;
  }> {
    const result: {
      mainTurn: ConversationalResponse;
      acknowledgment?: ConversationalResponse;
      followUp?: ConversationalResponse;
    } = {
      mainTurn: { text: '', turnType: 'question', shouldWaitForResponse: true },
    };

    // Opening stage
    if (stage === 'opening' && context.questionCount === 0) {
      result.mainTurn = await this.generateOpening(
        personaName,
        personaRole,
        allPersonas || [{ name: personaName, role: personaRole }],
        undefined,
        questioningStyle,
        position
      );
      return result;
    }

    // Main interview - check if we need acknowledgment
    if (context.lastCandidateResponse && context.lastQuestion) {
      // Generate acknowledgment
      result.acknowledgment = await this.generateAcknowledgment(
        personaName,
        personaRole,
        context.lastQuestion,
        context.lastCandidateResponse,
        questioningStyle
      );

      // Check if follow-up is needed
      const followUpDecision = await this.shouldAskFollowUp(
        context.lastQuestion,
        context.lastCandidateResponse,
        questioningStyle
      );

      if (followUpDecision.shouldFollowUp && followUpDecision.reason) {
        result.followUp = await this.generateFollowUp(
          personaName,
          personaRole,
          context.lastQuestion,
          context.lastCandidateResponse,
          questioningStyle,
          followUpDecision.reason
        );
      }
    }

    // Closing stage
    if (stage === 'closing') {
      result.mainTurn = await this.generateClosing(personaName, personaRole, questioningStyle);
      return result;
    }

    return result;
  }
}

/**
 * Factory function
 */
export function createConversationManager(cerebrasApiKey: string): ConversationManagerService {
  return new ConversationManagerService(cerebrasApiKey);
}
