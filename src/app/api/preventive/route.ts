// src/app/api/preventive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/preventive
 * Retorna clientes comodato com manutenção preventiva configurada.
 * Query params:
 *  - companyId: string (obrigatório)
 *  - status: 'pendente' | 'em_dia' | 'atrasado' (opcional, filtra por status calculado)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId é obrigatório.' },
        { status: 400 }
      );
    }

    const snap = await firestore
      .collection('clients')
      .where('companyId', '==', companyId)
      .where('isComodato', '==', true)
      .get();

    const today = new Date();

    const clients = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as any))
      .filter((c) => !c.deletedAt && c.preventiveMaintenanceFrequency)
      .map((c) => {
        const freq: number = c.preventiveMaintenanceFrequency ?? 0;
        const lastDate: string | null = c.lastPreventiveMaintenanceDate ?? null;

        let nextDueDate: Date | null = null;
        let diasAtraso = 0;
        let statusCalc: 'em_dia' | 'pendente' | 'atrasado' = 'pendente';

        if (lastDate) {
          const last = new Date(lastDate);
          nextDueDate = new Date(last);
          nextDueDate.setMonth(nextDueDate.getMonth() + freq);

          const diffMs = nextDueDate.getTime() - today.getTime();
          diasAtraso = Math.floor(-diffMs / (1000 * 60 * 60 * 24));

          if (diasAtraso > 0) {
            statusCalc = 'atrasado';
          } else if (diasAtraso > -15) {
            statusCalc = 'pendente';
          } else {
            statusCalc = 'em_dia';
          }
        }

        return {
          id: c.id,
          clientCode: c.clientCode,
          name: c.name,
          phone: c.phone,
          whatsapp: c.whatsapp,
          city: c.city,
          state: c.state,
          preventiveMaintenanceFrequency: freq,
          lastPreventiveMaintenanceDate: lastDate,
          nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
          diasAtraso: Math.max(0, diasAtraso),
          status: statusCalc,
          comodatoStatus: c.comodatoStatus,
          serviceDescription: c.serviceDescription,
          serviceValue: c.serviceValue,
        };
      });

    return NextResponse.json(clients);
  } catch (error: any) {
    console.error('[/api/preventive] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.', details: error.message },
      { status: 500 }
    );
  }
}
