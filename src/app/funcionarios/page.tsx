
"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const FuncionariosPageClient = dynamic(() => import('@/components/funcionarios/FuncionariosPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function FuncionariosPage() {
  return <FuncionariosPageClient />;
}
