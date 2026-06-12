
import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';
import type { Quote, StatusHistory } from '@/lib/data';
import * as admin from 'firebase-admin';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const quoteId = params.id;
  
  if (!quoteId) {
    return NextResponse.json({ error: 'ID do orçamento não fornecido.' }, { status: 400 });
  }
  
  let body;
  try {
      body = await request.json();
  } catch (e) {
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const { status, notes } = body;

  const allowedStatus: Quote['status'][] = ['Aprovado', 'rejected', 'revision-pending'];

  if (!status || !allowedStatus.includes(status)) {
    return NextResponse.json({ error: 'Status inválido fornecido.' }, { status: 400 });
  }

  try {
    const quoteRef = firestore.collection('quotes').doc(quoteId);

    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
        return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });
    }

    const newHistoryEntry: Partial<StatusHistory> = {
        status: status,
        changedAt: new Date().toISOString(),
        changedBy: "Cliente",
    };
    
    // Adiciona as notas apenas se elas existirem na requisição e não forem vazias
    if (notes && notes.trim()) {
      newHistoryEntry.notes = notes;
    }
    
    await quoteRef.update({
        status: status,
        statusHistory: admin.firestore.FieldValue.arrayUnion(newHistoryEntry)
    });

    return NextResponse.json({ success: true, message: 'Status atualizado com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao atualizar o status do orçamento:', error);
    return NextResponse.json(
      {
        error: 'Falha ao atualizar o status do orçamento no servidor.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
