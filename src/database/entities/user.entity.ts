import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserPreference } from './user-preference.entity';
import { SavedItem } from './saved-item.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  avatarUrl!: string;

  @Column({ type: 'varchar', default: 'Explorer' })
  level!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => UserPreference, (pref) => pref.user, { cascade: true })
  preferences!: UserPreference;

  @OneToMany(() => SavedItem, (item) => item.user)
  savedItems!: SavedItem[];
}
