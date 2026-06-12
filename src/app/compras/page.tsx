"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ComprasPageClient = dynamic(() => import('@/components/compras/ComprasPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center rounded-lg m-2">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function ComprasPage() {
  return <ComprasPageClient />;
}
