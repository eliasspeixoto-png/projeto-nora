
'use server';

import { sendGmail } from '@/lib/mail/gmail';

/**
 * @fileOverview Server Actions para disparo de e-mails via Gmail API.
 */

export async function sendMarketingEmailAction(data: { to: string, subject: string, content: string }) {
    return await sendGmail({
        to: data.to,
        subject: data.subject,
        text: data.content,
    });
}

export async function sendQuoteEmailAction(data: { to: string, clientName: string, quoteNumber: string, pdfUrl: string, companyName: string }) {
    const subject = `Orçamento ${data.quoteNumber} - ${data.companyName}`;
    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2171ed; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Olá, ${data.clientName}</h1>
            </div>
            <div style="padding: 30px; line-height: 1.6; color: #1e293b;">
                <p>Segue o orçamento solicitado referente à <strong>${data.companyName}</strong>.</p>
                <p><strong>Nº do Documento:</strong> ${data.quoteNumber}</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.pdfUrl}" style="background-color: #2171ed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Visualizar Orçamento Completo</a>
                </div>
                <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    Este é um e-mail automático enviado pelo sistema NORA Pro via Gmail API.
                </p>
            </div>
        </div>
    `;

    return await sendGmail({
        to: data.to,
        subject,
        text: `Olá ${data.clientName}, segue o orçamento ${data.quoteNumber} da ${data.companyName}. Acesse em: ${data.pdfUrl}`,
        html
    });
}
