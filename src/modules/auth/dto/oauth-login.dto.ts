import { IsString, MaxLength, MinLength } from 'class-validator';

export class OAuthLoginDto {
  @IsString()
  @MinLength(4)
  @MaxLength(2048)
  deviceAuthCode!: string;
}
