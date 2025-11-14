import Cerebras from '@cerebras/cerebras_cloud_sdk';

interface DocumentAnalysisResult {
  skills: string[];
  responsibilities: string[];
  requirements: string[];
  company_info?: string;
  role_level?: string;
  question_categories: {
    technical: string[];
    behavioral: string[];
    scenario_based: string[];
  };
}

interface QuestionGenerationParams {
  analysis: DocumentAnalysisResult;
  persona_role: string;
  persona_style: string;
  focus_areas: string[];
  previous_questions?: string[];
  previous_responses?: string[];
}

interface ResponseGradingParams {
  question: string;
  response: string;
  expected_areas: string[];
  question_category: string;
}

interface GradingResult {
  overall_grade: number; // 0-100
  confidence_score: number; // 0-100
  clarity_score: number; // 0-100
  relevance_score: number; // 0-100
  strengths: string[];
  improvements: string[];
  detailed_feedback: string;
  suggestions: string[];
}

export class CerebrasAIService {
  private client: Cerebras;
  private model = 'llama-3.3-70b';

  constructor(apiKey: string) {
    this.client = new Cerebras({ apiKey });
  }

  /**
   * Analyze uploaded document to extract key information
   */
  async analyzeDocument(content: string, fileType: string): Promise<DocumentAnalysisResult> {
    const prompt = `You are an expert document analyzer for interview preparation. Analyze the following ${fileType} document and extract:

1. Key skills and technologies mentioned
2. Main responsibilities
3. Requirements and qualifications
4. Company information (if available)
5. Role level (entry, mid, senior, executive)

Then, generate relevant question categories:
- Technical questions (specific to skills/tech mentioned)
- Behavioral questions (based on responsibilities)
- Scenario-based questions (real-world situations)

Document content:
${content}

Return ONLY a JSON object with this exact structure:
{
  "skills": ["skill1", "skill2"],
  "responsibilities": ["resp1", "resp2"],
  "requirements": ["req1", "req2"],
  "company_info": "company info",
  "role_level": "senior",
  "question_categories": {
    "technical": ["suggested topics"],
    "behavioral": ["suggested topics"],
    "scenario_based": ["suggested topics"]
  }
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        max_completion_tokens: 2048,
        temperature: 0.3, // Lower for more consistent extraction
        top_p: 1,
      });

      const choices = completion.choices as any[];
      const responseText = choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback if parsing fails
      return {
        skills: [],
        responsibilities: [],
        requirements: [],
        question_categories: {
          technical: [],
          behavioral: [],
          scenario_based: [],
        },
      };
    } catch (error) {
      console.error('Document analysis failed:', error);
      throw new Error('Failed to analyze document');
    }
  }

  /**
   * Generate interview question based on context
   */
  async generateQuestion(params: QuestionGenerationParams): Promise<string> {
    const { analysis, persona_role, persona_style, focus_areas, previous_questions, previous_responses } = params;

    const contextPrompt = previous_questions && previous_responses
      ? `Previous Q&A context:
${previous_questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${previous_responses[i]}`).join('\n\n')}`
      : 'This is the first question.';

    const prompt = `You are a ${persona_role} conducting an interview. Your questioning style is ${persona_style}.

Document Analysis:
- Skills: ${analysis.skills.join(', ')}
- Responsibilities: ${analysis.responsibilities.join(', ')}
- Requirements: ${analysis.requirements.join(', ')}
- Role Level: ${analysis.role_level || 'Not specified'}

Focus Areas: ${focus_areas.join(', ')}

${contextPrompt}

Generate ONE insightful interview question that:
1. Relates to the candidate's background and the role
2. Matches your questioning style (${persona_style})
3. Focuses on: ${focus_areas.join(', ')}
4. Does NOT repeat previous questions
5. Is clear, specific, and actionable

Return ONLY the question text, no additional commentary.`;

    try {
      const stream = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        stream: true,
        max_completion_tokens: 512,
        temperature: 0.7, // Higher for more creative questions
        top_p: 1,
      });

      let question = '';
      for await (const chunk of stream) {
        const choices = (chunk as any).choices as any[];
        question += choices[0]?.delta?.content || '';
      }

      return question.trim();
    } catch (error) {
      console.error('Question generation failed:', error);
      throw new Error('Failed to generate question');
    }
  }

  /**
   * Grade user response and provide detailed feedback
   */
  async gradeResponse(params: ResponseGradingParams): Promise<GradingResult> {
    const { question, response, expected_areas, question_category } = params;

    const prompt = `You are an expert interview coach evaluating a candidate's response.

Question: ${question}
Category: ${question_category}
Expected areas to cover: ${expected_areas.join(', ')}

Candidate's Response:
${response}

Evaluate the response on these criteria:
1. Overall Quality (0-100): Holistic assessment
2. Confidence (0-100): How confident and self-assured the response sounds
3. Clarity (0-100): How clear and well-structured the response is
4. Relevance (0-100): How well it answers the question and covers expected areas

Provide:
- Specific strengths (3-5 points)
- Areas for improvement (3-5 points)
- Detailed feedback paragraph
- Actionable suggestions (3-5 points)

Return ONLY a JSON object with this exact structure:
{
  "overall_grade": 85,
  "confidence_score": 80,
  "clarity_score": 90,
  "relevance_score": 85,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2"],
  "detailed_feedback": "Detailed paragraph of feedback...",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        max_completion_tokens: 1024,
        temperature: 0.3, // Lower for consistent grading
        top_p: 1,
      });

      const choices = completion.choices as any[];
      const responseText = choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback with default scores
      return {
        overall_grade: 70,
        confidence_score: 70,
        clarity_score: 70,
        relevance_score: 70,
        strengths: ['Response provided'],
        improvements: ['Could be more detailed'],
        detailed_feedback: 'Unable to generate detailed feedback. Please try again.',
        suggestions: ['Practice answering with more specific examples'],
      };
    } catch (error) {
      console.error('Response grading failed:', error);
      throw new Error('Failed to grade response');
    }
  }

  /**
   * Generate immediate feedback during interview (quick response)
   */
  async generateLiveFeedback(question: string, response: string): Promise<string> {
    const prompt = `As an interview coach, provide brief encouraging feedback (1-2 sentences) on this response:

Question: ${question}
Response: ${response}

Keep it positive and constructive. Focus on ONE key observation.`;

    try {
      const stream = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        stream: true,
        max_completion_tokens: 128,
        temperature: 0.5,
        top_p: 1,
      });

      let feedback = '';
      for await (const chunk of stream) {
        const choices = (chunk as any).choices as any[];
        feedback += choices[0]?.delta?.content || '';
      }

      return feedback.trim();
    } catch (error) {
      console.error('Live feedback generation failed:', error);
      return 'Great answer! Let\'s continue.';
    }
  }

  /**
   * Generate session summary with overall insights
   */
  async generateSessionSummary(
    questions: string[],
    responses: string[],
    grades: GradingResult[]
  ): Promise<{
    overall_performance: string;
    key_strengths: string[];
    key_improvements: string[];
    career_advice: string[];
  }> {
    const avgGrade = grades.length > 0
      ? grades.reduce((sum, g) => sum + g.overall_grade, 0) / grades.length
      : 0;

    const prompt = `You are an expert career coach reviewing an interview performance.

Average Grade: ${avgGrade.toFixed(1)}/100

Questions & Responses:
${questions.map((q, i) => `
Q${i + 1}: ${q}
A${i + 1}: ${responses[i] || 'No response'}
Grade: ${grades[i]?.overall_grade || 0}/100
`).join('\n')}

Provide a comprehensive session summary with:
1. Overall performance assessment (2-3 sentences)
2. Top 5 key strengths across all responses
3. Top 5 key areas for improvement
4. 5 specific career advice points for interview preparation

Return ONLY a JSON object with this exact structure:
{
  "overall_performance": "Assessment paragraph...",
  "key_strengths": ["strength1", "strength2", "strength3", "strength4", "strength5"],
  "key_improvements": ["improvement1", "improvement2", "improvement3", "improvement4", "improvement5"],
  "career_advice": ["advice1", "advice2", "advice3", "advice4", "advice5"]
}`;

    try {
      const completion = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        max_completion_tokens: 1536,
        temperature: 0.4,
        top_p: 1,
      });

      const choices = completion.choices as any[];
      const responseText = choices[0]?.message?.content || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        overall_performance: 'Good effort overall.',
        key_strengths: [],
        key_improvements: [],
        career_advice: [],
      };
    } catch (error) {
      console.error('Session summary generation failed:', error);
      throw new Error('Failed to generate session summary');
    }
  }

  /**
   * Generate a simple interview question without document analysis
   */
  async generateSimpleQuestion(params: {
    personaName: string;
    personaRole: string;
    questioningStyle: string;
    focusAreas: string[];
    previousQuestions?: string[];
    documentContext?: string;
  }): Promise<string> {
    const { personaName, personaRole, questioningStyle, focusAreas, previousQuestions, documentContext } = params;

    let systemPrompt = `You are ${personaName}, a ${personaRole} conducting an interview.

Your questioning style is ${questioningStyle}.
Your focus areas are: ${focusAreas.join(', ')}.

Generate ONE clear, conversational interview question that:
1. Is relevant to your role and focus areas
2. Matches your questioning style (${questioningStyle})
3. Doesn't repeat previous questions
4. Takes 30-60 seconds to answer
5. Is asked directly to the candidate

Return ONLY the question itself - no preamble, no commentary, no meta-text.
Ask the question as if you are speaking directly to the candidate in a natural conversation.`;

    let userPrompt = 'Generate your next interview question for the candidate.';

    if (documentContext) {
      userPrompt += `\n\nCandidate's Background:\n${documentContext.substring(0, 500)}`;
    }

    if (previousQuestions && previousQuestions.length > 0) {
      userPrompt += `\n\nPrevious questions asked (don't repeat):\n${previousQuestions.slice(-3).join('\n')}`;
    }

    try {
      const completion = await this.client.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        model: this.model,
        max_completion_tokens: 256,
        temperature: 0.7,
        top_p: 1,
      });

      const choices = completion.choices as any[];
      let question = choices[0]?.message?.content || '';

      // Clean up any meta-commentary
      question = question.trim();

      // Remove common meta-phrases
      const metaPhrases = [
        /^(Here's|Here is) (a|the|my|your) (next )?question:?\s*/i,
        /^(Now,? )?(let's|let me) (ask|explore|move to|shift to|focus on):?\s*/i,
        /^(I'd like to|I would like to|I want to) (ask|know|hear about|explore):?\s*/i,
        /^(You've|I've|We've) (set|established|created).*?:/i,
      ];

      for (const pattern of metaPhrases) {
        question = question.replace(pattern, '');
      }

      // If the question contains a colon after meta-text, extract just the question part
      const colonMatch = question.match(/:\s*"?([^"]+)"?\s*$/);
      if (colonMatch) {
        question = colonMatch[1];
      }

      return question.trim();
    } catch (error) {
      console.error('Simple question generation failed:', error);
      throw new Error('Failed to generate question');
    }
  }
}

// Export singleton instance factory
export function createCerebrasService(apiKey: string): CerebrasAIService {
  return new CerebrasAIService(apiKey);
}
