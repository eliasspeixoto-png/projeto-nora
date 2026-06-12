
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { Tool } from "@/lib/data";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type ToolHistoryDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  tool: Tool | null;
};

const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
        const date = parseISO(dateString);
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return "Data inválida";
    }
};

export default function ToolHistoryDialog({ isOpen, setOpen, tool }: ToolHistoryDialogProps) {
    if (!tool) return null;

    const sortedHistory = (tool.history || []).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    return (
        <Dialog open={isOpen} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Histórico da Ferramenta: {tool.name}</DialogTitle>
                    <DialogDescription>
                        Acompanhe todas as movimentações e alterações de estado.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px] h-[34px]">Data</TableHead>
                                <TableHead>Ação</TableHead>
                                <TableHead>Detalhes</TableHead>
                                <TableHead>Responsável</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedHistory.length > 0 ? sortedHistory.map((entry, index) => (
                                <TableRow key={index}>
                                    <TableCell className="py-0 text-xs">{formatDate(entry.date)}</TableCell>
                                    <TableCell className="py-0 font-medium text-xs">{entry.action}</TableCell>
                                    <TableCell className="py-0 text-xs">{entry.details}</TableCell>
                                    <TableCell className="py-0 text-xs">{entry.userName}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-0 text-center h-24">
                                        Nenhum histórico registrado para esta ferramenta.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
