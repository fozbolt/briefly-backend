import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Recommendation } from '../../common/interfaces/frontend-types';
import { NewsService } from '../news/news.service';

const INTEREST_CATEGORIES = [
  'AI & DEFENSE', 'URBANISM', 'NEUROSCIENCE', 'CLIMATE', 'FINTECH',
  'HEALTH TECH', 'SPACE', 'QUANTUM', 'BIOTECH', 'ENERGY',
];

@Injectable()
export class RecommendationsService {
  constructor(private readonly newsService: NewsService) {}

  async getRecommendations(): Promise<Recommendation[]> {
    try {
      const news = await this.newsService.getNews();

      // Pick 3 diverse items from news, assign interest categories
      const selected = news.slice(0, 6);
      const recommendations: Recommendation[] = [];

      for (let i = 0; i < Math.min(3, selected.length); i++) {
        const item = selected[i * 2] || selected[i];
        if (!item) continue;

        recommendations.push({
          id: uuid(),
          title: item.title,
          subtitle: item.description.substring(0, 80) + (item.description.length > 80 ? '...' : ''),
          interest: INTEREST_CATEGORIES[i % INTEREST_CATEGORIES.length],
        });
      }

      // Pad with fallback if not enough
      while (recommendations.length < 3) {
        recommendations.push(this.getFallbackRecommendation(recommendations.length));
      }

      return recommendations;
    } catch (error) {
      console.error('Recommendations error:', (error as Error).message);
      return [0, 1, 2].map((i) => this.getFallbackRecommendation(i));
    }
  }

  private getFallbackRecommendation(index: number): Recommendation {
    const fallbacks = [
      { title: 'How AI will transform intelligence agencies', subtitle: 'Exploring the shift from data collection...', interest: 'AI & DEFENSE' },
      { title: "The return of the '15-minute city' in post-industrial hubs", subtitle: 'How mid-sized cities are redesigning...', interest: 'URBANISM' },
      { title: 'Why our brains crave narrative over raw data', subtitle: 'New research into the neurobiology of...', interest: 'NEUROSCIENCE' },
    ];
    return { id: uuid(), ...fallbacks[index % fallbacks.length] };
  }
}
