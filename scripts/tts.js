const googleTTS = require('google-tts-api');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Converte um Buffer MP3 para OGG/OPUS nativo do WhatsApp Voice Note com aceleração de ritmo (1.22x).
 */
function convertMp3ToOpus(mp3Buffer) {
    const tmpDir = os.tmpdir();
    const id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const inputPath = path.join(tmpDir, `input_${id}.mp3`);
    const outputPath = path.join(tmpDir, `output_${id}.opus`);

    try {
        fs.writeFileSync(inputPath, mp3Buffer);
        // Aplica o filtro de áudio atempo=1.30 para a voz falar em ritmo mais rápido (1.30x)
        execSync(`ffmpeg -y -i "${inputPath}" -af "atempo=1.30" -c:a libopus -b:a 32k -vbr on -ac 1 "${outputPath}"`, { stdio: 'ignore' });
        
        if (fs.existsSync(outputPath)) {
            const opusBuffer = fs.readFileSync(outputPath);
            try { fs.unlinkSync(inputPath); } catch (e) {}
            try { fs.unlinkSync(outputPath); } catch (e) {}
            return opusBuffer;
        }
    } catch (err) {
        console.error("Aviso na conversao ffmpeg para OPUS:", err.message);
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (e) {}
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
    }
    return mp3Buffer;
}

/**
 * Limpa o texto para fala humana perfeita: remove emojis, markdown, símbolos e barras.
 */
function cleanTextForSpeech(text) {
    if (!text) return '';

    return text
        // Remove tags customizadas como [[ azul: ... ]]
        .replace(/\[\[.*?\]\]/g, '')
        // Remove URLs
        .replace(/https?:\/\/\S+/g, '')
        // Remove todos os emojis (faixa unicode completa de emojis)
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        // Remove delimitadores de tabelas e listas
        .replace(/\|/g, ' ')
        // Remove caracteres de markdown (*, _, ~, `, #, ^, -)
        .replace(/[*_~`#^]/g, '')
        // Substitui hífens por espaço para evitar leitura literal
        .replace(/-/g, ' ')
        // Limpa espaços extras
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Gera um buffer de áudio nativo OGG/OPUS a partir de um texto em português brasileiro.
 * @param {string} text Texto a ser convertido em voz.
 * @returns {Promise<Buffer|null>} Buffer do áudio gerado.
 */
async function textToSpeechBuffer(text) {
    if (!text) return null;

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return null;

    const shortText = cleanText.length > 300 ? cleanText.substring(0, 300) + '...' : cleanText;

    try {
        const audioUrl = googleTTS.getAudioUrl(shortText, {
            lang: 'pt-BR',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const res = await fetch(audioUrl);
        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const mp3Buffer = Buffer.from(arrayBuffer);
            return convertMp3ToOpus(mp3Buffer);
        }
    } catch (err) {
        console.error("Erro ao gerar áudio TTS:", err.message);
    }

    return null;
}

module.exports = { textToSpeechBuffer };
