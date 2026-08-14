/**
 * @fileOverview Servidor Nativo WhatsApp Baileys para NORA AI.
 * Conecta diretamente ao WhatsApp Web sem passar pelo Facebook/Meta.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { transcribeAudioBuffer } = require('./transcribe');
const { textToSpeechBuffer } = require('./tts');
const admin = require('firebase-admin');
const { useFirestoreAuthState } = require('./use-firestore-auth');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6KPNlZlSMqfTnDFoUHKi6jd4a_SG20hNif8Ia6bdKIPgA';

/**
 * Envia uma imagem em Base64 para o Gemini 2.5 Flash para extração de texto e contexto visual.
 */
async function analyzeImageWithGemini(base64Image, mimeType = 'image/jpeg') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{
            parts: [
                { text: "Você é os olhos de um sistema de gestão. Descreva brevemente o que você vê nesta imagem. Se identificar que é uma Nota Fiscal, você DEVE extrair os dados dela em formato estruturado contendo: numero, serie, dataEmissao, fornecedor (nome e CNPJ), valorTotal e itens. Se identificar que é um Comprovante de Pagamento (PIX, TED, Boleto pago), você DEVE extrair: valorPago, pagadorNome, recebedorNome, dataPagamento, e idTransacao. Se houver outro tipo de texto escrito, transcreva todo o texto com máxima precisão. Descreva os campos e erros visíveis." },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Image
                    }
                }
            ]
        }]
    };

    return new Promise((resolve) => {
        const https = require('https');
        const reqData = JSON.stringify(payload);
        
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(reqData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
                        resolve(json.candidates[0].content.parts[0].text.trim());
                    } else {
                        console.error("⚠️ [GEMINI ERROR] Resposta inesperada ou erro:", JSON.stringify(json, null, 2));
                        resolve(null);
                    }
                } catch (e) {
                    console.error("Gemini parse erro:", e, "Raw data:", data);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error("Erro de rede ao acessar Gemini:", e);
            resolve(null);
        });

        req.write(reqData);
        req.end();
    });
}

// Inicializa o Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-2629657699-721b1.appspot.com'
    });
}
const db = admin.firestore();
const whatsappAuthCollection = db.collection('whatsapp_auth_v3');

let latestQrCodeBase64 = null;
let connectionStatus = 'connecting';
let connectedPhone = null;
let globalSock = null;

// Formata o número do WhatsApp recebido para os formatos salvos no Firestore
function formatPhoneVariations(jid) {
    const num = jid.split('@')[0];
    if (num.startsWith('55') && num.length >= 12) {
        const ddd = num.substring(2, 4);
        const digits = num.substring(4);
        let forms = [];
        if (digits.length === 9) {
            forms.push(`(${ddd}) ${digits.substring(0,5)}-${digits.substring(5)}`); // Ex: (79) 99547-8211
            forms.push(`(${ddd}) ${digits.substring(1,5)}-${digits.substring(5)}`); // Ex: (79) 9547-8211
        } else if (digits.length === 8) {
            forms.push(`(${ddd}) ${digits.substring(0,4)}-${digits.substring(4)}`); // Ex: (79) 9547-8211
            forms.push(`(${ddd}) 9${digits.substring(0,4)}-${digits.substring(4)}`); // Ex: (79) 99547-8211
        }
        forms.push(num); // Ex: 5579995478211
        forms.push(digits); // Ex: 995478211
        forms.push(`+${num}`);
        return forms;
    }
    return [num];
}

// Busca o usuário ou cliente no Firestore
async function lookupUserOrClient(remoteJid) {
    const phones = formatPhoneVariations(remoteJid);
    
    // 1. Tenta achar na coleção de usuários (funcionários)
    let snap = await db.collection('users').where('phone', 'in', phones).limit(1).get();
    if (snap.empty) snap = await db.collection('users').where('whatsapp', 'in', phones).limit(1).get();
    if (!snap.empty) {
        const u = snap.docs[0].data();
        return {
            companyId: u.companyId,
            role: u.role || 'user',
            displayName: u.displayName || u.name || 'Funcionário'
        };
    }

    // 2. Tenta achar na coleção de clientes
    let clientSnap = await db.collection('clients').where('phone', 'in', phones).limit(1).get();
    if (clientSnap.empty) clientSnap = await db.collection('clients').where('whatsapp', 'in', phones).limit(1).get();
    if (!clientSnap.empty) {
        const c = clientSnap.docs[0].data();
        return {
            companyId: c.companyId,
            role: 'client',
            displayName: c.name || 'Cliente'
        };
    }

    return null; // Desconhecido
}

async function startBaileys() {
    const { state, saveCreds } = await useFirestoreAuthState(whatsappAuthCollection);
    const { version } = await fetchLatestBaileysVersion();
    console.log(`WA version: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ['Mac OS', 'Chrome', '121.0.0.0']
    });
    globalSock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n==================================================');
            console.log('⚡ ESCANIE O QR CODE ABAIXO COM SEU CELULAR:');
            console.log('==================================================\n');
            qrcodeTerminal.generate(qr, { small: true });

            try {
                latestQrCodeBase64 = await QRCode.toDataURL(qr);
            } catch (err) {
                console.error('Erro ao converter QR Code:', err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            connectionStatus = 'close';
            if (shouldReconnect) {
                setTimeout(startBaileys, 3000);
            }
        } else if (connection === 'open') {
            console.log('\n✅ CONECTADO COM SUCESSO AO WHATSAPP DA NORA!');
            connectionStatus = 'open';
            latestQrCodeBase64 = null;
            connectedPhone = sock.user?.id?.split(':')[0] || 'Conectado';
        }
    });

    // Escuta mensagens recebidas no WhatsApp
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || msg.key.fromMe || !msg.message) return;

        // Resolve o problema de LIDs (números ocultos por conta de privacidade/multi-device)
        const remoteJid = msg.key.remoteJidAlt || msg.key.remoteJid;
        
        console.log(`📩 [MENSAGEM RECEBIDA] De: ${remoteJid} (LID original: ${msg.key.remoteJid}) | Chaves:`, Object.keys(msg.message));

        let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption;

        const hasAudio = !!(
            msg.message.audioMessage || 
            msg.message.ephemeralMessage?.message?.audioMessage ||
            msg.message.viewOnceMessageV2?.message?.audioMessage ||
            msg.message.viewOnceMessage?.message?.audioMessage ||
            msg.message.documentWithCaptionMessage?.message?.audioMessage
        );

        // Se a mensagem recebida for um ÁUDIO/NOTA DE VOZ
        if (!text && hasAudio) {
            console.log(`\n🎙️ [ÁUDIO RECEBIDO] Baixando nota de voz de ${remoteJid}...`);
            try {
                await sock.sendPresenceUpdate('recording', remoteJid);
                const audioBuffer = await downloadMediaMessage(msg, 'buffer', {});
                console.log(`🎙️ [ÁUDIO BAIXADO] ${audioBuffer.length} bytes. Transcrevendo para texto...`);

                const transcribedText = await transcribeAudioBuffer(audioBuffer);
                if (transcribedText) {
                    console.log(`📝 [ÁUDIO TRANSSCRITO COM SUCESSO]: "${transcribedText}"`);
                    text = `[Áudio enviado pelo usuário]: "${transcribedText}"`;
                } else {
                    console.warn("⚠️ Não foi possível converter o áudio em texto.");
                    await sock.sendMessage(remoteJid, { text: "Desculpe, não consegui compreender o áudio perfeitamente. Poderia enviar novamente ou mandar por mensagem de texto? 😊" });
                    return;
                }
            } catch (audioErr) {
                console.error("Erro ao baixar/transcrever áudio do WhatsApp:", audioErr);
                return;
            }
        }

        const imageMessage = 
            msg.message.imageMessage || 
            msg.message.ephemeralMessage?.message?.imageMessage ||
            msg.message.viewOnceMessageV2?.message?.imageMessage ||
            msg.message.viewOnceMessage?.message?.imageMessage ||
            msg.message.documentWithCaptionMessage?.message?.documentMessage ||
            msg.message.documentMessage;

        const isMedia = imageMessage && (imageMessage.mimetype?.startsWith('image/') || imageMessage.mimetype === 'application/pdf' || msg.message.imageMessage);

        // Se a mensagem recebida for uma IMAGEM ou PDF (Documento)
        if (isMedia) {
            console.log(`\n📸 [MÍDIA RECEBIDA] Baixando mídia (Imagem/PDF) de ${remoteJid}...`);
            try {
                const imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
                const base64Image = imageBuffer.toString('base64');
                const mimeType = imageMessage.mimetype || 'image/jpeg';
                
                console.log(`📸 [IMAGEM BAIXADA] Fazendo upload para o Storage...`);
                const bucket = admin.storage().bucket();
                const fileName = `whatsapp_media/${remoteJid}/${Date.now()}.jpg`;
                const file = bucket.file(fileName);
                await file.save(imageBuffer, { metadata: { contentType: mimeType } });
                const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
                
                console.log(`📸 [IMAGEM BAIXADA] Processando no Gemini Vision...`);
                const geminiDescription = await analyzeImageWithGemini(base64Image, mimeType);
                
                if (geminiDescription) {
                    console.log(`👁️ [GEMINI VISION RESULTADO]:\n${geminiDescription}`);
                    const userCaption = text ? `\n\nLegenda do usuário: "${text}"` : '';
                    text = `[IMAGEM RECEBIDA] Arquivo original: ${publicUrl}\nO assistente visual descreveu a imagem enviada assim:\n"${geminiDescription}"${userCaption}`;
                } else {
                    console.warn("⚠️ Gemini não conseguiu descrever a imagem.");
                    if (!text) {
                        text = "[IMAGEM RECEBIDA] O assistente visual falhou em analisar a imagem, e o usuário não enviou legenda.";
                    } else {
                        text = `[IMAGEM RECEBIDA] (Falha no assistente visual). Legenda do usuário: "${text}"`;
                    }
                }
            } catch (imgErr) {
                console.error("Erro ao processar imagem recebida:", imgErr);
            }
        }

        if (text && remoteJid) {
            console.log(`\n📲 [WHATSAPP RECEBIDO] De: ${remoteJid} -> "${text}"`);

            // 🚀 VERIFICAÇÃO DE WHITELIST (BARREIRA DE SEGURANÇA)
            const resolvedUser = await lookupUserOrClient(remoteJid);
            if (!resolvedUser) {
                console.log(`❌ [MENSAGEM BLOQUEADA] O número ${remoteJid} não está cadastrado em nenhuma empresa no Firestore. Mensagem ignorada.`);
                return; // Para o fluxo aqui! O bot não responde nada e ignora.
            }

            console.log(`✅ [ACESSO PERMITIDO] Identificado: ${resolvedUser.displayName} (Empresa: ${resolvedUser.companyId} | Papel: ${resolvedUser.role})`);

            if (!global.waResponseModes) global.waResponseModes = new Map();
            const lowerText = text.trim().toLowerCase();

            // Comandos rápidos de alteração do Modo de Resposta
            if (/\b(modo\s*voz|responder\s*por\s*voz|ativar\s*voz|responda\s*modo\s*voz|modo\s*de\s*voz)\b/i.test(lowerText)) {
                global.waResponseModes.set(remoteJid, 'voice');
                await sock.sendMessage(remoteJid, { text: "🔊 *Modo Voz Ativado!* A partir de agora vou te responder sempre por notas de voz no WhatsApp." });
                return;
            }
            if (/\b(modo\s*texto|responder\s*por\s*texto|ativar\s*texto|responda\s*modo\s*texto|modo\s*de\s*texto)\b/i.test(lowerText)) {
                global.waResponseModes.set(remoteJid, 'text');
                await sock.sendMessage(remoteJid, { text: "📝 *Modo Texto Ativado!* A partir de agora vou te responder sempre por mensagens de texto." });
                return;
            }
            if (/\b(modo\s*auto|modo\s*automatico)\b/i.test(lowerText)) {
                global.waResponseModes.set(remoteJid, 'auto');
                await sock.sendMessage(remoteJid, { text: "⚡ *Modo Automático Ativado!* Vou responder por voz quando você mandar áudio, e por texto quando você mandar mensagem." });
                return;
            }
            if (/\b(modo\s*ambos)\b/i.test(lowerText)) {
                global.waResponseModes.set(remoteJid, 'both');
                await sock.sendMessage(remoteJid, { text: "🎙️📝 *Modo Ambos Ativado!* Vou te enviar a resposta em texto e a nota de voz simultaneamente." });
                return;
            }
            
            try {
                // Envia sinal de digitando ou gravando áudio
                await sock.sendPresenceUpdate('composing', remoteJid);

                // Memória de histórico da conversa por remetente (limpa alucinações de erros antigos)
                if (!global.waChatHistory) global.waChatHistory = new Map();
                let userHistory = (global.waChatHistory.get(remoteJid) || [])
                    .filter((m) => !m.content || !m.content.includes('instabilidade na busca de produtos'));
                
                userHistory.push({ role: 'user', content: text });
                if (userHistory.length > 20) userHistory = userHistory.slice(-20);
                global.waChatHistory.set(remoteJid, userHistory);

                // Chama o endpoint da NORA (URL de Produção ou Local)
                const targetApiUrl = process.env.NORA_API_URL 
                    ? `${process.env.NORA_API_URL.replace(/\/$/, '')}/api/xcot` 
                    : `http://localhost:${process.env.PORT || 3000}/api/xcot`;

                console.log(`🤖 [CHAMANDO NORA AI] Target: ${targetApiUrl}`);

                const fetchOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: userHistory,
                        userContext: {
                            uid: `wa_${remoteJid.split('@')[0]}`,
                            companyId: resolvedUser.companyId,
                            companyName: 'NORA Parceiro', // Este campo poderia ser buscado se necessário
                            role: resolvedUser.role,
                            displayName: resolvedUser.displayName,
                            currentPath: '/whatsapp'
                        }
                    })
                };

                const noraResponse = await fetch(targetApiUrl, fetchOptions);
                const parsed = await noraResponse.json();
                const responseText = parsed.response || 'Desculpe, ocorreu um erro ao processar.';

                // Adiciona resposta da NORA ao histórico da conversa
                userHistory.push({ role: 'assistant', content: responseText });
                if (userHistory.length > 20) userHistory = userHistory.slice(-20);
                global.waChatHistory.set(remoteJid, userHistory);

                // Formata o texto para WhatsApp
                const cleanText = responseText
                    .replace(/\[\[ azul: (.*?) \]\]/g, '*$1*')
                    .replace(/\*\*(.*?)\*\*/g, '*$1*');

                const currentMode = global.waResponseModes.get(remoteJid) || 'auto';
                const isIncomingAudio = hasAudio;
                const shouldSendVoice = (currentMode === 'voice' || currentMode === 'both' || (currentMode === 'auto' && isIncomingAudio));
                const shouldSendText = (currentMode === 'text' || currentMode === 'both' || (currentMode === 'auto' && !isIncomingAudio));

                // 1. Envia resposta em Texto se aplicável
                if (shouldSendText) {
                    await sock.sendMessage(remoteJid, { text: cleanText });
                    console.log(`🤖 [NORA TEXTO RESPONSES] Enviado para ${remoteJid}`);
                }

                // 2. Envia resposta em Nota de Voz (Áudio PTT) se aplicável
                if (shouldSendVoice) {
                    console.log(`🎙️ [ENVIANDO NOTA DE VOZ] Sintetizando voz da NORA para ${remoteJid}...`);
                    try {
                        await sock.sendPresenceUpdate('recording', remoteJid);
                        const voiceBuffer = await textToSpeechBuffer(responseText, 'Elias');
                        if (voiceBuffer) {
                            await sock.sendMessage(remoteJid, {
                                audio: voiceBuffer,
                                mimetype: 'audio/ogg; codecs=opus',
                                ptt: true
                            });
                            console.log(`🎙️ [NORA VOZ RESPONSES] Nota de voz entregue para ${remoteJid}`);
                        } else if (!shouldSendText) {
                            await sock.sendMessage(remoteJid, { text: cleanText });
                        }
                    } catch (voiceErr) {
                        console.error("Erro ao enviar resposta de voz:", voiceErr);
                        if (!shouldSendText) {
                            await sock.sendMessage(remoteJid, { text: cleanText });
                        }
                    }
                }
                return;

            } catch (err) {
                console.error('Erro ao enviar mensagem pelo WhatsApp:', err);
            }
        }
    });
}

// Servidor HTTP simples na porta 8080 para fornecer o QR Code real em HTML
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if ((req.method === 'DELETE' || req.method === 'POST') && (req.url === '/logout' || req.url === '/reset')) {
        try {
            console.log('🔄 [LOGOUT/RESET] Solicitado resete da sessão do WhatsApp...');
            if (globalSock) {
                try { globalSock.logout(); } catch(e){}
                try { globalSock.end(); } catch(e){}
            }
            connectionStatus = 'connecting';
            latestQrCodeBase64 = null;
            connectedPhone = null;

            // Apaga as chaves antigas do Firestore
            try {
                const snapshot = await whatsappAuthCollection.get();
                const batch = db.batch();
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log('✅ Sessão removida do Firestore com sucesso.');
            } catch (err) {
                console.error('Erro ao deletar sessão do Firestore:', err);
            }

            setTimeout(() => {
                startBaileys();
            }, 1000);

            res.writeHead(200);
            return res.end(JSON.stringify({ success: true, message: 'Sessão resetada com sucesso. Novo QR Code será gerado.' }));
        } catch (err) {
            console.error('Erro ao resetar sessão:', err);
            res.writeHead(500);
            return res.end(JSON.stringify({ error: err.message }));
        }
    } else if (req.method === 'POST' && (req.url === '/send' || req.url === '/api/whatsapp/send')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { number, text } = JSON.parse(body);
                if (!number || !text) {
                    res.writeHead(400);
                    return res.end(JSON.stringify({ error: 'Parâmetros "number" e "text" são obrigatórios.' }));
                }

                if (!globalSock || connectionStatus !== 'open') {
                    res.writeHead(503);
                    return res.end(JSON.stringify({ error: 'WhatsApp não está conectado no momento.' }));
                }

                const cleanNumber = number.replace(/\D/g, '');
                const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
                let targetJid = `${formattedNumber}@s.whatsapp.net`;

                // Consulta os servidores do WhatsApp para resolver o JID oficial (com ou sem o 9º dígito)
                try {
                    const results = await globalSock.onWhatsApp(formattedNumber);
                    if (results && results.length > 0 && results[0].exists) {
                        targetJid = results[0].jid;
                        console.log(`📱 [JID RESOLVIDO] ${formattedNumber} -> JID oficial WhatsApp: ${targetJid}`);
                    } else if (formattedNumber.length === 13 && formattedNumber.startsWith('55')) {
                        // Tenta remover o 9º dígito se a primeira tentativa falhar
                        const without9 = formattedNumber.slice(0, 4) + formattedNumber.slice(5);
                        const altResults = await globalSock.onWhatsApp(without9);
                        if (altResults && altResults.length > 0 && altResults[0].exists) {
                            targetJid = altResults[0].jid;
                            console.log(`📱 [JID RESOLVIDO ALT] ${without9} -> JID oficial WhatsApp: ${targetJid}`);
                        }
                    }
                } catch (e) {
                    console.error('Aviso ao consultar onWhatsApp:', e.message);
                }

                await globalSock.sendMessage(targetJid, { text });
                console.log(`🚀 [DISPARO DIRETO] Mensagem entregue no WhatsApp para ${targetJid}: "${text}"`);
                
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, jid: targetJid }));
            } catch (err) {
                console.error('Erro no envio de mensagem via /send:', err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else if (req.url === '/qr' || req.url === '/api/whatsapp/qr') {
        res.writeHead(200);
        res.end(JSON.stringify({
            connected: connectionStatus === 'open',
            state: connectionStatus,
            qrCodeBase64: latestQrCodeBase64,
            phone: connectedPhone
        }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

async function startReminderPoller() {
    setInterval(async () => {
        if (!globalSock || connectionStatus !== 'open') return;
        
        try {
            const now = new Date();
            const snap = await db.collection('scheduled_messages').where('status', '==', 'pending').get();
            
            for (const doc of snap.docs) {
                const data = doc.data();
                if (!data.scheduledAt) continue;
                
                const scheduledDate = new Date(data.scheduledAt);
                
                if (scheduledDate <= now) {
                    console.log(`⏰ [LEMBRETE] Disparando lembrete agendado para ${data.recipientName} (${data.phone})`);
                    
                    const cleanNumber = data.phone.replace(/\D/g, '');
                    const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
                    let targetJid = `${formattedNumber}@s.whatsapp.net`;
                    
                    try {
                        const results = await globalSock.onWhatsApp(formattedNumber);
                        if (results && results.length > 0 && results[0].exists) {
                            targetJid = results[0].jid;
                        } else if (formattedNumber.length === 13 && formattedNumber.startsWith('55')) {
                            const without9 = formattedNumber.slice(0, 4) + formattedNumber.slice(5);
                            const altResults = await globalSock.onWhatsApp(without9);
                            if (altResults && altResults.length > 0 && altResults[0].exists) {
                                targetJid = altResults[0].jid;
                            }
                        }
                    } catch(e) {}

                    await globalSock.sendMessage(targetJid, { text: data.messageText });
                    
                    // Marca como enviado em vez de deletar, para fins de log/auditoria
                    await doc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
                }
            }
        } catch (e) {
            console.error('Erro no poller de lembretes:', e.message);
        }
    }, 60000); // Checa a cada 60 segundos
}

async function startNoraCronPoller() {
    // Roda a cada 30 minutos (1800000 ms)
    setInterval(async () => {
        if (!globalSock || connectionStatus !== 'open') return;
        console.log('⏰ [NORA CRON] Iniciando varredura proativa...');

        try {
            // Data limite de segurança: 14/08/2026 (não atuar em nada antes disso)
            const safetyDate = new Date('2026-08-14T00:00:00Z');
            
            // 48 horas atrás
            const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

            // 1. Buscar empresas com autonomia operacional ativada
            const companiesSnap = await db.collection('companies').get();
            const activeCompanies = [];
            
            companiesSnap.forEach(doc => {
                const data = doc.data();
                if (data.ai_autonomy && data.ai_autonomy.operational_active) {
                    activeCompanies.push({ id: doc.id, name: data.name, autonomy: data.ai_autonomy });
                }
            });

            if (activeCompanies.length === 0) return;

            // 2. Para cada empresa, buscar orçamentos 'sent' que estão parados
            for (const company of activeCompanies) {
                const quotesSnap = await db.collection('quotes')
                    .where('companyId', '==', company.id)
                    .where('status', '==', 'sent')
                    .get();

                for (const doc of quotesSnap.docs) {
                    const quote = doc.data();
                    
                    // Filtragem manual para evitar erros de índice ausente no Firestore
                    const createdAt = new Date(quote.createdAt || quote.date);
                    if (createdAt < safetyDate) continue; // Trava de Segurança Absoluta
                    
                    const updatedAt = new Date(quote.updatedAt || quote.createdAt || quote.date);
                    if (updatedAt > fortyEightHoursAgo) continue; // Tem que estar parado há mais de 48h
                    
                    if (quote.lastFollowUp) continue; // Já foi cobrado
                    if (!quote.clientPhone) continue; // Sem telefone não tem como cobrar

                    console.log(`🤖 [NORA CRON] Processando Orçamento Frio: ${doc.id} (Cliente: ${quote.clientName})`);

                    const itemsName = quote.items && Array.isArray(quote.items) ? quote.items.map(i => i.name).join(', ') : 'serviço';
                    const prompt = `Você é a Inteligência Artificial da empresa ${company.name}. O orçamento de R$ ${quote.total || 0} para o cliente ${quote.clientName} está pendente de resposta há mais de 48 horas. Você está agindo proativamente agora. Escreva UMA MENSAGEM curta, muito natural e amigável para o WhatsApp do cliente, tentando retomar o assunto e oferecer ajuda para fechar o negócio. Não diga "eu acordei", aja naturalmente como uma vendedora humana acompanhando o cliente. Destaque no texto que o orçamento é referente a: ${itemsName}. Seja persuasiva.`;

                    const targetApiUrl = process.env.NORA_API_URL 
                        ? `${process.env.NORA_API_URL.replace(/\/$/, '')}/api/xcot` 
                        : `http://localhost:${process.env.PORT || 3000}/api/xcot`;

                    const fetchOptions = {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [{ role: 'user', content: prompt }],
                            userContext: {
                                uid: 'nora_cron',
                                companyId: company.id,
                                companyName: company.name,
                                role: 'admin',
                                displayName: 'NORA Cron',
                                currentPath: '/cron'
                            }
                        })
                    };

                    try {
                        const noraResponse = await fetch(targetApiUrl, fetchOptions);
                        const parsed = await noraResponse.json();
                        const responseText = parsed.response;

                        if (responseText) {
                            const cleanNumber = quote.clientPhone.replace(/\D/g, '');
                            const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
                            let targetJid = `${formattedNumber}@s.whatsapp.net`;
                            
                            try {
                                const results = await globalSock.onWhatsApp(formattedNumber);
                                if (results && results.length > 0 && results[0].exists) {
                                    targetJid = results[0].jid;
                                } else if (formattedNumber.length === 13 && formattedNumber.startsWith('55')) {
                                    const without9 = formattedNumber.slice(0, 4) + formattedNumber.slice(5);
                                    const altResults = await globalSock.onWhatsApp(without9);
                                    if (altResults && altResults.length > 0 && altResults[0].exists) {
                                        targetJid = altResults[0].jid;
                                    }
                                }
                            } catch(e) {}

                            const cleanText = responseText.replace(/\[\[ azul: (.*?) \]\]/g, '*$1*').replace(/\*\*(.*?)\*\*/g, '*$1*');
                            await globalSock.sendMessage(targetJid, { text: cleanText });
                            console.log(`🤖 [NORA CRON] Mensagem de recuperação enviada para ${quote.clientName}`);

                            await doc.ref.update({
                                lastFollowUp: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                        }
                    } catch (fetchErr) {
                        console.error('Erro ao acionar API da NORA no Cron:', fetchErr);
                    }
                }
            }
        } catch (e) {
            console.error('Erro no NORA Cron:', e);
        }
    }, 1800000); // 30 minutos
}

server.listen(8080, '0.0.0.0', () => {
    console.log('🚀 Servidor HTTP de QR Code e Envio de WhatsApp rodando em http://127.0.0.1:8080/qr');
    startBaileys();
    startReminderPoller();
    startNoraCronPoller();
});
