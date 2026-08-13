const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

let googleTokenCache = null;
let tokenExpiresAt = 0;

async function getGoogleToken(rawSA) {
    if (googleTokenCache && Date.now() < tokenExpiresAt) {
        return googleTokenCache;
    }
    const auth = new GoogleAuth({
        credentials: {
            client_email: rawSA.client_email,
            private_key: rawSA.private_key
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    googleTokenCache = res.token;
    tokenExpiresAt = Date.now() + 50 * 60 * 1000; // 50 minutos
    return googleTokenCache;
}

async function transcribeAudioBuffer(audioBuffer) {
    const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
    
    if (!match) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT não encontrado no .env.local");
    }

    const rawSA = JSON.parse(match[1].trim());

    // 1. Tentar transcrição via OpenAI/Groq se houver chave configurada
    const openAiMatch = envContent.match(/OPENAI_API_KEY=(.*)/);
    const groqMatch = envContent.match(/GROQ_API_KEY=(.*)/);
    const openAiKey = openAiMatch ? openAiMatch[1].trim() : (process.env.OPENAI_API_KEY || '');
    const groqKey = groqMatch ? groqMatch[1].trim() : (process.env.GROQ_API_KEY || '');

    if (groqKey || openAiKey) {
        try {
            const apiKey = groqKey || openAiKey;
            const endpoint = groqKey 
                ? 'https://api.groq.com/openai/v1/audio/transcriptions'
                : 'https://api.openai.com/v1/audio/transcriptions';
            
            const formData = new FormData();
            const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
            formData.append('file', blob, 'voice.ogg');
            formData.append('model', groqKey ? 'whisper-large-v3-turbo' : 'whisper-1');
            formData.append('language', 'pt');

            const whisperRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: formData
            });

            if (whisperRes.ok) {
                const whisperData = await whisperRes.json();
                if (whisperData.text) {
                    console.log("🎙️ [WHISPER TRANSCRIÇÃO]:", whisperData.text);
                    return whisperData.text;
                }
            }
        } catch (err) {
            console.error("Aviso ao tentar Whisper API:", err.message);
        }
    }

    // 2. Transcrição via Google Cloud Speech-to-Text API (OGG_OPUS nativo do WhatsApp)
    try {
        const token = await getGoogleToken(rawSA);
        const base64Audio = audioBuffer.toString('base64');

        const gRes = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                config: {
                    encoding: 'OGG_OPUS',
                    sampleRateHertz: 16000,
                    languageCode: 'pt-BR',
                    enableAutomaticPunctuation: true,
                    model: 'latest_long'
                },
                audio: {
                    content: base64Audio
                }
            })
        });

        if (gRes.ok) {
            const gData = await gRes.json();
            if (gData.results && gData.results.length > 0) {
                const transcript = gData.results
                    .map(r => r.alternatives?.[0]?.transcript || '')
                    .join(' ')
                    .trim();
                
                if (transcript) {
                    console.log("🎙️ [GOOGLE STT TRANSCRIÇÃO]:", transcript);
                    return transcript;
                }
            }
        } else {
            const errText = await gRes.text();
            console.error("Erro na API de Speech do Google:", errText);
        }
    } catch (err) {
        console.error("Erro ao chamar Google Speech API:", err.message);
    }

    return null;
}

module.exports = { transcribeAudioBuffer };
