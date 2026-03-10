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

  @ManyToOne(() => User, (user) => user.savedItems, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'varchar', length: 40 })
  type!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true, default: null })
  subtitle!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true, default: null })
  sourceUrl!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true, default: null })
  imageUrl!: string;

  @Column({ type: 'varchar', length: 40, nullable: true, default: null })
  readTime!: string;

  @CreateDateColumn()
  savedAt!: Date;
}
