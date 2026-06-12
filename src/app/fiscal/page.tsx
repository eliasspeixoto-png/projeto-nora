
"use client";
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const FiscalPageClient = dynamic(() => import('@/components/fiscal/FiscalPageClient'), {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
});


export default function FiscalPageWrapper() {
  return <FiscalPageClient initialInvoices={[]} initialError={null} />;
}
