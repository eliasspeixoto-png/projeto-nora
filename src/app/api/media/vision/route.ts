import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { base64Image, mimeType } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ error: 'Imagem base64 é obrigatória' }, { status: 400 });
    }

    const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
    const finalMimeType = mimeType || 'image/jpeg';
    const dataUrl = `data:${finalMimeType};base64,${cleanBase64}`;

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 1. Tentar Groq Vision Primeiro (Mais Rápido)
    if (groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.2-11b-vision-preview',
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: 'Você é a NORA, sistema de visão e OCR para gestão. Descreva o que você vê nesta imagem/documento. Se for Nota Fiscal, Cupom ou Comprovante de Pagamento, extraia todos os dados estruturados (valores, cliente, fornecedor, itens e datas). Se for texto escrito, transcreva tudo fielmente em português.' 
                  },
                  {
                    type: 'image_url',
                    image_url: { url: dataUrl }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 2048
          })
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const text = groqData.choices?.[0]?.message?.content || '';
          if (text) {
            return NextResponse.json({ text });
          }
        }
      } catch (e) {
        console.warn('Falha no Groq Vision, tentando Gemini:', e);
      }
    }

    // 2. Fallback para Gemini (gemini-2.0-flash / gemini-1.5-flash)
    if (geminiKey) {
      const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const model of geminiModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const payload = {
            contents: [{
              parts: [
                { text: "Você é a NORA, sistema de visão e OCR para gestão. Descreva o que você vê nesta imagem/documento. Se for Nota Fiscal ou Comprovante, extraia os dados estruturados (valores, fornecedor, itens, datas). Se for texto, transcreva tudo." },
                {
                  inline_data: {
                    mime_type: finalMimeType,
                    data: cleanBase64
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
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
            if (text) {
              return NextResponse.json({ text });
            }
          }
        } catch (e) {
          console.warn(`Falha no Gemini (${model}):`, e);
        }
      }
    }

    return NextResponse.json({ error: 'Não foi possível analisar a imagem. Verifique o formato do arquivo.' }, { status: 500 });
  } catch (error: any) {
    console.error('ERRO EM /api/media/vision:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
