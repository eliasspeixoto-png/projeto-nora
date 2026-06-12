import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Função de inicialização 'In-Route' para evitar cache de arquivos externos
function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin;

  try {
    const rawSAString = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    // Limpeza de aspas agressiva
    let cleanedJson = rawSAString;
    if (cleanedJson.startsWith("'") && cleanedJson.endsWith("'")) cleanedJson = cleanedJson.slice(1, -1);
    if (cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) cleanedJson = cleanedJson.slice(1, -1);

    const rawSA = JSON.parse(cleanedJson);
    const serviceAccount: any = {
      projectId: rawSA.project_id,
      project_id: rawSA.project_id,
      privateKey: (rawSA.private_key || '').replace(/\\n/g, '\n'),
      private_key: (rawSA.private_key || '').replace(/\\n/g, '\n'),
      clientEmail: rawSA.client_email,
      client_email: rawSA.client_email,
      universe_domain: "googleapis.com"
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
    
    return admin;
  } catch (err) {
    console.error('❌ [BYPASS-ERROR] Falha crítica na inicialização In-Route:', err);
    throw err;
  }
}

/**
 * @api {post} /api/notifications/send Enviar Notificação Push
 */
export async function POST(request: NextRequest) {
  try {
    const fb = getFirebaseAdmin();
    const messaging = fb.messaging();
    const firestore = fb.firestore();
    const auth = fb.auth();

    const body = await request.json();
    const { userId, title, message, data } = body;

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'Parâmetros userId, title e message são obrigatórios.' }, { status: 400 });
    }

    // 1. Validar autenticação do remetente
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado. Token de autenticação ausente.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const requesterUid = decodedToken.uid;

    // 2. Verificar se o solicitante tem permissão (admin ou developer)
    const requesterDoc = await firestore.collection('users').doc(requesterUid).get();
    const requesterProfile = requesterDoc.data();
    
    if (!requesterDoc.exists || (requesterProfile?.role !== 'admin' && requesterProfile?.role !== 'developer' && requesterProfile?.role !== 'cliente')) {
       return NextResponse.json({ error: 'Acesso negado. Apenas administradores e clientes autorizados podem disparar notificações.' }, { status: 403 });
    }

    // 3. Buscar o token FCM do destinatário
    const targetUserDoc = await firestore.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json({ error: 'Usuário destinatário não encontrado.' }, { status: 404 });
    }

    const targetUser = targetUserDoc.data();
    const fcmToken = targetUser?.fcmToken;

    if (!fcmToken) {
      return NextResponse.json({ 
        error: 'Técnico sem token push registrado.', 
        code: 'TOKEN_NOT_FOUND',
        userId 
      }, { status: 404 });
    }

    // 4. Preparar o payload da notificação (V3 - Blindagem de Cache)
    const payload: any = {
      token: fcmToken,
      notification: {
        title: title,
        body: message,
      },
      data: {
        userId: userId,
        click_action: data?.clickAction || '/ordem-de-servico',
      },
      android: {
        priority: 'high',
        notification: {
           icon: 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20Favicon.png?alt=media&token=f56d3bc9-57a1-48e4-a84b-f263e729c0a9',
           clickAction: 'FLUTTER_NOTIFICATION_CLICK',
           tag: 'nora-push'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          icon: 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20Favicon.png?alt=media&token=f56d3bc9-57a1-48e4-a84b-f263e729c0a9',
          badge: 'https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20Favicon.png?alt=media&token=f56d3bc9-57a1-48e4-a84b-f263e729c0a9',
          tag: 'nora-push'
        },
        fcmOptions: {
            link: data?.clickAction || '/ordem-de-servico'
        }
      }
    };

    // 5. Enviar via Firebase Messaging
    const response = await messaging.send(payload);

    console.log('Firebase Cloud Messaging: Notificação enviada com sucesso.', response);

    return NextResponse.json({ 
      success: true, 
      messageId: response,
      target: targetUser.displayName || userId
    });

  } catch (error: any) {
    console.error('CRITICAL Error sending push notification API:', error);
    
    // Tratamento específico para erro de token inválido
    if (error.code === 'messaging/registration-token-not-registered') {
        return NextResponse.json({ 
            error: 'Token FCM expirado ou inválido. O usuário precisa logar novamente.',
            code: 'INVALID_TOKEN'
        }, { status: 410 });
    }

    return NextResponse.json({ 
      error: 'Erro interno ao processar notificação.', 
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}
