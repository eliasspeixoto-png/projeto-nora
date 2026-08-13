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

    // Garante que o áudio comece citando primeiro o nome do usuário
    if (firstName && !clean.toLowerCase().startsWith(firstName.toLowerCase())) {
        clean = `${firstName}, ${clean}`;
    }

    // Substitui pontuações por vírgulas suaves (evita que a sintetizadora fale a palavra "ponto")
    clean = clean
        .replace(/\./g, ', ')
        .replace(/\?/g, ', ')
        .replace(/!/g, ', ')
        .replace(/:\s*/g, ', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

    return clean;
}

/**
 * Gera um buffer de áudio nativo OGG/OPUS a partir de um texto em português brasileiro.
 * Suporta textos longos (respostas técnicas) fatiando em múltiplos trechos sintetizados.
 * @param {string} text Texto a ser convertido em voz.
 * @returns {Promise<Buffer|null>} Buffer do áudio gerado.
 */
async function textToSpeechBuffer(text, firstName = 'Elias') {
    if (!text) return null;

    const cleanText = cleanTextForSpeech(text, firstName);
    if (!cleanText) return null;

    try {
        // Usa getAllAudioUrls para fatiar textos longos em trechos de ate 200 caracteres
        const audioUrls = googleTTS.getAllAudioUrls(cleanText, {
            lang: 'pt-BR',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const mp3Buffers = [];
        for (const item of audioUrls) {
            const res = await fetch(item.url);
            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                mp3Buffers.push(Buffer.from(arrayBuffer));
            }
        }

        if (mp3Buffers.length > 0) {
            const combinedMp3 = Buffer.concat(mp3Buffers);
            return convertMp3ToOpus(combinedMp3);
        }
    } catch (err) {
        console.error("Erro ao gerar áudio TTS para texto longo:", err.message);
    }

    return null;
}

module.exports = { textToSpeechBuffer };
