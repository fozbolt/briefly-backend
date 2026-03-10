import { Controller, Get, Query } from '@nestjs/common';
import { ListenService, ListenPayload } from './listen.service';

@Controller('listen')
export class ListenController {
  constructor(private readonly listenService: ListenService) {}

  @Get('narration')
  async getNarration(
    @Query('userName') userName?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ): Promise<ListenPayload> {
    return this.listenService.buildNarration(
      userName || 'there',
      lat ? parseFloat(lat) : undefined,
      lon ? parseFloat(lon) : undefined,
    );
  }
}
