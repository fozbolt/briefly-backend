import { Controller, Get } from '@nestjs/common';
import { SocialService } from './social.service';
import { SocialPulse } from '../../common/interfaces/frontend-types';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('pulse')
  async getPulse(): Promise<SocialPulse> {
    return this.socialService.getPulse();
  }
}
