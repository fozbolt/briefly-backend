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
import { EmailVerificationToken } from './email-verification-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 512, nullable: true, default: null })
  avatarUrl!: string;

  @Column({ type: 'varchar', length: 32, default: 'Explorer' })
  level!: string;

  @Column({ type: 'varchar', length: 32, default: 'local' })
  authProvider!: string;

  @Column({ type: 'varchar', length: 128, nullable: true, default: null, select: false })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null, select: false })
  passwordSalt!: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'datetime', nullable: true, default: null })
  emailVerifiedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => UserPreference, (pref) => pref.user, { cascade: true })
  preferences!: UserPreference;

  @OneToMany(() => SavedItem, (item) => item.user, { cascade: ['remove'] })
  savedItems!: SavedItem[];

  @OneToMany(() => EmailVerificationToken, (token) => token.user, { cascade: ['remove'] })
  emailVerificationTokens!: EmailVerificationToken[];
}
