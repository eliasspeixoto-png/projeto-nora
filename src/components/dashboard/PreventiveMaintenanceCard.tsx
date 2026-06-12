"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PreventiveMaintenanceCard({ count }: { count: number }) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer shadow-md hover:shadow-orange-500/30 transition-shadow duration-300 hover:scale-[1.02]"
      onClick={() => router.push('/dashboard/manutencoes')}
    >
      <CardHeader className="flex flex-row items-center justify-between p-2 pb-1">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-500" /> Manutenções Preventivas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 flex items-center justify-between">
        <div className="text-xl font-semibold text-orange-500">{count}</div>
        <div className="text-[10px] text-muted-foreground">Aguardando manutenção</div>
      </CardContent>
    </Card>
  );
}
