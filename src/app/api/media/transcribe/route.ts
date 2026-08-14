import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        return NextResponse.json({ error: 'Serviço de transcrição indisponível (Chave não configurada)' }, { status: 500 });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file, 'voice.webm');
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('language', 'pt');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}` },
        body: groqFormData
    });

    if (whisperRes.ok) {
        const whisperData = await whisperRes.json();
        return NextResponse.json({ text: whisperData.text });
    } else {
        const errorData = await whisperRes.text();
        console.error("Groq Error:", errorData);
        return NextResponse.json({ error: 'Erro ao transcrever áudio' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('ERRO EM /api/media/transcribe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
