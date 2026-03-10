import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, (user) => user.preferences, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;

  @Column({ type: 'simple-json', nullable: true, default: null })
  interests!: string[];

  @Column({ type: 'simple-json', nullable: true, default: null })
  regions!: string[];

  @Column({ type: 'simple-json', nullable: true, default: null })
  trackedAssets!: string[];

  @Column({ type: 'float', nullable: true, default: null })
  weatherLat!: number;

  @Column({ type: 'float', nullable: true, default: null })
  weatherLon!: number;

  @Column({ type: 'varchar', length: 1, default: 'F' })
  tempUnit!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
