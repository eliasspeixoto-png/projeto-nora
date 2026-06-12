

"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const TrashPageClient = dynamic(() => import('@/components/lixeira/TrashPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function LixeiraPage() {
    return <TrashPageClient />;
}

    
