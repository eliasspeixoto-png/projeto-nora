
"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ProdutosPageClient = dynamic(() => import('@/components/produtos/ProdutosPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center rounded-lg border shadow-sm m-2">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});


export default function ProdutosPage() {
  return <ProdutosPageClient />;
}

