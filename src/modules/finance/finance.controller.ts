import { Controller, Get, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { Portfolio, Stock } from '../../common/interfaces/frontend-types';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('portfolio')
  async getPortfolio(
    @Query('symbols') symbols?: string,
  ): Promise<Portfolio> {
    const symbolList = symbols
      ? symbols.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    return this.financeService.getPortfolio(symbolList);
  }

  @Get('crypto')
  async getCrypto(): Promise<Stock[]> {
    return this.financeService.getCrypto();
  }
}
