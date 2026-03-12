import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('push_devices')
@Unique(['expoPushToken'])
export class PushDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.pushDevices, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  expoPushToken!: string;

  @Column({ type: 'varchar', length: 24, default: 'unknown' })
  platform!: string;

  @Column({ type: 'datetime', nullable: true, default: null })
  lastSentAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
