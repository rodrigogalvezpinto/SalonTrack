import fs from 'node:fs';
import path from 'node:path';

export interface EmailResult {
  success: boolean;
  to: string;
  subject: string;
  simulated: boolean;
  sentAt: string;
  id?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

export class EmailProvider {
  async send(to: string, subject: string, html: string, text?: string): Promise<EmailResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();

    if (apiKey && from) {
      const apiBase = process.env.RESEND_API_BASE || 'https://api.resend.com';
      const response = await fetch(`${apiBase}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          ...(text ? { text } : {}),
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend API respondió con status ${response.status}.`);
      }
      const body = await response.json() as { id?: string };
      return {
        success: true,
        to,
        subject,
        simulated: false,
        sentAt: new Date().toISOString(),
        id: body.id,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('El correo transaccional no está configurado (RESEND_API_KEY / RESEND_FROM_EMAIL).');
    }

    const outboxDir = process.env.DEV_MAIL_DIR || path.join(process.cwd(), 'data', 'dev-mail');
    fs.mkdirSync(outboxDir, { recursive: true });
    const outboxFile = path.join(outboxDir, 'outbox.jsonl');
    fs.appendFileSync(
      outboxFile,
      JSON.stringify({ sentAt: new Date().toISOString(), to, subject, body: html }) + '\n',
      { mode: 0o600 },
    );
    console.log(`[Local Email Provider] Correo simulado a <${to}> guardado en ${path.relative(process.cwd(), outboxFile)}`);
    return {
      success: true,
      to,
      subject,
      simulated: true,
      sentAt: new Date().toISOString(),
    };
  }
}

export const emailProvider = new EmailProvider();
