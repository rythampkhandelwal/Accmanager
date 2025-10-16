import { Env } from '../types';

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

function buildMailChannelsPayload(from: string, options: SendEmailOptions) {
  const content = [{ type: 'text/plain', value: options.text }];

  if (options.html) {
    content.push({ type: 'text/html', value: options.html });
  }

  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: options.to }],
      },
    ],
    from: {
      email: from,
    },
    subject: options.subject,
    content,
  };

  if (options.replyTo) {
    payload.reply_to = {
      email: options.replyTo,
    };
  }

  return payload;
}

/**
 * Sends an email using MailChannels (Cloudflare's recommended outbound mail provider).
 */
export async function sendEmail(env: Env, options: SendEmailOptions): Promise<void> {
  if (!env.SMTP_FROM) {
    throw new Error('SMTP_FROM secret is not configured');
  }

  const payload = buildMailChannelsPayload(env.SMTP_FROM, options);

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send email: ${response.status} ${body}`);
  }
}
