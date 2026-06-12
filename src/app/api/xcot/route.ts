
import { NextResponse } from 'next/server';
import { noraFlow } from './flow';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, userContext } = body;

    // Log de diagnóstico para o ambiente Live
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[NORA API] ERRO CRÍTICO: DEEPSEEK_API_KEY não foi encontrada nas variáveis de ambiente!');
    }

    if (!messages || !userContext) {
      return NextResponse.json(
        { error: 'Mensagens e contexto do usuário são obrigatórios' },
        { status: 400 }
      );
    }

    const noraResponse = await noraFlow({ messages, userContext });
    
    return NextResponse.json(noraResponse);
    
  } catch (error: any) {
    console.error('ERRO CRÍTICO NA ROTA /api/xcot:', error);
    if (error.stack) console.error(error.stack);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor', details: error.toString() },
      { status: 500 }
    );
  }
}
