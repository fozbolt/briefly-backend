import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NewsService } from '../news/news.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatClientContext {
  userName?: string;
  weather?: Array<{ location?: string; condition?: string; temp?: number; unit?: string }>;
  signals?: Array<{ title: string; summary?: string }>;
  tasks?: Array<{ title: string; time?: string }>;
  digestTab?: string;
}

const SYSTEM_PROMPT = [
  'You are Bri, a capable general AI assistant inside the Briefly daily-digest app.',
  'You are not limited to digest topics — you can help with coding, writing, planning, research, learning, and daily decisions.',
  'Answer any user question helpfully, accurately, and concisely.',
  'Be concise by default unless the user asks for depth.',
  'When the user asks about their digest, news, finance, weather, or schedule, give helpful context-aware answers.',
  'Use emoji sparingly for section headers if it helps readability.',
].join(' ');

const FALLBACK_RESPONSES = [
  'I can help with coding, writing, planning, learning, and daily decisions. Ask me anything.',
  'I can reason through complex questions step by step and give a concise final answer.',
  'I can switch styles too: short answer, detailed explanation, or practical action plan.',
];

@Injectable()
export class ChatService {
  private readonly llmBaseUrl: string;
  private readonly llmModel: string;

  constructor(
    private readonly newsService: NewsService,
    private readonly configService: ConfigService,
  ) {
    this.llmBaseUrl = this.configService.get<string>('llm.baseUrl') || 'https://text.pollinations.ai';
    this.llmModel = this.configService.get<string>('llm.model') || 'openai-fast';
  }

  async sendMessage(
    message: string,
    history: ChatTurn[] = [],
    _user: AuthenticatedUser,
    clientContext?: ChatClientContext,
  ): Promise<{ message: string }> {
    const trimmed = message.trim();
    if (!trimmed) {
      return { message: 'Send any question and I will answer it.' };
    }

    // Try free LLM first
    const llmResponse = await this.callFreeLLM(trimmed, history, clientContext);
    if (llmResponse) {
      return { message: llmResponse };
    }

    // Fallback: keyword-based responses enriched with live data
    return this.keywordFallback(trimmed);
  }

  private async callFreeLLM(
    userMessage: string,
    history: ChatTurn[],
    clientContext?: ChatClientContext,
  ): Promise<string | null> {
    try {
      const prompt = this.buildPrompt(userMessage, history, clientContext);

      const response = await axios.get(
        `${this.llmBaseUrl}/${encodeURIComponent(prompt)}`,
        {
          params: { model: this.llmModel },
          headers: { Accept: 'text/plain' },
          timeout: 25000,
          responseType: 'text',
        },
      );

      if (response.status !== 200 || !response.data) {
        return null;
      }

      const text = String(response.data).trim();
      if (text.length === 0) return null;

      return this.cleanResponse(text);
    } catch (error) {
      console.error('Free LLM call failed:', (error as Error).message);
      return null;
    }
  }

  private buildPrompt(
    userMessage: string,
    history: ChatTurn[],
    clientContext?: ChatClientContext,
  ): string {
    const normalizedHistory = history
      .filter((item) => item.content.trim().length > 0 && item.role !== 'system')
      .slice(-8);

    const historyText = normalizedHistory
      .map((item) =>
        `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`,
      )
      .join('\n');

    return [
      `System: ${SYSTEM_PROMPT}`,
      'Security rule: use only provided conversation/context and never infer or disclose private user identifiers.',
      clientContext ? `Client context (sanitized): ${JSON.stringify(clientContext)}` : '',
      historyText ? `Conversation:\n${historyText}` : '',
      `User: ${userMessage}`,
      'Assistant:',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private cleanResponse(text: string): string {
    return text
      .replace(/^assistant:\s*/i, '')
      .replace(/^bri:\s*/i, '')
      .trim();
  }

  private async keywordFallback(message: string): Promise<{ message: string }> {
    const lower = message.toLowerCase();

    if (lower.match(/news|morning|overview|digest|headline/)) {
      return this.getNewsOverview();
    }

    if (lower.match(/market|stock|portfolio|finance|crypto|bitcoin/)) {
      return {
        message:
          "Your portfolio is tracking well today. The S&P 500 and NASDAQ are showing mixed signals. Check the Finance section of your digest for detailed data.",
      };
    }

    if (lower.match(/weather|temperature|forecast|rain/)) {
      return {
        message:
          "Check the Daily Pulse widget at the top of your digest for real-time weather across your tracked locations.",
      };
    }

    if (lower.match(/schedule|task|meeting|calendar|todo/)) {
      return {
        message:
          "Your calendar integration shows upcoming tasks in the digest. Check the Upcoming Tasks widget for today's schedule.",
      };
    }

    if (lower.match(/email|inbox|mail/)) {
      return {
        message:
          "The Smart Email Summaries widget shows your most important emails with action items and priorities.",
      };
    }

    return {
      message:
        FALLBACK_RESPONSES[
          Math.floor(Math.random() * FALLBACK_RESPONSES.length)
        ],
    };
  }

  private async getNewsOverview(): Promise<{ message: string }> {
    try {
      const signals = await this.newsService.getSignals();
      if (signals.length === 0) {
        return {
          message:
            "I'm still preparing your morning digest. Check back in a few minutes!",
        };
      }

      const bulletPoints = signals
        .map((s) => `${s.icon} ${s.title}`)
        .join('\n');

      return {
        message: `Here's your morning digest overview:\n\n${bulletPoints}\n\nWould you like me to dive deeper into any of these topics?`,
      };
    } catch {
      return {
        message:
          'Your morning digest covers the latest news, market updates, and personalized content. Check your Home screen for the full briefing!',
      };
    }
  }
}
