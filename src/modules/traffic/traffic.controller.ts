import { Controller, Get, Query } from '@nestjs/common';
import {
  CommuteTrafficSnapshot,
  TrafficService,
} from './traffic.service';

@Controller('traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficService) {}

  @Get('estimate')
  async estimate(
    @Query('origin') origin = '',
    @Query('destination') destination = '',
  ): Promise<CommuteTrafficSnapshot> {
    return this.trafficService.estimateTraffic(origin, destination);
  }
}
