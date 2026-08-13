const googleTTS = require('google-tts-api');

/**
 * Gera um buffer de áudio MP3/OGG a partir de um texto em português brasileiro.
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

    // Limita o tamanho do texto falado para respostas ágeis (até 200 caracteres por trecho ou sintetiza a primeira frase relevante)
    const shortText = cleanText.length > 300 ? cleanText.substring(0, 300) + '...' : cleanText;

    try {
        // Tenta gerar o áudio via Google TTS (Português do Brasil)
        const audioUrl = googleTTS.getAudioUrl(shortText, {
            lang: 'pt-BR',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const res = await fetch(audioUrl);
        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
    } catch (err) {
        console.error("Erro ao gerar áudio TTS:", err.message);
    }

    return null;
}

module.exports = { textToSpeechBuffer };
