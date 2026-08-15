
'use server';

import { sendUniversalEmail } from '@/lib/mail/dispatcher';

/**
 * @fileOverview Server Actions para disparo de e-mails transacionais via Dispatcher Universal (SMTP/Gmail/SendGrid).
 */

export async function sendMarketingEmailAction(data: { to: string, subject: string, content: string }) {
    return await sendUniversalEmail({
        to: data.to,
        subject: data.subject,
        text: data.content,
    });
}

export async function sendQuoteEmailAction(data: { 
    to: string; 
    clientName: string; 
    quoteNumber: string; 
    pdfUrl: string; 
    companyName: string;
    companyEmail?: string;
    companyAppPassword?: string;
}) {
    const subject = `Orçamento ${data.quoteNumber} - ${data.companyName}`;
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0f172a; padding: 28px; text-align: center;">
                <h2 style="color: #38bdf8; margin: 0; font-size: 22px; font-weight: bold;">${data.companyName}</h2>
                <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Proposta Comercial & Orçamento</p>
            </div>
            <div style="padding: 32px; line-height: 1.6; color: #1e293b;">
                <h3 style="color: #0f172a; margin-top: 0;">Olá, ${data.clientName}!</h3>
                <p>Segue a proposta de orçamento solicitada referente à <strong>${data.companyName}</strong>.</p>
                
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Nº da Proposta:</strong> ${data.quoteNumber}</p>
                    <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Status:</strong> Disponível para Aprovação</p>
                </div>

                <div style="text-align: center; margin: 32px 0;">
                    <a href="${data.pdfUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
                        Visualizar Orçamento / Baixar PDF ↗
                    </a>
                </div>

                <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                    Você pode aprovar ou tirar dúvidas sobre este projeto respondendo a este e-mail.
                </p>

                <p style="font-size: 12px; color: #94a3b8; margin-top: 36px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    Este é um e-mail gerado automaticamente pelo sistema NORA Pro em nome de ${data.companyName}.
                </p>
            </div>
        </div>
    `;

    return await sendUniversalEmail({
        to: data.to,
        subject,
        text: `Olá ${data.clientName}, segue o orçamento ${data.quoteNumber} da ${data.companyName}. Acesse a proposta completa em: ${data.pdfUrl}`,
        html,
        companyEmail: data.companyEmail,
        companyAppPassword: data.companyAppPassword,
        companyName: data.companyName,
    });
}
