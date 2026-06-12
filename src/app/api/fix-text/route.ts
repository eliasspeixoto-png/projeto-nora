import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ fixedText: text });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[FIX-TEXT API] ERRO: DEEPSEEK_API_KEY não encontrada.');
      return NextResponse.json({ fixedText: text, error: 'API Key missing' });
    }

    const messages = [
      {
        role: 'system' as const,
        content: 'Você é um assistente de correção ortográfica e gramatical técnica para o sistema NORA (Segurança Eletrônica). Sua tarefa é corrigir erros de digitação e concordância. Regras: 1. Preserve termos técnicos como DVR, NVR, CFTV, Intelbras, JFL. 2. NÃO adicione ponto final ou pontuação que não exista no original. 3. Retorne APENAS o texto corrigido, sem comentários ou aspas.'
      },
      {
        role: 'user' as const,
        content: text
      }
    ];

    const response = await callDeepSeek(messages, undefined, 0.1);
    const fixedText = response.content?.trim() || text;

    return NextResponse.json({ fixedText });
    
  } catch (error: any) {
    console.error('ERRO NA ROTA /api/fix-text:', error);
    return NextResponse.json(
      { fixedText: '', error: error.message },
      { status: 500 }
    );
  }
}
