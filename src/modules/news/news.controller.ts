import { Controller, Get } from '@nestjs/common';
import { NewsService } from './news.service';
import { Signal } from '../../common/interfaces/frontend-types';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async getNews(): Promise<Signal[]> {
    return this.newsService.getNews();
  }

  @Get('signals')
  async getSignals(): Promise<Signal[]> {
    return this.newsService.getSignals();
  }
}
