"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HistoryItem } from "@/lib/data";
import { Quote, Visit, Client, UserProfile, Company, PurchaseOrder } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { osStatusConfig } from "@/components/ordem-de-servico/os-status-config";
import { statusConfig as visitStatusConfig } from '@/components/visitas/visit-status';


type HistoryDetailDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  item: HistoryItem | null;
  clients: Client[];
  teamMembers: UserProfile[];
  company: Company | null;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return "Data inválida";
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "Data inválida";
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
};

const formatQuantity = (quantity: number) => {
  return Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(2);
};


export default function HistoryDetailDialog({ isOpen, setOpen, item, clients, teamMembers, company }: HistoryDetailDialogProps) {
  if (!item) return null;

  const client = clients.find(c => c.id === (item as any).clientId);
  const technician = teamMembers.find(t => t.uid === (item as any).technicianId || t.uid === (item as any).assignedTechnicianId);
  const creator = teamMembers.find(t => t.uid === ((item as any).creatorName || '')); // Assuming creatorName stores UID

  const renderOsDetails = (os: Quote) => {
    const subtotal = os.items.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = (subtotal * (os.discount || 0)) / 100;
    const totalAfterDiscount = subtotal - discountAmount;
    const config = osStatusConfig[os.status as keyof typeof osStatusConfig];
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Cliente</p>
             <p className="text-sm font-semibold">{client?.name}</p>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Técnico Responsável</p>
             <p className="text-sm font-semibold">{technician?.displayName || 'Não atribuído'}</p>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Data da Operação</p>
             <p className="text-sm font-semibold">{formatDate(os.date)}</p>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Status do Documento</p>
             <Badge variant={config?.variant} className="rounded-lg font-semibold uppercase text-xs px-3 py-1">{config?.label || os.status}</Badge>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 pl-1">Itens e Serviços</h4>
          <div className="border border-border/40 rounded-2xl overflow-hidden bg-background/20 backdrop-blur-sm">
              <Table>
                  <TableHeader className="bg-primary/[0.03] h-[34px]">
                      <TableRow className="hover:bg-transparent border-border/40 h-[34px]">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Descrição</TableHead>
                          <TableHead className="text-center text-[10px] font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Qtd.</TableHead>
                          <TableHead className="text-right text-[10px] font-semibold uppercase tracking-widest text-primary/40 h-[34px]">Subtotal</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {os.items.map(i => (
                          <TableRow key={i.id} className="border-border/40 hover:bg-primary/[0.02] h-[34px]">
                              <TableCell className="py-0 text-xs font-semibold">{i.product.description}</TableCell>
                              <TableCell className="py-0 text-center text-xs font-semibold opacity-60">{formatQuantity(i.quantity)}</TableCell>
                              <TableCell className="py-0 text-right text-xs font-semibold text-primary">{formatCurrency(i.total)}</TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </div>
          <div className="flex flex-col items-end pt-2 pr-2 space-y-1">
               {os.discount > 0 && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Subtotal: {formatCurrency(subtotal)}</p>}
               {os.discount > 0 && <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest bg-destructive/10 px-2 py-0.5 rounded-lg">Desconto ({os.discount}%): -{formatCurrency(discountAmount)}</p>}
               <div className="pt-2 border-t border-border/40 mt-2 w-48 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Total Consolidado</p>
                  <p className="font-semibold text-2xl tracking-tighter">{formatCurrency(totalAfterDiscount)}</p>
               </div>
          </div>
        </div>

        {os.notes && (
            <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 pl-1">Relatório Técnico</h4>
                <div className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap bg-primary/[0.03] border border-border/40 p-5 rounded-2xl italic text-foreground/80 shadow-inner">
                  {os.notes}
                </div>
            </div>
        )}
      </div>
    )
  };

  const renderVisitDetails = (visit: Visit) => {
    const config = visitStatusConfig[visit.status as keyof typeof visitStatusConfig];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Cliente</p>
             <p className="text-sm font-semibold">{client?.name}</p>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Técnico Responsável</p>
             <p className="text-sm font-semibold">{technician?.displayName || 'Não atribuído'}</p>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Data da Visita</p>
             <p className="text-sm font-semibold">{formatDate(visit.visitDate)}</p>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Status do Documento</p>
             <Badge variant={config?.variant} className="rounded-lg font-semibold uppercase text-xs px-3 py-1">{config?.label || visit.status}</Badge>
          </div>
          <div className="bg-background/40 p-4 rounded-2xl border border-border/40 space-y-1 col-span-1 sm:col-span-2">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/40">Endereço da Ocorrência</p>
             <p className="text-xs font-semibold opacity-60 leading-relaxed">{visit.address}</p>
          </div>
        </div>

        <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 pl-1">Motivo da Visita</h4>
            <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap bg-background/30 border border-border/40 p-4 rounded-2xl">
              {visit.description}
            </div>
        </div>

        {visit.serviceReport && (
            <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60 pl-1">Relatório Técnico</h4>
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap bg-primary/[0.03] border border-border/40 p-4 rounded-2xl italic text-foreground/80 shadow-inner">
                  {visit.serviceReport}
                </div>
            </div>
        )}

        {visit.requiredMaterials && (
            <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500/60 pl-1">Materiais Necessários</h4>
                <div className="text-sm font-semibold leading-relaxed whitespace-pre-wrap bg-orange-500/[0.03] border border-orange-500/10 p-4 rounded-2xl text-orange-950/70">
                  {visit.requiredMaterials}
                </div>
            </div>
        )}
      </div>
    )
  };

  const renderContent = () => {
    switch (item.type) {
      case 'os':
        return renderOsDetails(item as Quote);
      case 'visit':
        return renderVisitDetails(item as Visit);
      // case 'purchase':
      //   return renderPurchaseDetails(item as PurchaseOrder);
      default:
        return <p>Tipo de item desconhecido.</p>;
    }
  };

  const getTitle = () => {
    switch (item.type) {
        case 'os': return `Detalhes da O.S. - ${(item as Quote).quoteNumber.replace("ORC", "OS")}`;
        case 'visit': return `Detalhes da Visita - ${(item as Visit).visitNumber}`;
        case 'purchase': return `Detalhes do Pedido - ${(item as PurchaseOrder).orderNumber}`;
        default: return "Detalhes do Item";
    }
  }


  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl flex flex-col p-0 max-h-[90vh] bg-background/60 backdrop-blur-3xl border-border/40 shadow-premium rounded-xl overflow-hidden">
        <DialogHeader className="p-8 border-b border-border/40 bg-primary/[0.02]">
          <DialogTitle className="text-2xl font-semibold tracking-tight text-primary">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold uppercase tracking-widest opacity-40">Detalhamento técnico completo do documento</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6">
            <div className="pb-6">
                {renderContent()}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
