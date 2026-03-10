import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('digest_cache')
export class DigestCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  cacheKey!: string;

  @Column({ type: 'text' })
  data!: string;

  @Column({ type: 'int' })
  ttlSeconds!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Index()
  @Column({ type: 'datetime' })
  expiresAt!: Date;
}
