import nodemailer from 'nodemailer';
import { sendGmail } from './gmail';
import { sendEmail as sendSendGrid } from './sendgrid';

interface SendUniversalEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  companyEmail?: string;
  companyAppPassword?: string;
  companyName?: string;
}

/**
 * @fileOverview Dispatcher Universal de E-mail para NORA Pro.
 * Tenta enviar via:
 * 1. SMTP Dinâmico da Empresa (companyEmail + companyAppPassword)
 * 2. SMTP das Variáveis de Ambiente / Senha de App Global
 * 3. SendGrid API (SENDGRID_API_KEY)
 * 4. Gmail API OAuth2 (GMAIL_CLIENT_ID + GMAIL_REFRESH_TOKEN)
 */
export async function sendUniversalEmail({ to, subject, text, html, companyEmail, companyAppPassword, companyName }: SendUniversalEmailParams) {
  // 1. Prioridade: SMTP Dinâmico da Empresa ou Variáveis Globais
  const smtpUser = companyEmail || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || 'contatoesp.tec@gmail.com';
  const smtpPass = (companyAppPassword ? companyAppPassword.replace(/\s+/g, '') : null) || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || 'nhhkbeocckssjzpp';
  const senderName = companyName || 'ESP-TEC / NORA Pro';

  if (smtpUser && smtpPass) {
    try {
      const host = process.env.SMTP_HOST || (smtpUser.includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp.gmail.com');
      const port = Number(process.env.SMTP_PORT) || 465;
      const secure = port === 465;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${smtpUser}>`,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>'),
      });

      return { success: true, messageId: info.messageId, provider: 'smtp', fromEmail: smtpUser };
    } catch (smtpErr: any) {
      console.warn('Falha no envio via SMTP, tentando provedores alternativos:', smtpErr.message);
    }
  }

  // 2. Prioridade: SendGrid API
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    try {
      const sgRes = await sendSendGrid({ to, subject, text, html });
      if (sgRes.success) {
        return { success: true, provider: 'sendgrid' };
      }
    } catch (sgErr: any) {
      console.warn('Falha no envio via SendGrid:', sgErr.message);
    }
  }

  // 3. Prioridade: Gmail API OAuth2
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    try {
      const gmailRes = await sendGmail({ to, subject, text, html });
      if (gmailRes.success) {
        return { success: true, messageId: gmailRes.messageId, provider: 'gmail_api' };
      }
      return { success: false, error: gmailRes.error };
    } catch (gErr: any) {
      return { success: false, error: gErr.message };
    }
  }

  return {
    success: false,
    error: 'Nenhum serviço de e-mail está configurado no servidor. Configure SMTP_USER + SMTP_PASS (Senha de App do Gmail) ou SENDGRID_API_KEY no painel de ambiente.',
  };
}
