
import sgMail from '@sendgrid/mail';

/**
 * @fileOverview Serviço de integração com SendGrid para envio de e-mails transacionais.
 */

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams) {
  if (!apiKey || !fromEmail) {
    console.error('SendGrid Error: API Key or From Email not configured.');
    return { success: false, error: 'Configuração de e-mail incompleta.' };
  }

  const msg = {
    to,
    from: fromEmail,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br>'),
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending email via SendGrid:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    return { success: false, error: error.message || 'Falha ao disparar e-mail.' };
  }
}
