import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { firestore, auth, messaging } from '@/lib/firebase/admin';

/**
 * @api {post} /api/notifications/notify-admins Notificar Administradores da Empresa
 * @description Rota para disparar notificações push para todos os admins de uma empresa
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, message, data } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Parâmetros title e message são obrigatórios.' }, { status: 400 });
    }

    // 1. Validar autenticação do remetente
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado. Token de autenticação ausente.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const requesterUid = decodedToken.uid;

    // 2. Obter perfil do solicitante para identificar a empresa
    const requesterDoc = await firestore.collection('users').doc(requesterUid).get();
    const requesterProfile = requesterDoc.data();
    
    if (!requesterDoc.exists || !requesterProfile?.companyId) {
       return NextResponse.json({ error: 'Perfil de usuário ou empresa não encontrados.' }, { status: 403 });
    }

    const companyId = requesterProfile.companyId;

    // 3. Buscar todos os administradores e supervisores da mesma empresa que possuem tokens FCM
    const adminsSnapshot = await firestore.collection('users')
      .where('companyId', '==', companyId)
      .where('role', 'in', ['admin', 'supervisor'])
      .get();

    if (adminsSnapshot.empty) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'Nenhum administrador encontrado para esta empresa.' });
    }

    const tokens: string[] = [];
    adminsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'Nenhum administrador com token push registrado.' });
    }

    // 4. Preparar as mensagens
    // messaging.sendEachForMulticast suporta até 500 tokens por chamada
    const multicastMessage = {
      tokens: tokens,
      notification: {
        title: title,
        body: message,
      },
      data: {
        ...data,
        click_action: data?.clickAction || '/ordem-de-servico',
      },
      webpush: {
        notification: {
          icon: '/icon.png',
          badge: '/icon.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
        fcmOptions: {
            link: data?.clickAction || '/ordem-de-servico'
        }
      }
    };

    // 5. Enviar via Firebase Messaging
    const response = await messaging.sendEachForMulticast(multicastMessage);

    console.log(`FCM Multicast: ${response.successCount} notificações enviadas para admins da empresa ${companyId}.`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Falha ao enviar para token ${tokens[idx]}:`, resp.error);
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      sentCount: response.successCount,
      failureCount: response.failureCount
    });

  } catch (error: any) {
    console.error('CRITICAL Error in notify-admins API:', error);
    return NextResponse.json({ 
      error: 'Erro interno ao disparar notificações para administradores.', 
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}
