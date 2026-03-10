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

  @Column({ type: 'varchar', length: 120 })
  source!: string;

  @Column({ type: 'varchar', length: 80 })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true, default: null })
  description!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true, default: null })
  url!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true, default: null })
  imageUrl!: string;

  @Column({ type: 'text', nullable: true, default: null })
  rawJson!: string;

  @CreateDateColumn()
  fetchedAt!: Date;

  @Column({ type: 'date' })
  contentDate!: Date;
}
