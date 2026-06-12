
import { google } from 'googleapis';

/**
 * @fileOverview Serviço de integração com Gmail API via OAuth2.
 * Requer Client ID, Client Secret e Refresh Token configurados no .env.
 */

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER || 'nora.siste@gmail.com';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

if (REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
}

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendGmail({ to, subject, text, html }: SendEmailParams) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error('Gmail API Error: Credenciais OAuth2 incompletas no .env.');
    return { success: false, error: 'Configuração de e-mail (Gmail API) incompleta no servidor.' };
  }

  try {
    // Codifica o assunto para suportar caracteres especiais
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    
    const messageParts = [
      `From: NORA Sistema <${GMAIL_USER}>`,
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      html || text.replace(/\n/g, '<br>'),
    ];
    
    const message = messageParts.join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return { success: true, messageId: res.data.id };
  } catch (error: any) {
    console.error('Error sending email via Gmail API:', error);
    return { 
      success: false, 
      error: error.message || 'Falha ao disparar e-mail pelo Gmail.' 
    };
  }
}
