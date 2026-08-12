import { NextResponse } from 'next/server';
import { noraFlow } from '@/app/api/xcot/flow';
import { sendWhatsappMessage } from '@/lib/whatsapp/evolution-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Estrutura padrão de eventos de mensagem do WhatsApp (Evolution API / Baileys)
        const event = body.event;
        const data = body.data;

        if (event === 'messages.upsert' && data && !data.key?.fromMe) {
            const remoteJid = data.key?.remoteJid || '';
            const senderNumber = remoteJid.split('@')[0];
            
            // Extrai mensagem de texto
            const messageText = data.message?.conversation || 
                               data.message?.extendedTextMessage?.text || 
                               data.message?.imageMessage?.caption || '';

            if (messageText && senderNumber) {
                console.log(`[WHATSAPP WEBHOOK] Mensagem recebida de ${senderNumber}: "${messageText}"`);

                // Executa a IA NORA Pro com o contexto do número
                const noraResult = await noraFlow({
                    messages: [{ role: 'user', content: messageText }],
                    userContext: {
                        uid: `wa_${senderNumber}`,
                        companyId: 'DEFAULT_COMPANY',
                        companyName: 'NORA Segurança',
                        role: 'admin',
                        displayName: `Cliente (${senderNumber})`,
                        currentPath: '/whatsapp'
                    }
                });

                if (noraResult && noraResult.response) {
                    // Limpa formatação Markdown pesada para texto limpo no WhatsApp
                    const cleanWhatsappText = noraResult.response
                        .replace(/\[\[ azul: (.*?) \]\]/g, '*$1*')
                        .replace(/\*\*(.*?)\*\*/g, '*$1*');

                    const instanceName = body.instance || 'NORA_DEFAULT_COMPANY';
                    await sendWhatsappMessage(instanceName, senderNumber, cleanWhatsappText);
                }
            }
        }

        return NextResponse.json({ status: 'success' });
    } catch (error: any) {
        console.error('[WHATSAPP WEBHOOK] Erro no processamento:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno no webhook' },
            { status: 500 }
        );
    }
}
