
"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const TeamPageClient = dynamic(() => import('@/components/equipe/TeamPageClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

// O TeamMap já é carregado dinamicamente dentro do TeamPageClient, 
// mas para garantir, podemos carregar o wrapper principal dinamicamente.
const TeamMap = dynamic(() => import('@/components/equipe/TeamMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});

export default function MapaEquipePage() {
  return (
    <TeamPageClient>
      <TeamMap focusedMember={null} teamMembers={[]} />
    </TeamPageClient>
  );
}
