import { Controller, Get } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { Portfolio, Stock } from '../../common/interfaces/frontend-types';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('portfolio')
  async getPortfolio(): Promise<Portfolio> {
    return this.financeService.getPortfolio();
  }

  @Get('crypto')
  async getCrypto(): Promise<Stock[]> {
    return this.financeService.getCrypto();
  }
}
