
"use client";

import dynamic from 'next/dynamic';
import { Loader2, Landmark } from 'lucide-react';

const ComodatoPageClient = dynamic(() => import('@/components/comodato/ComodatoPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
            <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
                <Landmark className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
                <p className="text-2xl font-semibold tracking-tighter text-primary">Sincronizando Comodatos</p>
                <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.3em] animate-pulse">Motor de Inteligência</p>
            </div>
        </div>
    </div>
  ),
});

export default function ComodatoPage() {
  return <ComodatoPageClient />;
}
