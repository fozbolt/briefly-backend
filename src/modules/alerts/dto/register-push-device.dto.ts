import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/, {
    message: 'expoPushToken must be a valid Expo push token.',
  })
  expoPushToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  platform?: string;
}
