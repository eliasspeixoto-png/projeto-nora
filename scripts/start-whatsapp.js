/**
 * @fileOverview Servidor Nativo WhatsApp Baileys para NORA AI.
 * Conecta diretamente ao WhatsApp Web sem passar pelo Facebook/Meta.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const fs = require('fs');

let latestQrCodeBase64 = null;
let connectionStatus = 'connecting';
let connectedPhone = null;

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
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption;

        if (text && remoteJid) {
            console.log(`\n📲 [WHATSAPP RECEBIDO] De: ${remoteJid} -> "${text}"`);
            
            try {
                // Envia sinal de digitando
                await sock.sendPresenceUpdate('composing', remoteJid);

                // Memória de histórico da conversa por remetente
                if (!global.waChatHistory) global.waChatHistory = new Map();
                let userHistory = global.waChatHistory.get(remoteJid) || [];
                userHistory.push({ role: 'user', content: text });
                if (userHistory.length > 10) userHistory = userHistory.slice(-10);
                global.waChatHistory.set(remoteJid, userHistory);

                // Chama o endpoint local do NORA Flow via HTTP
                const req = http.request('http://localhost:3001/api/xcot', {
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

                            await sock.sendMessage(remoteJid, { text: cleanText });
                            console.log(`🤖 [NORA RESPONSES] Enviado para ${remoteJid}`);
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

                if (!sock || connectionStatus !== 'open') {
                    res.writeHead(503);
                    return res.end(JSON.stringify({ error: 'WhatsApp não está conectado no momento.' }));
                }

                const cleanNumber = number.replace(/\D/g, '');
                const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
                const jid = `${formattedNumber}@s.whatsapp.net`;

                await sock.sendMessage(jid, { text });
                console.log(`🚀 [DISPARO DIRETO] Mensagem enviada para ${jid}: "${text}"`);
                
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, jid }));
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

server.listen(8080, () => {
    console.log('🚀 Servidor HTTP de QR Code WhatsApp rodando em http://localhost:8080/qr');
    startBaileys();
});
