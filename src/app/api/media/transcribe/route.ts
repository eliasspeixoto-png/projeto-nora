import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let audioBuffer: Buffer | null = null;
    let mimeType = 'audio/webm';
    let base64Audio = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as Blob | File | null;
      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
      }
      const arrayBuf = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuf);
      mimeType = file.type || 'audio/webm';
      base64Audio = audioBuffer.toString('base64');
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.base64Audio) {
        const cleanBase64 = body.base64Audio.includes('base64,') 
          ? body.base64Audio.split('base64,')[1] 
          : body.base64Audio;
        base64Audio = cleanBase64;
        audioBuffer = Buffer.from(cleanBase64, 'base64');
        mimeType = body.mimeType || 'audio/webm';
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Áudio vazio ou inválido' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Tentar Groq Whisper (Whisper Turbo e Whisper v3)
    let lastError = '';
    if (groqKey) {
      const groqModels = ['whisper-large-v3-turbo', 'whisper-large-v3'];
      for (const model of groqModels) {
        try {
          const audioFile = new File([new Uint8Array(audioBuffer)], 'voice.webm', { type: mimeType });
          const groqFormData = new FormData();
          groqFormData.append('file', audioFile);
          groqFormData.append('model', model);
          groqFormData.append('language', 'pt');

          const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}` },
            body: groqFormData
          });

          if (whisperRes.ok) {
            const whisperData = await whisperRes.json();
            if (whisperData.text && whisperData.text.trim()) {
              return NextResponse.json({ text: whisperData.text.trim() });
            }
          } else {
            const errText = await whisperRes.text();
            lastError = `Groq Error: ${errText}`;
            console.warn(`Groq Whisper (${model}) avisou:`, errText);
          }
        } catch (groqErr: any) {
          lastError = `Groq Exception: ${groqErr.message}`;
          console.warn(`Falha na chamada Groq Whisper (${model}):`, groqErr);
        }
      }
    }

    // 2. Fallback para Google Gemini Flash (Audio Transcription Nativada)
    if (geminiKey && base64Audio) {
      const geminiModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
      for (const model of geminiModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const payload = {
            contents: [{
              parts: [
                { 
                  text: "Você é um transcritor de áudio de alta precisão em Português do Brasil. Transcreva o áudio a seguir com exatidão. Responda APENAS com a transcrição do que foi falado no áudio, sem introduções, aspas ou comentários adicionais." 
                },
                {
                  inline_data: {
                    mime_type: mimeType.split(';')[0] || 'audio/webm',
                    data: base64Audio
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 2048,
            }
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            if (text) {
              return NextResponse.json({ text });
            }
          } else {
            const errText = await response.text();
            lastError += ` | Gemini Error: ${errText}`;
            console.warn(`Gemini Audio (${model}) avisou:`, errText);
          }
        } catch (geminiErr: any) {
          lastError += ` | Gemini Exception: ${geminiErr.message}`;
          console.warn(`Falha no Gemini Audio (${model}):`, geminiErr);
        }
      }
    }

    return NextResponse.json({ error: lastError || 'Não foi possível transcrever o áudio.' }, { status: 500 });
  } catch (error: any) {
    console.error('ERRO EM /api/media/transcribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
