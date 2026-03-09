import { Controller, Get, Query } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { Weather } from '../../common/interfaces/frontend-types';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  async getWeather(
    @Query('lat') lat: string = '40.71',
    @Query('lon') lon: string = '-74.00',
  ): Promise<Weather> {
    return this.weatherService.getWeather(
      parseFloat(lat),
      parseFloat(lon),
    );
  }
}
