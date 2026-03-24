import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('analytics_events')
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  eventName!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  pseudoUserId!: string;

  @Column({ type: 'varchar', length: 64 })
  sessionId!: string;

  @Column({ type: 'varchar', length: 24 })
  deviceType!: string;

  @Column({ type: 'varchar', length: 24 })
  appVersion!: string;

  @Column({ type: 'varchar', length: 8, default: 'unknown' })
  country!: string;

  @Column({ type: 'text', nullable: true })
  properties!: string | null;

  @Index()
  @Column({ type: 'datetime' })
  clientTimestamp!: Date;

  @Index()
  @CreateDateColumn()
  receivedAt!: Date;
}
