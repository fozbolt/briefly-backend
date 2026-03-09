import { Injectable } from '@nestjs/common';
import { DigestResponse } from '../../common/interfaces/frontend-types';
import { WeatherService } from '../weather/weather.service';
import { NewsService } from '../news/news.service';
import { FinanceService } from '../finance/finance.service';
import { BooksService } from '../content/books.service';
import { CareerTipsService } from '../content/career-tips.service';
import { SocialService } from '../social/social.service';
import { RecommendationsService } from '../content/recommendations.service';

@Injectable()
export class DigestService {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly newsService: NewsService,
    private readonly financeService: FinanceService,
    private readonly booksService: BooksService,
    private readonly careerTipsService: CareerTipsService,
    private readonly socialService: SocialService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async getFullDigest(lat = 40.71, lon = -74.0): Promise<DigestResponse> {
    const [
      weatherResult,
      signalsResult,
      portfolioResult,
      bookResult,
      careerTipResult,
      socialPulseResult,
      recommendationsResult,
    ] = await Promise.allSettled([
      this.weatherService.getWeather(lat, lon),
      this.newsService.getSignals(),
      this.financeService.getPortfolio(),
      this.booksService.getDailyBook(),
      this.careerTipsService.getDailyTip(),
      this.socialService.getPulse(),
      this.recommendationsService.getRecommendations(),
    ]);

    return {
      weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
      tasks: [], // Phase 2: Calendar integration
      emails: [], // Phase 2: Gmail integration
      signals: signalsResult.status === 'fulfilled' ? signalsResult.value : [],
      portfolio: portfolioResult.status === 'fulfilled' ? portfolioResult.value : null,
      book: bookResult.status === 'fulfilled' ? bookResult.value : null,
      careerTip: careerTipResult.status === 'fulfilled' ? careerTipResult.value : null,
      socialPulse: socialPulseResult.status === 'fulfilled' ? socialPulseResult.value : null,
      recommendations: recommendationsResult.status === 'fulfilled' ? recommendationsResult.value : [],
      generatedAt: new Date().toISOString(),
    };
  }
}
