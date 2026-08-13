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
        // Converte diretamente para OPUS sem acelerar (a voz Neural já tem o ritmo perfeito)
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
 * Limpa o texto para fala humana perfeita: insere nome do usuario no inicio, pausas em virgulas e remove simbolos.
 */
function cleanTextForSpeech(text, firstName = 'Elias') {
    if (!text) return '';

    let clean = text
        .replace(/\[\[.*?\]\]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        // Remove reticências ou sequências de pontos que o TTS lê como "ponto"
        .replace(/\.{2,}/g, ' ')
        // Converte códigos numéricos longos (5 a 14 dígitos, ex: 798455423628) para leitura dígito a dígito ("7, 9, 8, 4...")
        .replace(/\b\d{5,14}\b/g, (match) => match.split('').join(', '))
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/\|/g, ' ')
        .replace(/[*_~`#^]/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!clean) return '';

    // (A injeção forçada do nome foi removida para obedecer ao System Prompt)

    // Preserva o ponto de interrogação (?) para a sintetizadora fazer a entonação perfeita de pergunta!
    clean = clean
        .replace(/\./g, ', ')
        .replace(/!/g, ', ')
        .replace(/:\s*/g, ', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s*\?\s*/g, '? ')
        .replace(/\s+/g, ' ')
        .trim();

    return clean;
}

const { EdgeTTS } = require('node-edge-tts');

/**
 * Gera um buffer de áudio nativo OGG/OPUS a partir de um texto usando Microsoft Edge TTS.
 * @param {string} text Texto a ser convertido em voz.
 * @param {string} firstName Nome do usuário.
 * @returns {Promise<Buffer|null>} Buffer do áudio gerado.
 */
async function textToSpeechBuffer(text, firstName = 'Elias') {
    if (!text) return null;

    const cleanText = cleanTextForSpeech(text, firstName);
    if (!cleanText) return null;

    try {
        const tts = new EdgeTTS({
            voice: 'pt-BR-FranciscaNeural',
            lang: 'pt-BR',
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
        });
        
        const tmpDir = os.tmpdir();
        const id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const tempMp3Path = path.join(tmpDir, `temp_edge_${id}.mp3`);

        await tts.ttsPromise(cleanText, tempMp3Path);

        if (fs.existsSync(tempMp3Path)) {
            const mp3Buffer = fs.readFileSync(tempMp3Path);
            try { fs.unlinkSync(tempMp3Path); } catch (e) {}
            return convertMp3ToOpus(mp3Buffer);
        }
    } catch (err) {
        console.error("Erro ao gerar áudio TTS com Edge-TTS:", err.message);
    }

    return null;
}

module.exports = { textToSpeechBuffer };
