import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class OAuthLoginDto {
  @IsString()
  @MinLength(4)
  @MaxLength(2048)
  deviceAuthCode!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
