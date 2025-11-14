/**
 * ElevenLabs Voice Synthesis Service
 * Handles text-to-speech conversion for interviewer personas
 */

export interface VoiceGenerationOptions {
  text: string;
  voiceId: string;
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0
  useSpeakerBoost?: boolean; // default true
}

export interface VoiceGenerationResult {
  audioUrl?: string;
  audioData?: ArrayBuffer;
  characterCount: number;
  voiceId: string;
}

export interface SpeechToTextOptions {
  audioFile: Blob | File;
  modelId?: string; // default: 'scribe_v1'
  languageCode?: string; // optional, auto-detect if not provided
  diarize?: boolean; // speaker identification
  tagAudioEvents?: boolean; // tag non-speech events
}

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'spacing' | 'audio_event';
  speaker_id?: string;
}

export interface SpeechToTextResult {
  text: string;
  languageCode: string;
  languageProbability: number;
  words?: TranscriptionWord[];
  transcriptionId?: string;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate speech from text using specified voice
   */
  async generateSpeech(options: VoiceGenerationOptions): Promise<VoiceGenerationResult> {
    const {
      text,
      voiceId,
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0,
      useSpeakerBoost = true,
    } = options;

    const url = `${this.baseUrl}/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioData = await response.arrayBuffer();

    return {
      audioData,
      characterCount: text.length,
      voiceId,
    };
  }

  /**
   * Stream speech generation (for long-form content)
   */
  async generateSpeechStream(options: VoiceGenerationOptions): Promise<ReadableStream> {
    const {
      text,
      voiceId,
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0,
      useSpeakerBoost = true,
    } = options;

    const url = `${this.baseUrl}/text-to-speech/${voiceId}/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body available for streaming');
    }

    return response.body;
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json() as { voices?: any[] };
    return data.voices || [];
  }

  /**
   * Get voice settings for specific voice
   */
  async getVoiceSettings(voiceId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/voices/${voiceId}/settings`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voice settings: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Convert speech to text using ElevenLabs Scribe
   */
  async transcribeAudio(options: SpeechToTextOptions): Promise<SpeechToTextResult> {
    const {
      audioFile,
      modelId = 'scribe_v1',
      languageCode,
      diarize = false,
      tagAudioEvents = false,
    } = options;

    const url = `${this.baseUrl}/speech-to-text`;

    // Create FormData for multipart/form-data request
    const formData = new FormData();
    // Ensure the file has a proper filename for the API
    const fileName = (audioFile as any).name || 'recording.webm';
    formData.append('file', audioFile, fileName);
    formData.append('model_id', modelId);

    if (languageCode) {
      formData.append('language_code', languageCode);
    }
    if (diarize) {
      formData.append('diarize', 'true');
    }
    if (tagAudioEvents) {
      formData.append('tag_audio_events', 'true');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          // Don't set Content-Type - browser will set it with boundary
        },
        body: formData,
      });
    } catch (fetchError) {
      console.error('[ElevenLabs STT] Fetch failed:', fetchError);
      throw new Error(`Failed to connect to ElevenLabs API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs STT] API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
      });
      throw new Error(`ElevenLabs STT API error: ${response.status} - ${errorText}`);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[ElevenLabs STT] JSON parse failed:', parseError);
      throw new Error(`Failed to parse ElevenLabs response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    return {
      text: data.text || '',
      languageCode: data.language_code || 'en',
      languageProbability: data.language_probability || 0,
      words: data.words?.map((word: any) => ({
        text: word.text,
        start: word.start,
        end: word.end,
        type: word.type,
        speaker_id: word.speaker_id,
      })),
      transcriptionId: data.transcription_id,
    };
  }
}

/**
 * Factory function to create ElevenLabs service
 */
export function createElevenLabsService(apiKey: string): ElevenLabsService {
  return new ElevenLabsService(apiKey);
}
