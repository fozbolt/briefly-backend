import { Body, Controller, Delete, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AlertsService, type PriceAlertSettingsResponse } from './alerts.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';
import { RemovePushDeviceDto } from './dto/remove-push-device.dto';
import { UpdatePriceAlertSettingsDto } from './dto/update-price-alert-settings.dto';

@Controller('alerts/price')
@UseGuards(SessionAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getSettings(
    @Req() request: AuthenticatedRequest,
  ): Promise<PriceAlertSettingsResponse> {
    return this.alertsService.getPriceAlertSettings(request.user.id);
  }

  @Put()
  async updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdatePriceAlertSettingsDto,
  ): Promise<PriceAlertSettingsResponse> {
    return this.alertsService.updatePriceAlertSettings(request.user.id, body);
  }

  @Post('device')
  async registerDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: RegisterPushDeviceDto,
  ): Promise<{ registered: true; devices: number }> {
    return this.alertsService.registerPushDevice(request.user.id, body);
  }

  @Delete('device')
  async removeDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: RemovePushDeviceDto,
  ): Promise<{ removed: true; devices: number }> {
    return this.alertsService.removePushDevice(request.user.id, body.expoPushToken);
  }

  @Post('test')
  async sendTest(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ sent: true; devices: number }> {
    return this.alertsService.sendTestNotification(request.user.id);
  }
}
