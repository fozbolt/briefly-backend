import { Controller, Post, Body } from '@nestjs/common';
import { ChatService, ChatTurn } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('bri')
  async sendMessage(
    @Body() body: { message: string; history?: ChatTurn[] },
  ): Promise<{ message: string }> {
    return this.chatService.sendMessage(body.message, body.history || []);
  }
}
