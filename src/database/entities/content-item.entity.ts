import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('content_items')
export class ContentItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  source!: string;

  @Column({ type: 'varchar' })
  category!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true, default: null })
  description!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  url!: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  imageUrl!: string;

  @Column({ type: 'text', nullable: true, default: null })
  rawJson!: string;

  @CreateDateColumn()
  fetchedAt!: Date;

  @Column({ type: 'date' })
  contentDate!: Date;
}
