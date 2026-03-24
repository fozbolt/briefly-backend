import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Reject properties objects larger than 4 KB when serialized. */
@ValidatorConstraint({ name: 'maxJsonSize', async: false })
class MaxJsonSizeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object') return true;
    return JSON.stringify(value).length <= 4096;
  }
  defaultMessage(): string {
    return 'properties object exceeds maximum size of 4 KB';
  }
}

export class AnalyticsEventDto {
  @IsString()
  @MaxLength(64)
  event_name!: string;

  @IsString()
  @MaxLength(64)
  user_id!: string;

  @IsISO8601()
  @MaxLength(64)
  timestamp!: string;

  @IsString()
  @MaxLength(64)
  session_id!: string;

  @IsString()
  @MaxLength(24)
  device_type!: string;

  @IsString()
  @MaxLength(24)
  app_version!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;

  @IsOptional()
  @IsObject()
  @Validate(MaxJsonSizeConstraint)
  properties?: Record<string, unknown>;
}

export class TrackEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventDto)
  events!: AnalyticsEventDto[];
}
