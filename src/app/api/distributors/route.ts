import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';
import { UserProfile } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const usersRef = firestore.collection('users');
    const snapshot = await usersRef.where('role', '==', 'distribuidor').get();

    if (snapshot.empty) {
      return NextResponse.json([]);
    }

    const distributors = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    } as UserProfile));
    
    return NextResponse.json(distributors);

  } catch (error: any) {
    console.error('Erro ao buscar distribuidores na API:', error);
    return NextResponse.json(
      {
        error: 'Falha ao buscar distribuidores no servidor.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
