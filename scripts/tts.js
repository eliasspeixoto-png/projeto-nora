const googleTTS = require('google-tts-api');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Converte um Buffer MP3 para OGG/OPUS nativo do WhatsApp Voice Note.
 * A velocidade da voz é reduzida em 15% diretamente na configuração do EdgeTTS.
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
 * Normaliza valores monetários e números de milhares para pronúncia fonética perfeita.
 * Transforma '22.000' em '22 mil', '22.000,00' em '22 mil reais', '20000' em '20 mil', etc.
 */
function normalizeNumbersForSpeech(text) {
    if (!text) return '';

    let res = text;

    // 1. Remove R$
    res = res.replace(/R\$\s*/gi, '');

    // 2. Valores com milhares e centavos: ex: 22.000,00 ou 4.500,50
    // Casos de X.000,00 -> X mil reais
    res = res.replace(/\b(\d+)\.000,00\s*(reais)?\b/gi, '$1 mil reais');
    res = res.replace(/\b(\d+)\.000\s*(reais)?\b/gi, '$1 mil reais');
    
    // Casos de X.YYY,00 -> X mil e YYY reais (ex: 22.500,00 -> 22 mil e 500 reais)
    res = res.replace(/\b(\d+)\.(\d{3}),00\s*(reais)?\b/gi, (m, mil, rest) => {
        const rNum = parseInt(rest, 10);
        return rNum === 0 ? `${mil} mil reais` : `${mil} mil e ${rNum} reais`;
    });

    // Casos de X.YYY com ou sem "reais" (ex: 22.000 reais, 20.000 reais, 4.500 reais, 64.000)
    res = res.replace(/\b(\d+)\.(\d{3})\s*(reais)?\b/gi, (m, mil, rest, rWord) => {
        const rNum = parseInt(rest, 10);
        const suffix = rWord ? ' reais' : '';
        return rNum === 0 ? `${mil} mil${suffix}` : `${mil} mil e ${rNum}${suffix}`;
    });

    // Casos de decimais simples zerados: ex: 150,00 reais -> 150 reais
    res = res.replace(/\b(\d+),00\s*(reais)?\b/gi, '$1 reais');
    // Casos de decimais com centavos: ex: 150,50 reais -> 150 reais e 50 centavos
    res = res.replace(/\b(\d+),(\d{1,2})\s*(reais)?\b/gi, '$1 reais e $2 centavos');

    // Casos de números redondos de milhares sem ponto: 20000 reais, 22000 reais, 64000 reais
    res = res.replace(/\b(\d+)(000)\s*(reais)?\b/gi, (m, mil, zeros, rWord) => {
        const suffix = rWord ? ' reais' : '';
        return `${mil} mil${suffix}`;
    });

    return res;
}

/**
 * Limpa o texto para fala humana perfeita: normaliza números/moedas, pontuação e remove símbolos.
 */
function cleanTextForSpeech(text, firstName = 'Elias') {
    if (!text) return '';

    let clean = text
        .replace(/\[\[.*?\]\]/g, '')
        .replace(/https?:\/\/\S+/g, '');

    // 1. Normaliza valores numéricos e financeiros antes de remover pontuações
    clean = normalizeNumbersForSpeech(clean);

    // 2. Converte apenas códigos de barras / EAN longos (12 a 14 dígitos) para leitura pausada dígito a dígito
    clean = clean.replace(/\b\d{12,14}\b/g, (match) => match.split('').join(', '));

    clean = clean
        // Remove reticências ou sequências de pontos
        .replace(/\.{2,}/g, ' ')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/\|/g, ' ')
        .replace(/[*_~`#^]/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!clean) return '';

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
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
            rate: '-15%'
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

module.exports = { textToSpeechBuffer, cleanTextForSpeech, normalizeNumbersForSpeech };
