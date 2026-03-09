import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('saved_items')
export class SavedItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.savedItems)
  user!: User;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true, default: null })
  subtitle!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  sourceUrl!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  imageUrl!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  readTime!: string;

  @CreateDateColumn()
  savedAt!: Date;
}
