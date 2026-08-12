import { NextResponse } from 'next/server';
import { getWhatsappQrCode, logoutWhatsappInstance } from '@/lib/whatsapp/evolution-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyId = searchParams.get('companyId') || 'DEFAULT_COMPANY';

        const status = await getWhatsappQrCode(companyId);
        return NextResponse.json(status);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Erro ao gerar QR Code' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyId = searchParams.get('companyId') || 'DEFAULT_COMPANY';
        const instanceName = `NORA_${companyId.replace(/[^a-zA-Z0-9]/g, '')}`;

        const result = await logoutWhatsappInstance(instanceName);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Erro ao desconectar' },
            { status: 500 }
        );
    }
}
