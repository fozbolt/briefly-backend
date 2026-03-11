import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ChatService, ChatTurn, type ChatClientContext } from './chat.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('bri')
  @UseGuards(SessionAuthGuard)
  async sendMessage(
    @Req() request: AuthenticatedRequest,
    @Body() body: { message: string; history?: ChatTurn[]; context?: ChatClientContext },
  ): Promise<{ message: string }> {
    return this.chatService.sendMessage(
      body.message,
      body.history || [],
      request.user,
      body.context,
    );
  }
}
