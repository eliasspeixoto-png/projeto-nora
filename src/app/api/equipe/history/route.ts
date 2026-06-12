import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { firestore, auth } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const date = searchParams.get('date');

    if (!uid || !date) {
      return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
    }

    // 1. Validar autenticação
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const requesterUid = decodedToken.uid;

    // 2. Buscar perfil do solicitante para validar ROLE
    const requesterDoc = await firestore.collection('users').doc(requesterUid).get();
    if (!requesterDoc.exists) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 });
    }

    const requesterProfile = requesterDoc.data();
    const role = requesterProfile?.role;
    const companyId = requesterProfile?.companyId;

    // 3. Restrição: Somente admin ou developer pode ver histórico
    if (role !== 'admin' && role !== 'developer') {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    // 4. Buscar histórico do técnico solicitado
    const historyDocId = `${uid}_${date}`;
    const historyDoc = await firestore.collection('locationHistory').doc(historyDocId).get();

    if (!historyDoc.exists) {
      return NextResponse.json({ points: [] });
    }

    const historyData = historyDoc.data();

    // 5. Validar se o técnico pertence à mesma empresa do Admin (a menos que seja developer)
    // Se o documento tiver companyId, usamos ele. Se não, verificamos o perfil do técnico.
    if (role !== 'developer') {
        let historyCompanyId = historyData?.companyId;
        
        if (!historyCompanyId) {
            const targetUserDoc = await firestore.collection('users').doc(uid).get();
            historyCompanyId = targetUserDoc.data()?.companyId;
        }

        if (historyCompanyId !== companyId) {
            return NextResponse.json({ error: 'Acesso negado: Técnico de outra empresa' }, { status: 403 });
        }
    }

    return NextResponse.json({ points: historyData?.points || [] });

  } catch (error: any) {
    console.error('Error fetching history via API:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
