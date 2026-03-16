import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SendVerificationEmailInput {
  recipientEmail: string;
  recipientName: string;
  verificationUrl: string;
  expiresAt: Date;
}

export interface SendPasswordResetEmailInput {
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  expiresAt: Date;
}

export interface SendVerificationEmailResult {
  delivered: boolean;
  provider: 'resend' | 'console';
}

@Injectable()
export class AuthMailerService {
  private readonly logger = new Logger(AuthMailerService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationEmail(
    input: SendVerificationEmailInput,
  ): Promise<SendVerificationEmailResult> {
    const provider =
      (this.configService.get<string>('email.provider') || 'console').toLowerCase() === 'resend'
        ? 'resend'
        : 'console';

    if (provider === 'resend') {
      const delivered = await this.sendViaResend(input);
      return { delivered, provider };
    }

    this.logVerificationLink(input);
    return { delivered: true, provider: 'console' };
  }

  async sendPasswordResetEmail(
    input: SendPasswordResetEmailInput,
  ): Promise<SendVerificationEmailResult> {
    const provider =
      (this.configService.get<string>('email.provider') || 'console').toLowerCase() === 'resend'
        ? 'resend'
        : 'console';

    if (provider === 'resend') {
      const delivered = await this.sendPasswordResetViaResend(input);
      return { delivered, provider };
    }

    this.logPasswordResetLink(input);
    return { delivered: true, provider: 'console' };
  }

  private async sendViaResend(input: SendVerificationEmailInput): Promise<boolean> {
    const apiKey = this.configService.get<string>('email.resendApiKey') || '';
    const from = this.configService.get<string>('email.from') || '';
    const replyTo = this.configService.get<string>('email.replyTo') || '';

    if (!apiKey || !from) {
      this.logger.warn(
        'EMAIL_PROVIDER=resend configured without RESEND_API_KEY or EMAIL_FROM. Falling back to log-only mode.',
      );
      this.logVerificationLink(input);
      return false;
    }

    const text = [
      `Hi ${input.recipientName},`,
      '',
      'Please confirm your Briefly account email by opening the link below:',
      input.verificationUrl,
      '',
      `This link expires at ${input.expiresAt.toISOString()}.`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#0f172a;">
        <p>Hi ${this.escapeHtml(input.recipientName)},</p>
        <p>Please confirm your Briefly account email by clicking below:</p>
        <p>
          <a href="${this.escapeHtml(input.verificationUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:600;">
            Verify Email
          </a>
        </p>
        <p style="font-size:13px;color:#475569;">This link expires at ${this.escapeHtml(input.expiresAt.toISOString())}.</p>
      </div>
    `;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from,
          to: [input.recipientEmail],
          reply_to: replyTo || undefined,
          subject: 'Confirm your Briefly email',
          html,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown resend error';
      this.logger.error(`Resend delivery failed: ${message}`);
      this.logVerificationLink(input);
      return false;
    }
  }

  private async sendPasswordResetViaResend(
    input: SendPasswordResetEmailInput,
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>('email.resendApiKey') || '';
    const from = this.configService.get<string>('email.from') || '';
    const replyTo = this.configService.get<string>('email.replyTo') || '';

    if (!apiKey || !from) {
      this.logger.warn(
        'EMAIL_PROVIDER=resend configured without RESEND_API_KEY or EMAIL_FROM. Falling back to log-only mode.',
      );
      this.logPasswordResetLink(input);
      return false;
    }

    const text = [
      `Hi ${input.recipientName},`,
      '',
      'We received a request to reset your Briefly password.',
      'Open the link below to choose a new password:',
      input.resetUrl,
      '',
      `This link expires at ${input.expiresAt.toISOString()}.`,
      'If you did not request this change, you can safely ignore this email.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#0f172a;">
        <p>Hi ${this.escapeHtml(input.recipientName)},</p>
        <p>We received a request to reset your Briefly password.</p>
        <p>
          <a href="${this.escapeHtml(input.resetUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:600;">
            Reset Password
          </a>
        </p>
        <p style="font-size:13px;color:#475569;">This link expires at ${this.escapeHtml(input.expiresAt.toISOString())}.</p>
        <p style="font-size:13px;color:#475569;">If you did not request this change, you can safely ignore this email.</p>
      </div>
    `;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from,
          to: [input.recipientEmail],
          reply_to: replyTo || undefined,
          subject: 'Reset your Briefly password',
          html,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown resend error';
      this.logger.error(`Resend password reset delivery failed: ${message}`);
      this.logPasswordResetLink(input);
      return false;
    }
  }

  private logVerificationLink(input: SendVerificationEmailInput): void {
    this.logger.log(
      `Email verification link for ${input.recipientEmail}: ${input.verificationUrl} (expires ${input.expiresAt.toISOString()})`,
    );
  }

  private logPasswordResetLink(input: SendPasswordResetEmailInput): void {
    this.logger.log(
      `Password reset link for ${input.recipientEmail}: ${input.resetUrl} (expires ${input.expiresAt.toISOString()})`,
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
