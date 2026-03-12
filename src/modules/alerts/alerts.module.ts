import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { User } from '../../database/entities/user.entity';
import { UserPreference } from '../../database/entities/user-preference.entity';
import { PushDevice } from '../../database/entities/push-device.entity';
import { AuthModule } from '../auth/auth.module';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPreference, PushDevice]),
    AuthModule,
    FinanceModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, SessionAuthGuard],
  exports: [AlertsService],
})
export class AlertsModule {}
