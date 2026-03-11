import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NewsModule } from '../news/news.module';
import { AuthModule } from '../auth/auth.module';
import { SessionAuthGuard } from '../auth/session-auth.guard';

@Module({
  imports: [NewsModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService, SessionAuthGuard],
  exports: [ChatService],
})
export class ChatModule {}
