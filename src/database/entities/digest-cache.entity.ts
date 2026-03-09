import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('digest_cache')
export class DigestCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  cacheKey!: string;

  @Column({ type: 'text' })
  data!: string;

  @Column({ type: 'int' })
  ttlSeconds!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'datetime' })
  expiresAt!: Date;
}
