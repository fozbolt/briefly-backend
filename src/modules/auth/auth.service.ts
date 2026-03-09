import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { User } from '../../database/entities/user.entity';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; fullName: string };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async register(fullName: string, email: string, _password: string): Promise<AuthResponse> {
    // Check if user exists
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      // For the prototype, just return the existing user
      return this.buildResponse(existing);
    }

    // Create new user
    const user = this.userRepo.create({
      name: fullName.split(' ')[0] || fullName,
      email,
      level: 'Explorer',
    });
    const saved = await this.userRepo.save(user);
    return this.buildResponse(saved);
  }

  async login(email: string, _password: string): Promise<AuthResponse> {
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      // Auto-create for prototype
      user = this.userRepo.create({
        name: email.split('@')[0],
        email,
        level: 'Explorer',
      });
      user = await this.userRepo.save(user);
    }

    return this.buildResponse(user);
  }

  async oauthLogin(provider: string, _deviceAuthCode: string): Promise<AuthResponse> {
    // For prototype: create/find a demo user for the OAuth provider
    const email = `demo-${provider}@briefly.app`;
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      user = this.userRepo.create({
        name: 'Alex',
        email,
        level: 'Explorer',
      });
      user = await this.userRepo.save(user);
    }

    return this.buildResponse(user);
  }

  private buildResponse(user: User): AuthResponse {
    // Generate a simple token (in production: use JWT)
    const token = `briefly_${uuid().replace(/-/g, '')}`;
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.name,
      },
    };
  }
}
