import { NextResponse } from 'next/server';
import { firestore, auth } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? 'OK (Presente)' : 'AUSENTE',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'AUSENTE',
      FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? 'OK (Presente)' : 'AUSENTE',
      NODE_ENV: process.env.NODE_ENV,
    },
    firebase_admin: {
      apps_initialized: admin.apps.length,
      active_apps: admin.apps.map(app => app?.name).filter(Boolean),
    },
    firestore_test: 'Aguardando...',
    auth_test: 'Aguardando...'
  };

  try {
    // Tenta acessar uma propriedade do firestore para disparar o proxy/inicialização
    const colls = await firestore.listCollections();
    diagnostics.firestore_test = `CONECTADO (${colls.length} coleções)`;
  } catch (error: any) {
    console.error('[DIAGNOSTICS] Firestore fail:', error.message);
    diagnostics.firestore_test = `ERRO: ${error.message}`;
  }

  try {
    const listUsers = await auth.listUsers(1);
    diagnostics.auth_test = `CONECTADO (${listUsers.users.length} usuários teste)`;
  } catch (error: any) {
    console.error('[DIAGNOSTICS] Auth fail:', error.message);
    diagnostics.auth_test = `ERRO: ${error.message}`;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}

