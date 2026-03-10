import { Injectable } from '@nestjs/common';
import { WeatherService } from '../weather/weather.service';
import { NewsService } from '../news/news.service';
import { FinanceService } from '../finance/finance.service';
import { BooksService } from '../content/books.service';
import { CareerTipsService } from '../content/career-tips.service';
import { QuotesService } from '../content/quotes.service';
import { SocialService } from '../social/social.service';
import { RecommendationsService } from '../content/recommendations.service';

export interface ListenSection {
  id: string;
  name: string;
  status: string;
  duration: string;
  icon: string;
}

export interface ListenPayload {
  script: string;
  sections: ListenSection[];
  estimatedDurationSec: number;
  generatedAtLabel: string;
}

function getGreetingLabel(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDateLabel(now: Date): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = 155;
  return Math.max(45, Math.round((words / wordsPerMinute) * 60));
}

function toDurationLabel(seconds: number): string {
  const safe = Math.max(1, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

@Injectable()
export class ListenService {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly newsService: NewsService,
    private readonly financeService: FinanceService,
    private readonly booksService: BooksService,
    private readonly careerTipsService: CareerTipsService,
    private readonly quotesService: QuotesService,
    private readonly socialService: SocialService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async buildNarration(
    userName = 'there',
    lat = 40.71,
    lon = -74.0,
  ): Promise<ListenPayload> {
    const now = new Date();

    // Fetch all data in parallel with graceful fallbacks
    const [
      weatherResult,
      signalsResult,
      portfolioResult,
      bookResult,
      careerTipResult,
      quoteResult,
      socialPulseResult,
      recommendationsResult,
    ] = await Promise.allSettled([
      this.weatherService.getWeather(lat, lon),
      this.newsService.getSignals(),
      this.financeService.getPortfolio(),
      this.booksService.getDailyBook(),
      this.careerTipsService.getDailyTip(),
      this.quotesService.getDailyQuote(),
      this.socialService.getPulse(),
      this.recommendationsService.getRecommendations(),
    ]);

    // --- Build narration script ---
    const parts: string[] = [];

    // 1. Greeting
    const greeting = `${getGreetingLabel(now)}, ${userName}. Today is ${getDateLabel(now)}. Here is your Briefly daily digest.`;
    parts.push(greeting);

    // 2. Weather
    if (weatherResult.status === 'fulfilled') {
      const w = weatherResult.value;
      parts.push(
        `Weather update. It's currently ${w.temp} degrees ${w.unit}, ${w.condition}. ${w.description}`,
      );
    }

    // 3. Morning Briefing (static context)
    parts.push(
      'Morning briefing. Ready for your day. You have meetings and tasks pending. Let me walk you through what matters most.',
    );

    // 4. Top Signals
    if (signalsResult.status === 'fulfilled' && signalsResult.value.length > 0) {
      const signalLines = signalsResult.value
        .map((s, i) => `Signal ${i + 1}: ${s.title}. ${s.description}`)
        .join(' ');
      parts.push(`Your top signals for today. ${signalLines}`);
    }

    // 5. Finance
    if (portfolioResult.status === 'fulfilled') {
      const p = portfolioResult.value;
      const stockLines = p.stocks
        .map((s) => `${s.name} is ${s.positive ? 'up' : 'down'} ${s.change}`)
        .join('. ');
      parts.push(
        `Finance update. Your portfolio total is ${p.total}, with an overall change of ${p.change}. ${stockLines}.`,
      );
    }

    // 6. Social Pulse
    if (socialPulseResult.status === 'fulfilled') {
      const sp = socialPulseResult.value;
      parts.push(
        `Social pulse. Trending on tech feeds: ${sp.twitter.author} says ${sp.twitter.text}. On business feeds: ${sp.linkedin.author} says ${sp.linkedin.text}.`,
      );
    }

    // 7. Book Recommendation
    if (bookResult.status === 'fulfilled') {
      parts.push(
        `Today's book recommendation. ${bookResult.value.title}. Estimated ${bookResult.value.readTime}.`,
      );
    }

    // 8. Career Tip
    if (careerTipResult.status === 'fulfilled') {
      parts.push(
        `Career pro tip. ${careerTipResult.value.title}. ${careerTipResult.value.readTime}.`,
      );
    }

    // 9. Recommendations
    if (recommendationsResult.status === 'fulfilled' && recommendationsResult.value.length > 0) {
      const recLines = recommendationsResult.value
        .map((r) => `${r.title}. ${r.subtitle}`)
        .join(' ');
      parts.push(`Recommended for you. ${recLines}`);
    }

    // 10. Daily Quote
    if (quoteResult.status === 'fulfilled') {
      parts.push(
        `And your daily inspiration. "${quoteResult.value.text}" — ${quoteResult.value.author}.`,
      );
    }

    // 11. Closing
    parts.push(
      'That concludes your daily Briefly digest. Have a productive day!',
    );

    const script = parts.join(' ');
    const estimatedDurationSec = estimateDuration(script);
    const sectionDuration = Math.max(15, Math.round(estimatedDurationSec / 6));

    const sections: ListenSection[] = [
      {
        id: 'sec-1',
        name: 'Greeting & Weather',
        status: 'Included',
        duration: toDurationLabel(sectionDuration),
        icon: '⛅',
      },
      {
        id: 'sec-2',
        name: 'Briefing & Signals',
        status: 'Included',
        duration: toDurationLabel(sectionDuration),
        icon: '📰',
      },
      {
        id: 'sec-3',
        name: 'Finance & Markets',
        status: 'Included',
        duration: toDurationLabel(sectionDuration),
        icon: '📈',
      },
      {
        id: 'sec-4',
        name: 'Social & Community',
        status: 'Included',
        duration: toDurationLabel(sectionDuration),
        icon: '💬',
      },
      {
        id: 'sec-5',
        name: 'Knowledge & Growth',
        status: 'Included',
        duration: toDurationLabel(sectionDuration),
        icon: '📚',
      },
      {
        id: 'sec-6',
        name: 'Recommendations & Closing',
        status: 'Included',
        duration: toDurationLabel(sectionDuration),
        icon: '💡',
      },
    ];

    return {
      script,
      sections,
      estimatedDurationSec,
      generatedAtLabel: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }
}
