const googleTTS = require('google-tts-api');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Converte um Buffer MP3 para OGG/OPUS nativo do WhatsApp Voice Note.
 */
function convertMp3ToOpus(mp3Buffer) {
    const tmpDir = os.tmpdir();
    const id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const inputPath = path.join(tmpDir, `input_${id}.mp3`);
    const outputPath = path.join(tmpDir, `output_${id}.opus`);

    try {
        fs.writeFileSync(inputPath, mp3Buffer);
        execSync(`ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 32k -vbr on -ac 1 "${outputPath}"`, { stdio: 'ignore' });
        
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
 * Gera um buffer de áudio nativo OGG/OPUS a partir de um texto em português brasileiro.
 * @param {string} text Texto a ser convertido em voz.
 * @returns {Promise<Buffer|null>} Buffer do áudio gerado.
 */
async function textToSpeechBuffer(text) {
    if (!text) return null;

    // Remove tags markdown e formatação visual para a voz ficar limpa
    const cleanText = text
        .replace(/\[\[.*?\]\]/g, '')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/~(.*?)~/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/#{1,6}\s?/g, '')
        .replace(/\|.*?\|/g, '')
        .trim();

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
