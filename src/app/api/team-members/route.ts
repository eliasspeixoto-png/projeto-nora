
import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/admin';
import { UserProfile } from '@/lib/data';

export const dynamic = 'force-dynamic';

async function getCompanyIdFromRequest(request: Request) {
    // Implement logic to get companyId, maybe from a custom header or decoded JWT
    // For now, let's assume it's passed as a query parameter for simplicity.
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
        throw new Error("Company ID is required");
    }
    return companyId;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyId = searchParams.get('companyId');

        if (!companyId) {
            return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
        }

        const usersSnapshot = await firestore.collection('users').where('companyId', '==', companyId).get();
        
        if (usersSnapshot.empty) {
            return NextResponse.json([]);
        }

        const usersData = usersSnapshot.docs.map((doc) => {
            const data = doc.data();
            return { uid: doc.id, ...data, creationTime: data.creationDate || null } as any as UserProfile;
        });

        return NextResponse.json(usersData);

    } catch (error: any) {
        console.error('CRITICAL Error fetching team members:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch team members', 
            details: error.message,
            stack: error.stack,
            code: error.code
        }, { status: 500 });
    }
}
