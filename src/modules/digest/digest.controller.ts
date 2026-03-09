import { Controller, Get, Query } from '@nestjs/common';
import { DigestService } from './digest.service';
import { DigestResponse } from '../../common/interfaces/frontend-types';

@Controller('digest')
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  @Get()
  async getDigest(
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ): Promise<DigestResponse> {
    return this.digestService.getFullDigest(
      lat ? parseFloat(lat) : undefined,
      lon ? parseFloat(lon) : undefined,
    );
  }
}
