const { textToSpeechBuffer } = require('./tts');

async function testTts() {
    console.log("Testing Text-to-Speech generation in Portuguese...");
    const buf = await textToSpeechBuffer("Olá Elias! A NORA agora responde com voz nativa no WhatsApp.");
    if (buf) {
        console.log("✅ TTS Buffer gerado com sucesso! Tamanho:", buf.length, "bytes");
    } else {
        console.error("❌ Falha ao gerar buffer de áudio.");
    }
}

testTts();
