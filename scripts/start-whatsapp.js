/**
 * @fileOverview Servidor Nativo WhatsApp Baileys para NORA AI.
 * Conecta diretamente ao WhatsApp Web sem passar pelo Facebook/Meta.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { transcribeAudioBuffer } = require('./transcribe');
const { textToSpeechBuffer } = require('./tts');

let latestQrCodeBase64 = null;
let connectionStatus = 'connecting';
let connectedPhone = null;
let globalSock = null;

async function startBaileys() {
    const authPath = path.join(__dirname, '../.whatsapp_auth');
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['NORA AI System', 'Chrome', '1.0.0']
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

        const remoteJid = msg.key.remoteJid;
        console.log(`📩 [MENSAGEM RECEBIDA] De: ${remoteJid} | Chaves:`, Object.keys(msg.message));

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

        if (text && remoteJid) {
            console.log(`\n📲 [WHATSAPP RECEBIDO] De: ${remoteJid} -> "${text}"`);

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
                if (userHistory.length > 10) userHistory = userHistory.slice(-10);
                global.waChatHistory.set(remoteJid, userHistory);

                // Chama o endpoint local do NORA Flow via HTTP (porta 3000 do Next.js)
                const nextPort = process.env.PORT || 3000;
                const req = http.request({
                    hostname: 'localhost',
                    port: nextPort,
                    path: '/api/xcot',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', async () => {
                        try {
                            const parsed = JSON.parse(data);
                            const responseText = parsed.response || 'Desculpe, ocorreu um erro ao processar.';
                            
                            // Adiciona resposta da NORA ao histórico da conversa
                            userHistory.push({ role: 'assistant', content: responseText });
                            if (userHistory.length > 10) userHistory = userHistory.slice(-10);
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
                                        // Se falhou o áudio e não tinha enviado texto, envia o texto como fallback
                                        await sock.sendMessage(remoteJid, { text: cleanText });
                                    }
                                } catch (voiceErr) {
                                    console.error("Erro ao enviar resposta de voz:", voiceErr);
                                    if (!shouldSendText) {
                                        await sock.sendMessage(remoteJid, { text: cleanText });
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Erro ao ler resposta da NORA:', e);
                        }
                    });
                });

                const contactName = msg.pushName && !/^\d+$/.test(msg.pushName) ? msg.pushName : 'Elias';

                req.on('error', (e) => console.error('Erro na requisição para /api/xcot:', e.message));
                req.write(JSON.stringify({
                    messages: userHistory,
                    userContext: {
                        uid: `wa_${remoteJid.split('@')[0]}`,
                        companyId: 'Z6XlJobG4TfPoYMwLNC0',
                        companyName: 'ESP-TEC INSTALAÇÕES LTDA.',
                        role: 'admin',
                        displayName: contactName,
                        currentPath: '/whatsapp'
                    }
                }));
                req.end();

            } catch (err) {
                console.error('Erro ao enviar mensagem pelo WhatsApp:', err);
            }
        }
    });
}

// Servidor HTTP simples na porta 8080 para fornecer o QR Code real em HTML
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && (req.url === '/send' || req.url === '/api/whatsapp/send')) {
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

server.listen(8080, '0.0.0.0', () => {
    console.log('🚀 Servidor HTTP de QR Code e Envio de WhatsApp rodando em http://127.0.0.1:8080/qr');
    startBaileys();
});
