// src/app/api/companies/route.ts
import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const companiesRef = firestore.collection('companies');
    const snapshot = await companiesRef.get();

    if (snapshot.empty) {
      return NextResponse.json([]);
    }

    const companies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return NextResponse.json(companies);

  } catch (error: any) {
    console.error('Erro ao buscar empresas na API:', error);
    return NextResponse.json(
      {
        error: 'Falha ao buscar empresas no servidor.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
