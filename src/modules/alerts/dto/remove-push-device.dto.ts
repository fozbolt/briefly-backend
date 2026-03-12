import { IsString, MaxLength, Matches } from 'class-validator';

export class RemovePushDeviceDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/, {
    message: 'expoPushToken must be a valid Expo push token.',
  })
  expoPushToken!: string;
}
