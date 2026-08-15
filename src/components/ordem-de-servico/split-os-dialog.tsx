"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/firebase/auth/use-user";
import { splitQuoteIntoChildOrders } from "@/lib/firebase/firestore";
import type { Quote, UserProfile } from "@/lib/data";
import { Layers, Calendar, Clock, User, Check, Loader2, Sparkles, Package, Truck, Building, Tag } from "lucide-react";
import { format, addDays } from "date-fns";

type SplitOsDialogProps = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  quote: Quote | null;
  teamMembers: UserProfile[];
  onSuccess?: () => void;
};

type ChildOSRow = {
  unitIdentifier: string;
  scheduledDate: string;
  scheduledTime: string;
  expectedEndDate: string;
  expectedEndTime: string;
  assignedTechnicianId: string;
  notes: string;
};

export default function SplitOsDialog({ isOpen, setOpen, quote, teamMembers, onSuccess }: SplitOsDialogProps) {
  const { firebase, userProfile } = useAuth();
  const { toast } = useToast();

  const [count, setCount] = useState<number>(2);
  const [namingPattern, setNamingPattern] = useState<"caminhao" | "apto" | "placa" | "custom">("caminhao");
  const [batchStartDate, setBatchStartDate] = useState<string>("");
  const [batchExpectedEndDate, setBatchExpectedEndDate] = useState<string>("");
  const [batchTechnicianId, setBatchTechnicianId] = useState<string>("none");
  const [bulkPlatesText, setBulkPlatesText] = useState<string>("");

  const [childList, setChildList] = useState<ChildOSRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const technicians = teamMembers
    .filter((m) => ["admin", "supervisor", "tecnico"].includes(m.role))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Inicializa datas e linhas quando abre o modal
  useEffect(() => {
    if (isOpen && quote) {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const defaultEndStr = quote.expectedEndDate || format(addDays(new Date(), 15), "yyyy-MM-dd");
      const initialCount = quote.childOSCount || (quote.items && quote.items[0]?.quantity > 1 ? quote.items[0].quantity : 2);
      
      const parsedCount = Math.max(2, Math.min(100, initialCount));
      setCount(parsedCount);
      setBatchStartDate(quote.scheduledDate || todayStr);
      setBatchExpectedEndDate(defaultEndStr);
      setBatchTechnicianId(quote.assignedTechnicianId || "none");
      setBulkPlatesText("");

      generateRows(parsedCount, "caminhao", quote.scheduledDate || todayStr, defaultEndStr, quote.assignedTechnicianId || "none");
    }
  }, [isOpen, quote]);

  const generateRows = (
    num: number,
    pattern: string,
    sDate: string,
    eDate: string,
    techId: string,
    customPlatesList?: string[]
  ) => {
    const rows: ChildOSRow[] = [];
    for (let i = 0; i < num; i++) {
      let identifier = "";
      if (customPlatesList && customPlatesList[i]) {
        identifier = customPlatesList[i].trim();
      } else if (pattern === "caminhao") {
        identifier = `Caminhão ${String(i + 1).padStart(2, "0")}`;
      } else if (pattern === "apto") {
        identifier = `Apto ${String(i + 1).padStart(2, "0")}`;
      } else if (pattern === "placa") {
        identifier = `Placa / Tag ${i + 1}`;
      } else {
        identifier = `Unidade ${i + 1}`;
      }

      rows.push({
        unitIdentifier: identifier,
        scheduledDate: sDate,
        scheduledTime: "09:00",
        expectedEndDate: eDate,
        expectedEndTime: "18:00",
        assignedTechnicianId: techId === "none" ? "" : techId,
        notes: "",
      });
    }
    setChildList(rows);
  };

  const handleCountChange = (newCount: number) => {
    const val = Math.max(2, Math.min(100, newCount));
    setCount(val);
    generateRows(val, namingPattern, batchStartDate, batchExpectedEndDate, batchTechnicianId);
  };

  const handlePatternChange = (pattern: "caminhao" | "apto" | "placa" | "custom") => {
    setNamingPattern(pattern);
    generateRows(count, pattern, batchStartDate, batchExpectedEndDate, batchTechnicianId);
  };

  const handleApplyBatchDatesAndTech = () => {
    const updated = childList.map((row) => ({
      ...row,
      scheduledDate: batchStartDate || row.scheduledDate,
      expectedEndDate: batchExpectedEndDate || row.expectedEndDate,
      assignedTechnicianId: batchTechnicianId === "none" ? "" : batchTechnicianId,
    }));
    setChildList(updated);
    toast({ title: "Configurações aplicadas a todas as O.S." });
  };

  const handleApplyBulkPlates = () => {
    const lines = bulkPlatesText
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      const newCount = lines.length;
      setCount(newCount);
      generateRows(newCount, "custom", batchStartDate, batchExpectedEndDate, batchTechnicianId, lines);
      toast({ title: `${lines.length} identificadores carregados!` });
    }
  };

  const handleRowChange = (index: number, field: keyof ChildOSRow, value: string) => {
    const updated = [...childList];
    updated[index] = { ...updated[index], [field]: value };
    setChildList(updated);
  };

  const handleSubmit = async () => {
    if (!quote || !firebase.db || !firebase.auth) return;

    setIsSubmitting(true);
    try {
      const preparedList = childList.map((row) => {
        const tech = technicians.find((t) => t.uid === row.assignedTechnicianId);
        return {
          unitIdentifier: row.unitIdentifier.trim() || "Unidade",
          scheduledDate: row.scheduledDate,
          scheduledTime: row.scheduledTime,
          expectedEndDate: row.expectedEndDate,
          expectedEndTime: row.expectedEndTime,
          assignedTechnicianId: row.assignedTechnicianId,
          assignedTechnicianName: tech?.displayName || "",
          notes: row.notes,
        };
      });

      const res = await splitQuoteIntoChildOrders(firebase.db, firebase.auth, quote.id, count, preparedList);

      toast({
        title: "Sucesso!",
        description: `${res.count} Ordens de Serviço geradas e desmembradas com sucesso a partir de ${quote.quoteNumber.replace('ORC', 'OS')}.`,
      });

      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Erro ao fatiar O.S.:", error);
      toast({ variant: "destructive", title: "Erro ao fatiar O.S.", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quote) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] flex flex-col p-0 bg-background/95 backdrop-blur-3xl border border-border/40 shadow-2xl rounded-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-primary/[0.04] border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Fatiar Orçamento em Múltiplas O.S.
                <Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
                  {quote.quoteNumber.replace("ORC", "OS")}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Divida este orçamento de <strong>{quote.clientName}</strong> em ordens de serviço individuais fracionadas por veículo, apartamento ou unidade.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 custom-scrollbar">
          <div className="space-y-6">
            {/* Divisão Proporcional de Materiais */}
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
                  <Package className="h-4 w-4" />
                  Divisão Automática de Materiais por O.S. ({count} O.S.)
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  Total da O.S.: R$ {(quote.total / count).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cada
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {(quote.items || []).map((item, idx) => {
                  const qtyPerOS = (item.quantity / count).toFixed(2).replace(/\.00$/, "");
                  return (
                    <div key={idx} className="p-2 rounded-lg bg-background/80 border border-border/40 flex justify-between items-center text-xs">
                      <span className="truncate max-w-[180px] font-medium text-foreground/80">{item.product.description}</span>
                      <span className="font-bold text-primary shrink-0 ml-2">
                        {qtyPerOS} {item.product.unit || "un"} / O.S.
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controles de Lote */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-muted/20 border border-border/40">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Quantidade de O.S.</Label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={count}
                  onChange={(e) => handleCountChange(Number(e.target.value))}
                  className="h-9 font-bold text-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Padrão de Nome</Label>
                <Select value={namingPattern} onValueChange={(v: any) => handlePatternChange(v)}>
                  <SelectTrigger className="h-9 font-semibold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caminhao" className="font-semibold text-xs">
                      <div className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5" /> Caminhão 01, 02...
                      </div>
                    </SelectItem>
                    <SelectItem value="apto" className="font-semibold text-xs">
                      <div className="flex items-center gap-2">
                        <Building className="h-3.5 w-3.5" /> Apto 01, 02...
                      </div>
                    </SelectItem>
                    <SelectItem value="placa" className="font-semibold text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5" /> Placa / Tag
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Início da Execução</Label>
                <Input
                  type="date"
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  className="h-9 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Previsão de Término</Label>
                <Input
                  type="date"
                  value={batchExpectedEndDate}
                  onChange={(e) => setBatchExpectedEndDate(e.target.value)}
                  className="h-9 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Importação Rápida de Placas/TAGs em lote */}
            <div className="p-4 rounded-xl bg-muted/10 border border-border/40 space-y-2">
              <Label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                <span>Colar Lista de Placas / Identificadores (separados por vírgula ou linha):</span>
                <Button variant="outline" size="sm" onClick={handleApplyBulkPlates} className="h-7 text-[10px] font-bold">
                  <Sparkles className="h-3 w-3 mr-1" /> Aplicar Placas
                </Button>
              </Label>
              <Textarea
                placeholder="Ex: ABC-1234, DEF-5678, GHI-9012, JKL-3456..."
                rows={2}
                value={bulkPlatesText}
                onChange={(e) => setBulkPlatesText(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* Tabela de O.S. Individuais */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Detalhamento das {childList.length} O.S. Filhas
                </Label>
                <Button variant="ghost" size="sm" onClick={handleApplyBatchDatesAndTech} className="h-7 text-[11px] font-semibold text-primary">
                  Replicar datas e técnico em todas
                </Button>
              </div>

              <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="h-8">
                      <TableHead className="w-12 text-center text-[10px] font-bold uppercase">#</TableHead>
                      <TableHead className="min-w-[180px] text-[10px] font-bold uppercase">Placa / TAG / Unidade</TableHead>
                      <TableHead className="min-w-[140px] text-[10px] font-bold uppercase">Início Execução</TableHead>
                      <TableHead className="min-w-[140px] text-[10px] font-bold uppercase">Previsão Término</TableHead>
                      <TableHead className="min-w-[180px] text-[10px] font-bold uppercase">Técnico Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childList.map((row, idx) => (
                      <TableRow key={idx} className="h-10 hover:bg-muted/30">
                        <TableCell className="text-center font-bold text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="py-1">
                          <Input
                            value={row.unitIdentifier}
                            onChange={(e) => handleRowChange(idx, "unitIdentifier", e.target.value)}
                            placeholder="Ex: Caminhão 01 ou ABC-1234"
                            className="h-8 text-xs font-semibold"
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input
                            type="date"
                            value={row.scheduledDate}
                            onChange={(e) => handleRowChange(idx, "scheduledDate", e.target.value)}
                            className="h-8 text-xs font-medium"
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <Input
                            type="date"
                            value={row.expectedEndDate}
                            onChange={(e) => handleRowChange(idx, "expectedEndDate", e.target.value)}
                            className="h-8 text-xs font-medium"
                          />
                        </TableCell>
                        <TableCell className="py-1">
                          <Select
                            value={row.assignedTechnicianId || "none"}
                            onValueChange={(val) => handleRowChange(idx, "assignedTechnicianId", val === "none" ? "" : val)}
                          >
                            <SelectTrigger className="h-8 text-xs font-semibold">
                              <SelectValue placeholder="Selecione o técnico..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Não atribuído</SelectItem>
                              {technicians.map((tech) => (
                                <SelectItem key={tech.uid} value={tech.uid} className="text-xs font-medium">
                                  {tech.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/40 flex justify-between items-center sm:justify-between">
          <div className="text-xs text-muted-foreground font-medium">
            Gerando <strong>{count}</strong> Ordens de Serviço a partir de <strong>{quote.quoteNumber.replace('ORC', 'OS')}</strong>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting} className="h-9 text-xs font-semibold">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="h-9 px-6 text-xs font-bold bg-primary text-white shadow-md">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando {count} O.S...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Efetivar Fatiamento ({count} O.S.)
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
