/**
 * @fileOverview Cliente de Integração para WhatsApp Gateway via QR Code (Evolution API / Baileys)
 */

export interface WhatsappStatus {
    connected: boolean;
    state: 'open' | 'connecting' | 'close';
    qrCodeBase64?: string;
    instanceName?: string;
    phone?: string;
}

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://api.evolution.nora.com.br';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'nora_whatsapp_secret_key';

/**
 * Busca o status da conexão ou o QR Code atualizado para escaneamento.
 */
export async function getWhatsappQrCode(companyId: string): Promise<WhatsappStatus> {
    const instanceName = `NORA_${companyId.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            await createWhatsappInstance(instanceName);
            return {
                connected: false,
                state: 'connecting',
                instanceName
            };
        }

        const data = await response.json();
        
        if (data.instance?.state === 'open') {
            return {
                connected: true,
                state: 'open',
                instanceName,
                phone: data.instance?.ownerJid?.split('@')[0]
            };
        }

        return {
            connected: false,
            state: 'connecting',
            qrCodeBase64: data.base64 || data.qrcode?.base64,
            instanceName
        };
    } catch (error: any) {
        console.error('[WHATSAPP API] Erro ao buscar QR Code:', error);
        return {
            connected: false,
            state: 'close',
            instanceName
        };
    }
}

/**
 * Cria uma nova instância de WhatsApp no servidor Gateway.
 */
export async function createWhatsappInstance(instanceName: string) {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instanceName,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            })
        });

        return await response.json();
    } catch (error) {
        console.error('[WHATSAPP API] Erro ao criar instância:', error);
        return null;
    }
}

/**
 * Envia uma mensagem de texto de resposta para um número no WhatsApp.
 */
export async function sendWhatsappMessage(instanceName: string, number: string, text: string) {
    const cleanNumber = number.replace(/\D/g, '');
    const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: formattedNumber,
                options: {
                    delay: 1200,
                    presence: 'composing'
                },
                textMessage: {
                    text
                }
            })
        });

        return await response.json();
    } catch (error) {
        console.error('[WHATSAPP API] Erro ao enviar mensagem:', error);
        return { error: 'Falha no disparo do WhatsApp' };
    }
}

/**
 * Desconecta a sessão atual do WhatsApp.
 */
export async function logoutWhatsappInstance(instanceName: string) {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });
        return await response.json();
    } catch (error) {
        console.error('[WHATSAPP API] Erro ao desconectar:', error);
        return { error: 'Falha ao desconectar' };
    }
}
