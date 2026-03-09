import { Injectable } from '@nestjs/common';
import { NewsService } from '../news/news.service';

const CONTEXTUAL_RESPONSES = [
  "Based on your morning digest, here are the key highlights:",
  "I've analyzed your digest and here's what stands out:",
  "Let me break that down for you based on today's briefing:",
];

@Injectable()
export class ChatService {
  constructor(private readonly newsService: NewsService) {}

  async sendMessage(message: string): Promise<{ message: string }> {
    const lowerMsg = message.toLowerCase();

    // Morning news overview
    if (lowerMsg.includes('news') || lowerMsg.includes('morning') || lowerMsg.includes('overview') || lowerMsg.includes('digest')) {
      return this.getNewsOverview();
    }

    // Finance queries
    if (lowerMsg.includes('market') || lowerMsg.includes('stock') || lowerMsg.includes('portfolio') || lowerMsg.includes('finance')) {
      return {
        message: "Your portfolio is tracking well today. The S&P 500 and NASDAQ are showing mixed signals. I'd recommend checking the Finance section of your digest for detailed performance data.",
      };
    }

    // Weather queries
    if (lowerMsg.includes('weather') || lowerMsg.includes('temperature')) {
      return {
        message: "You can check the Daily Pulse widget at the top of your digest for real-time weather. I can see multiple locations are being tracked for you.",
      };
    }

    // Schedule / tasks
    if (lowerMsg.includes('schedule') || lowerMsg.includes('task') || lowerMsg.includes('meeting') || lowerMsg.includes('calendar')) {
      return {
        message: "Your calendar integration is set up to show upcoming tasks in the digest. Check the Upcoming Tasks widget for today's schedule.",
      };
    }

    // Email queries
    if (lowerMsg.includes('email') || lowerMsg.includes('inbox')) {
      return {
        message: "The Smart Email Summaries widget shows your most important emails. I've identified action items and priorities from your recent messages.",
      };
    }

    // Generic helpful response
    const prefix = CONTEXTUAL_RESPONSES[Math.floor(Math.random() * CONTEXTUAL_RESPONSES.length)];
    return {
      message: `${prefix}\n\nI can help you with:\n• 📰 News summaries and analysis\n• 💰 Market and portfolio updates\n• 🌤️ Weather information\n• 📅 Schedule and task overview\n• 📧 Email summaries\n\nWhat would you like to know more about?`,
    };
  }

  private async getNewsOverview(): Promise<{ message: string }> {
    try {
      const signals = await this.newsService.getSignals();
      if (signals.length === 0) {
        return { message: "I'm still preparing your morning digest. Check back in a few minutes!" };
      }

      const bulletPoints = signals
        .map((s) => `${s.icon} ${s.title}`)
        .join('\n');

      return {
        message: `Here's your morning digest overview:\n\n${bulletPoints}\n\nWould you like me to dive deeper into any of these topics?`,
      };
    } catch {
      return {
        message: "Your morning digest covers the latest news, market updates, and personalized content. Check your Home screen for the full briefing!",
      };
    }
  }
}
