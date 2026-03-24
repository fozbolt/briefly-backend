import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from '../../database/entities/analytics-event.entity';
import { AnalyticsEventDto } from './dto/track-events.dto';

/** Fields that must never be stored in event properties (GDPR). */
const STRIPPED_PROPERTY_KEYS = ['email', 'name', 'phone', 'address', 'ip'];

/** Flush the in-memory buffer when it reaches this many events. */
const BUFFER_FLUSH_SIZE = 500;

/** Flush the in-memory buffer at least every N milliseconds. */
const BUFFER_FLUSH_INTERVAL_MS = 5_000;

/** Maximum events kept in the buffer — reject new events beyond this. */
const BUFFER_MAX_SIZE = 50_000;

/** Maximum events per single INSERT statement. */
const INSERT_CHUNK_SIZE = 500;

/** Max consecutive flush failures before exponential backoff kicks in. */
const MAX_BACKOFF_EXPONENT = 6; // 2^6 = 64× base interval = ~5 min

function sanitizeProperties(
  raw: Record<string, unknown> | undefined,
): string | null {
  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (STRIPPED_PROPERTY_KEYS.includes(key.toLowerCase())) {
      continue;
    }
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

function dtoToEntity(dto: AnalyticsEventDto): AnalyticsEvent {
  const entity = new AnalyticsEvent();
  entity.eventName = dto.event_name;
  entity.pseudoUserId = dto.user_id;
  entity.sessionId = dto.session_id;
  entity.deviceType = dto.device_type;
  entity.appVersion = dto.app_version;
  entity.country = dto.country ?? 'unknown';
  entity.properties = sanitizeProperties(dto.properties);
  entity.clientTimestamp = new Date(dto.timestamp);
  return entity;
}

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);

  /** In-memory write buffer — events accumulate here before bulk INSERT. */
  private buffer: AnalyticsEvent[] = [];

  /** Periodic flush timer. */
  private flushTimer: ReturnType<typeof setInterval>;

  /** Prevents concurrent flushes from racing. */
  private flushing = false;

  /** Consecutive flush failure count — drives exponential backoff. */
  private consecutiveFailures = 0;

  /** Timestamp of last flush attempt — used for backoff gating. */
  private lastFlushAttempt = 0;

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly repo: Repository<AnalyticsEvent>,
  ) {
    this.enableWalMode();

    this.flushTimer = setInterval(() => {
      void this.flushBuffer();
    }, BUFFER_FLUSH_INTERVAL_MS);
  }

  /** Clean up on shutdown — flush remaining events with timeout. */
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flushTimer);
    // Force flush with 5-second timeout so shutdown isn't blocked
    await Promise.race([
      this.flushBuffer(true),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }

  /**
   * Accept a batch of events into the in-memory buffer.
   * Returns immediately — the actual DB write happens asynchronously.
   * Rejects events when buffer is full (backpressure).
   */
  enqueue(events: AnalyticsEventDto[]): { accepted: number; dropped: number } {
    const entities = events.map(dtoToEntity);

    const available = BUFFER_MAX_SIZE - this.buffer.length;
    if (available <= 0) {
      this.logger.warn(
        `Buffer full (${BUFFER_MAX_SIZE}), dropping ${entities.length} events`,
      );
      return { accepted: 0, dropped: entities.length };
    }

    const toAccept = entities.slice(0, available);
    const dropped = entities.length - toAccept.length;

    if (dropped > 0) {
      this.logger.warn(`Buffer near full, dropped ${dropped} events`);
    }

    this.buffer.push(...toAccept);

    if (this.buffer.length >= BUFFER_FLUSH_SIZE) {
      void this.flushBuffer();
    }

    return { accepted: toAccept.length, dropped };
  }

  /** Flush the in-memory buffer to the database via chunked bulk INSERTs. */
  async flushBuffer(force = false): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }

    // Exponential backoff: skip flush if too soon after recent failure
    if (!force && this.consecutiveFailures > 0) {
      const backoffMs =
        BUFFER_FLUSH_INTERVAL_MS *
        Math.pow(2, Math.min(this.consecutiveFailures, MAX_BACKOFF_EXPONENT));
      if (Date.now() - this.lastFlushAttempt < backoffMs) {
        return;
      }
    }

    this.flushing = true;
    this.lastFlushAttempt = Date.now();

    // Swap the buffer so new events can accumulate while we write
    const batch = this.buffer;
    this.buffer = [];

    try {
      // Chunked inserts — avoid huge single statements
      for (let i = 0; i < batch.length; i += INSERT_CHUNK_SIZE) {
        const chunk = batch.slice(i, i + INSERT_CHUNK_SIZE);
        await this.repo.insert(chunk);
      }

      this.consecutiveFailures = 0;
      this.logger.debug(`Flushed ${batch.length} analytics events to DB`);
    } catch (error) {
      this.consecutiveFailures++;
      this.logger.error(
        `Failed to flush ${batch.length} analytics events (attempt ${this.consecutiveFailures}) — returning to buffer`,
        error,
      );

      // Put failed events back, but respect max buffer size
      const space = BUFFER_MAX_SIZE - this.buffer.length;
      const toReturn = batch.slice(0, space);
      if (toReturn.length > 0) {
        this.buffer.unshift(...toReturn);
      }
      if (toReturn.length < batch.length) {
        this.logger.warn(
          `Dropped ${batch.length - toReturn.length} events — buffer full after failed flush`,
        );
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Enable WAL (Write-Ahead Logging) mode for SQLite.
   * Allows concurrent reads while a write is in progress.
   */
  private enableWalMode(): void {
    try {
      const dataSource = this.repo.manager.connection;
      if (dataSource.options.type === 'better-sqlite3') {
        void dataSource.query('PRAGMA journal_mode=WAL').then(() => {
          this.logger.log('SQLite WAL mode enabled');
        });
      }
    } catch {
      // Non-critical — default journal mode still works fine
    }
  }
}
