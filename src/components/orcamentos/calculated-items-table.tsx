
"use client";

import React, { useState } from 'react';
import type { QuoteItem, Product } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Save, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Percent, AlertTriangle, Wrench } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';


type CalculatedItemsTableProps = {
  items: QuoteItem[];
  setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
  onItemChange: (itemId: string, newQuantity: number | string, includeService?: boolean, includeMaterial?: boolean) => void;
  onDeleteItem: (itemId: string) => void;
  onEditItem?: (product: Product) => void;
  onSaveQuote: () => void;
  discountPercentage: number;
  setDiscountPercentage: (value: number) => void;
  installments: number;
  setInstallments: (value: number) => void;
  interestRate: number;
  setInterestRate: (value: number) => void;
  isOsAvulsa?: boolean;
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

const formatProductName = (name: string) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function CalculatedItemsTable({ 
    items, 
    setItems,
    onItemChange, 
    onDeleteItem,
    onEditItem, 
    onSaveQuote,
    discountPercentage,
    setDiscountPercentage,
    installments,
    setInstallments,
    interestRate,
    setInterestRate,
    isOsAvulsa = false,
}: CalculatedItemsTableProps) {
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isAlertOpen, setAlertOpen] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  
  // --- NOVAS REGRAS DE CÁLCULO ---
  const discountAmount = (subtotal * discountPercentage) / 100;
  const totalAfterDiscount = subtotal - discountAmount;
  
  const totalWithInterest = subtotal * (1 + (interestRate / 100));

  const confirmDelete = (itemId: string) => {
    setItemToDelete(itemId);
    setAlertOpen(true);
  };

  const handleDelete = () => {
    if (itemToDelete) {
      onDeleteItem(itemToDelete);
      setItemToDelete(null);
      setAlertOpen(false);
    }
  };


  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border/40 bg-primary/5 min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
        <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
            <Edit className="h-8 w-8 opacity-50" />
        </div>
        <h3 className="font-semibold text-lg tracking-tight">O orçamento está vazio</h3>
        <p className="text-sm text-muted-foreground max-w-xs mt-2 italic">Adicione produtos ou serviços da vitrine lateral para começar a compor os custos desta proposta.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50 h-[34px]">
            <TableRow className="hover:bg-transparent h-[34px]">
              <TableHead className="w-[5%] text-center text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">#</TableHead>
              <TableHead className="w-[10%] text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Código</TableHead>
              <TableHead className="w-[30%] text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Descrição Detalhada</TableHead>
              <TableHead className="w-[10%] text-center text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Qtd.</TableHead>
              <TableHead className="w-[10%] text-center text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Unid.</TableHead>
              {!isOsAvulsa && (
                <>
                  <TableHead className="w-[8%] text-center text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Mat.</TableHead>
                  <TableHead className="w-[12%] text-right text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Unitário</TableHead>
                  <TableHead className="w-[8%] text-center text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Inst.</TableHead>
                  <TableHead className="w-[10%] text-right text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Mão Obra</TableHead>
                  <TableHead className="w-[15%] text-right text-[10px] font-semibold uppercase tracking-widest text-primary/60 px-4 h-[34px]">Subtotal Acum.</TableHead>
                </>
              )}
              <TableHead className="w-[5%] text-right px-4 h-[34px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow 
                key={item.id}
                className="quote-item-row"
              >
                 <TableCell className="py-0 text-center font-mono text-xs text-muted-foreground px-4">
                  {index + 1}
                </TableCell>
                <TableCell className="py-0 font-mono text-xs px-4">
                  {item.product?.item || (item as any).productCode || ''}
                </TableCell>
                <TableCell className="py-0 text-xs px-4">
                  {formatProductName(item.product?.description || (item as any).description || (item as any).productDescription || '')}
                </TableCell>
                <TableCell className="py-0 text-center px-4">
                  <Input
                    type="number"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => onItemChange(item.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onDragStart={(e) => e.stopPropagation()}
                    className="h-8 w-20 text-center mx-auto cursor-text"
                    min="0"
                  />
                </TableCell>
                <TableCell className="py-0 text-center text-xs px-4">{item.product?.unit || 'UNID'}</TableCell>
                {!isOsAvulsa && (
                  <>
                    <TableCell className="py-0 text-center px-4">
                      <Checkbox 
                        checked={item.includeMaterial !== false} 
                        onCheckedChange={(checked) => onItemChange(item.id, item.quantity, item.includeService, !!checked)}
                        className="h-4 w-4 rounded-sm border-primary/30"
                      />
                    </TableCell>
                    <TableCell className={cn(
                      "py-0 text-right text-xs font-medium px-4",
                      item.includeMaterial === false && "text-muted-foreground/30 line-through decoration-destructive/30"
                    )}>
                      {formatCurrency(item.materialPrice)}
                    </TableCell>
                    <TableCell className="py-0 text-center px-4">
                      <Checkbox 
                        checked={item.includeService !== false} 
                        onCheckedChange={(checked) => onItemChange(item.id, item.quantity, !!checked, item.includeMaterial)}
                        className="h-4 w-4 rounded-sm border-primary/30"
                      />
                    </TableCell>
                    <TableCell className={cn(
                      "py-0 text-right text-xs font-medium px-4",
                      item.includeService === false && "text-muted-foreground/30 line-through decoration-destructive/30"
                    )}>
                      {formatCurrency(item.servicePrice)}
                    </TableCell>
                    <TableCell className="py-0 text-right font-semibold text-xs text-primary px-4">{formatCurrency(item.total)}</TableCell>
                  </>
                )}
                 <TableCell className="py-0 text-right px-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         {onEditItem && (
                            <DropdownMenuItem onClick={() => item.product && onEditItem(item.product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar Produto
                            </DropdownMenuItem>
                         )}
                         <DropdownMenuItem onClick={() => confirmDelete(item.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                         </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {!isOsAvulsa && (
       <div className="mt-4 rounded-lg border overflow-hidden">
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full justify-end p-6 border-b bg-muted/10">
              <div className="grid w-full sm:max-w-[160px] items-center gap-1.5">
                  <Label htmlFor="discountPercentage" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Desconto (%)</Label>
                  <div className="relative">
                      <Input 
                          type="number"
                          id="discountPercentage"
                          value={discountPercentage || ''}
                          onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="w-full pr-8 h-10 font-semibold border-border/40 shadow-sm cursor-text"
                          placeholder="0"
                          min="0"
                      />
                      <Percent className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                  </div>
              </div>
                <div className="grid w-full sm:max-w-[160px] items-center gap-1.5">
                  <Label htmlFor="interestRate" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Juros Mensal (%)</Label>
                  <div className="relative">
                      <Input 
                          type="number"
                          id="interestRate"
                          value={interestRate || ''}
                          onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="w-full pr-8 h-10 font-semibold border-border/40 shadow-sm cursor-text"
                          placeholder="0"
                          min="0"
                      />
                      <Percent className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                  </div>
              </div>
              <div className="grid w-full sm:max-w-[160px] items-center gap-1.5">
                <Label htmlFor="installments" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Parcelamento</Label>
                    <Select value={String(installments)} onValueChange={(value) => setInstallments(Number(value))}>
                    <SelectTrigger className="w-full h-10 font-semibold border-border/40 shadow-sm" id="installments">
                        <SelectValue placeholder="Nº de parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i).map(i => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                                {i + 1}x {i + 1 > 1 && totalWithInterest > 0 ? `Parcelado`: 'à Vista'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
          </div>
            <div className="flex flex-col items-end gap-1 text-right p-6">
                <p className="text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</p>
                {discountPercentage > 0 && <p className="text-sm text-destructive">Desconto ({discountPercentage}%): -{formatCurrency(discountAmount)}</p>}
                
                <p className="text-base font-semibold">Total (à vista): {formatCurrency(totalAfterDiscount)}</p>
                
                {installments > 1 && (
                    <>
                      <p className="text-lg font-semibold">Total (a prazo): {formatCurrency(totalWithInterest)}</p>
                      <p className="text-sm text-muted-foreground">{installments}x de {formatCurrency(totalWithInterest / installments)}</p>
                    </>
                )}
            </div>
      </div>
      )}

      <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remover Item?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item do {isOsAvulsa ? "serviço" : "orçamento"}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
