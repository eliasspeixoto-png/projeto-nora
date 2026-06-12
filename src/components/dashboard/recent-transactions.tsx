
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AccountsReceivable } from "@/lib/data";
import { DollarSign, Clock } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type RecentTransactionsProps = {
  receivables: AccountsReceivable[];
  className?: string;
  onReceivableClick: (receivable: AccountsReceivable) => void;
};

export default function RecentTransactions({ receivables, className, onReceivableClick }: RecentTransactionsProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const pendingReceivables = receivables
    .filter(r => ['Pendente', 'Parcial'].includes(r.status))
    .sort((a,b) => {
      const dateA = new Date(`${(a.dueDate || "").split('T')[0]}T00:00:00`);
      const dateB = new Date(`${(b.dueDate || "").split('T')[0]}T00:00:00`);
      return dateA.getTime() - dateB.getTime();
    });

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="text-base text-xl">Contas a Receber</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Contas com status pendente ou parcial.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 flex-1 overflow-y-auto">
        {pendingReceivables.map(item => {
          const cleanDate = (item.dueDate || "").split('T')[0];
          const dueDate = new Date(`${cleanDate}T00:00:00`);
          const isOverdue = isPast(dueDate) && !isToday(dueDate);
          
          const isInstallment = item.quoteNumber.includes('(');
          const displayAmount = isInstallment ? item.amount : (item.originalAmount || item.amount);
          
          return (
            <div 
              key={item.id} 
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-muted"
              onClick={() => onReceivableClick(item)}
            >
                <Avatar className="hidden h-9 w-9 sm:flex">
                    <AvatarFallback className={cn(isOverdue ? "bg-destructive/20" : "bg-secondary")}>
                        <Clock className={cn("h-4 w-4", isOverdue ? "text-destructive" : "text-muted-foreground")} />
                    </AvatarFallback>
                </Avatar>
                <div className="flex justify-between items-center w-full min-w-0">
                  <div className="grid gap-0.5 min-w-0">
                    <p className="text-xs font-medium leading-tight truncate">{item.clientName} - {item.quoteNumber}</p>
                     <p className={cn("text-xs whitespace-nowrap", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                       Vence {format(dueDate, "dd/MM/yy", { locale: ptBR })}
                    </p>
                  </div>
                   <div className="ml-2 flex-shrink-0 text-right">
                      {item.status === 'Parcial' ? (
                        <>
                           <div className={cn("font-semibold text-xs md:text-base", isOverdue && "text-destructive")}>{formatCurrency(item.originalAmount || 0)}</div>
                           <div className="text-xs text-destructive">Restante: {formatCurrency(item.amount)}</div>
                        </>
                      ) : (
                         <div className={cn("font-semibold text-sm md:text-base", isOverdue && "text-destructive")}>{formatCurrency(displayAmount)}</div>
                      )}
                   </div>
                </div>
            </div>
          )
        })}
         {pendingReceivables.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta a receber pendente.</p>
        )}
      </CardContent>
    </Card>
  );
}
