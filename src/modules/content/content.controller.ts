import { Controller, Get } from '@nestjs/common';
import { BooksService } from './books.service';
import { CareerTipsService } from './career-tips.service';
import { QuotesService, Quote } from './quotes.service';
import { RecommendationsService } from './recommendations.service';
import { Book, CareerTip, Recommendation } from '../../common/interfaces/frontend-types';

@Controller('content')
export class ContentController {
  constructor(
    private readonly booksService: BooksService,
    private readonly careerTipsService: CareerTipsService,
    private readonly quotesService: QuotesService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('books')
  async getBook(): Promise<Book> {
    return this.booksService.getDailyBook();
  }

  @Get('career-tips')
  async getCareerTip(): Promise<CareerTip> {
    return this.careerTipsService.getDailyTip();
  }

  @Get('quotes')
  async getQuote(): Promise<Quote> {
    return this.quotesService.getDailyQuote();
  }

  @Get('recommendations')
  async getRecommendations(): Promise<Recommendation[]> {
    return this.recommendationsService.getRecommendations();
  }
}
