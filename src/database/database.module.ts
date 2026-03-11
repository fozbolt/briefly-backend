import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { SavedItem } from './entities/saved-item.entity';
import { DigestCache } from './entities/digest-cache.entity';
import { ContentItem } from './entities/content-item.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { CacheCleanupService } from './cache-cleanup.service';

const entities = [
  User,
  UserPreference,
  SavedItem,
  DigestCache,
  ContentItem,
  EmailVerificationToken,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('database.type') || 'sqlite';

        if (dbType === 'mariadb') {
          return {
            type: 'mariadb' as const,
            host: config.get<string>('database.host'),
            port: config.get<number>('database.port'),
            username: config.get<string>('database.username'),
            password: config.get<string>('database.password'),
            database: config.get<string>('database.name'),
            entities,
            synchronize: config.get<boolean>('database.synchronize') ?? false,
            logging: (process.env.NODE_ENV || 'development') !== 'production',
          };
        }

        // Default: SQLite for easy local development
        return {
          type: 'better-sqlite3' as const,
          database: config.get<string>('database.sqlitePath') || './briefly.db',
          entities,
          synchronize: config.get<boolean>('database.synchronize') ?? false,
          logging: (process.env.NODE_ENV || 'development') !== 'production',
        };
      },
    }),
    TypeOrmModule.forFeature(entities),
  ],
  providers: [CacheCleanupService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
