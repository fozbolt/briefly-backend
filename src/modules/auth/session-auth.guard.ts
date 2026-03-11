import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawAuthHeader = request.headers?.authorization;
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header.');
    }
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Invalid Authorization header format.');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    request.user = this.authService.verifySignedToken(token);
    return true;
  }
}
