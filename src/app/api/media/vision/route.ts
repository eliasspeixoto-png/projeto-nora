import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { base64Image, mimeType } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ error: 'Imagem base64 é obrigatória' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
        return NextResponse.json({ error: 'Serviço de visão indisponível (Chave não configurada)' }, { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    // Convert base64 if it includes the data:image prefix
    const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

    const payload = {
        contents: [{
            parts: [
                { text: "Você é os olhos de um sistema de gestão. Descreva brevemente o que você vê nesta imagem/pdf. Se identificar que é uma Nota Fiscal, extraia os dados estruturados (numero, serie, dataEmissao, fornecedor, valorTotal e itens). Se for um Comprovante de Pagamento extraia os dados. Se houver outro tipo de texto escrito, transcreva tudo." },
                {
                    inline_data: {
                        mime_type: mimeType || 'image/jpeg',
                        data: cleanBase64
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            topK: 32,
            topP: 1,
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
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return NextResponse.json({ text });
    } else {
        const errorData = await response.text();
        console.error("Gemini Error:", errorData);
        return NextResponse.json({ error: 'Erro ao analisar imagem com Gemini' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('ERRO EM /api/media/vision:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
