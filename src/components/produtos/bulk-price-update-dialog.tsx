
"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Product, Supplier } from "@/lib/data";
import { bulkUpdateProductPrices } from "@/lib/firebase/firestore";
import { Loader2, Percent } from "lucide-react";
import { useAuth } from "@/firebase/auth/use-user";
import { Checkbox } from "@/components/ui/checkbox";

type BulkPriceUpdateDialogProps = {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  products: Product[];
  suppliers: Supplier[];
};

const formatCurrency = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return 'R$ 0,00';
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
};

type PriceType = 'sellingPrice' | 'materialPrice' | 'servicePrice';
const priceTypeOrder: PriceType[] = ['materialPrice', 'sellingPrice', 'servicePrice'];

export default function BulkPriceUpdateDialog({ isOpen, setOpen, products, suppliers }: BulkPriceUpdateDialogProps) {
  const { userProfile, firebase } = useAuth();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<"manufacturer" | "supplier">("manufacturer");
  const [selectedValue, setSelectedValue] = useState<string>("all");
  const [percentage, setPercentage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceTypes, setPriceTypes] = useState<PriceType[]>(["materialPrice"]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const filterOptions = useMemo(() => {
    if (filterType === "manufacturer") {
      const manufacturers = Array.from(new Set(products.map((p) => p.manufacturer).filter((m): m is string => !!m)));
      return manufacturers.sort();
    } else {
      return suppliers.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [filterType, products, suppliers]);

  const productsToUpdate = useMemo(() => {
    if (selectedValue === "all") {
      return products;
    }
    if (filterType === "manufacturer") {
      return products.filter((p) => p.manufacturer === selectedValue);
    } else {
      return products.filter((p) => p.mainSupplierId === selectedValue);
    }
  }, [selectedValue, filterType, products]);

  // Update selected products when filter changes
  useEffect(() => {
      setSelectedProducts(productsToUpdate.map(p => p.id));
  }, [productsToUpdate]);


  const percentValue = parseFloat(percentage);

  const handlePriceTypeChange = (type: PriceType, checked: boolean | 'indeterminate') => {
      setPriceTypes(prev => {
          if (checked) {
              return [...prev, type];
          } else {
              return prev.filter(t => t !== type);
          }
      });
  };

  const sortedPriceTypes = useMemo(() => {
    return [...priceTypes].sort((a, b) => priceTypeOrder.indexOf(a) - priceTypeOrder.indexOf(b));
  }, [priceTypes]);

  const handleUpdatePrices = async () => {
    if (!userProfile?.companyId) {
        toast({ variant: "destructive", title: "Erro de Autenticação", description: "Não foi possível identificar sua empresa." });
        return;
    }
    if (isNaN(percentValue)) {
      toast({ variant: "destructive", title: "Valor inválido", description: "Por favor, insira uma porcentagem válida." });
      return;
    }
    if (priceTypes.length === 0) {
      toast({ variant: "destructive", title: "Nenhum tipo de preço selecionado", description: "Selecione pelo menos um tipo de preço para atualizar." });
      return;
    }
    const finalProductsToUpdate = productsToUpdate.filter(p => selectedProducts.includes(p.id));
    if (finalProductsToUpdate.length === 0) {
      toast({ variant: "destructive", title: "Nenhum produto selecionado", description: "Selecione pelo menos um produto para atualizar." });
      return;
    }

    setIsSubmitting(true);
    try {
        if (!firebase.db) throw new Error("Conexão com banco de dados indisponível.");
        await bulkUpdateProductPrices(firebase.db, userProfile.companyId, finalProductsToUpdate.map(p => p.id), percentValue, priceTypes);
        toast({ title: "Sucesso!", description: `${finalProductsToUpdate.length} produtos foram atualizados com sucesso.` });
        setOpen(false);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleSelectAll = (checked: boolean | 'indeterminate') => {
      if (checked) {
          setSelectedProducts(productsToUpdate.map(p => p.id));
      } else {
          setSelectedProducts([]);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-screen-xl sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Atualização de Preços em Massa</DialogTitle>
          <DialogDescription>
            Selecione um filtro, os tipos de preço, defina a porcentagem de ajuste e visualize os produtos que serão atualizados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
          <div className="space-y-2">
            <Label>Tipos de Preço para Ajustar</Label>
            <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id="type-custo" checked={priceTypes.includes('materialPrice')} onCheckedChange={(c) => handlePriceTypeChange('materialPrice', c as boolean)} />
                    <Label htmlFor="type-custo">Preço de Custo</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="type-venda" checked={priceTypes.includes('sellingPrice')} onCheckedChange={(c) => handlePriceTypeChange('sellingPrice', c as boolean)} />
                    <Label htmlFor="type-venda">Preço de Venda</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="type-servico" checked={priceTypes.includes('servicePrice')} onCheckedChange={(c) => handlePriceTypeChange('servicePrice', c as boolean)} />
                    <Label htmlFor="type-servico">Preço de Serviço</Label>
                </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Filtrar por</Label>
            <RadioGroup value={filterType} onValueChange={(v) => {setFilterType(v as any); setSelectedValue("all");}} className="flex gap-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="manufacturer" id="r-man" /><Label htmlFor="r-man">Fabricante</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="supplier" id="r-sup" /><Label htmlFor="r-sup">Fornecedor</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>{filterType === 'manufacturer' ? 'Fabricante' : 'Fornecedor'}</Label>
            <Select value={selectedValue} onValueChange={setSelectedValue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filterOptions.map((opt) => (
                  <SelectItem key={typeof opt === 'string' ? opt : opt.id} value={typeof opt === 'string' ? opt : opt.id}>
                    {typeof opt === 'string' ? opt : opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ajuste Percentual (%)</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="Ex: 5 ou -10"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="pr-8"
              />
              <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <p className="text-sm font-medium">Produtos a serem atualizados: {selectedProducts.length} de {productsToUpdate.length}</p>

        <div className="flex-1 border rounded-md">
          <ScrollArea className="h-full">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-12 h-[34px]">
                    <Checkbox
                            checked={selectedProducts.length === productsToUpdate.length && productsToUpdate.length > 0}
                            onCheckedChange={handleSelectAll}
                        />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    {sortedPriceTypes.map(type => (
                        <React.Fragment key={type}>
                            <TableHead className="text-right h-[34px]">
                            {type === 'sellingPrice' ? 'P. Venda Atual' : type === 'materialPrice' ? 'P. Custo Atual' : 'P. Serviço Atual'}
                            </TableHead>
                            <TableHead className="text-right text-primary h-[34px]">
                            {type === 'sellingPrice' ? 'Novo P. Venda' : type === 'materialPrice' ? 'Novo P. Custo' : 'Novo P. Serviço'}
                            </TableHead>
                        </React.Fragment>
                    ))}
                </TableRow>
                </TableHeader>
                <TableBody>
                {productsToUpdate.slice(0, 100).map((product) => (
                    <TableRow key={product.id}>
                        <TableCell>
                        <Checkbox
                                checked={selectedProducts.includes(product.id)}
                                onCheckedChange={(checked) => {
                                    setSelectedProducts(prev => checked ? [...prev, product.id] : prev.filter(id => id !== product.id));
                                }}
                            />
                        </TableCell>
                        <TableCell>
                        <p className="font-medium text-xs truncate">{product.description}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.item}</p>
                        </TableCell>
                        {sortedPriceTypes.map(type => {
                            const currentPrice = product[type] || 0;
                            const newPrice = !isNaN(percentValue) ? currentPrice * (1 + percentValue / 100) : currentPrice;
                            return (
                                <React.Fragment key={type}>
                                    <TableCell className="py-0 text-right text-xs">{formatCurrency(currentPrice)}</TableCell>
                                    <TableCell className="py-0 text-right text-xs font-semibold text-primary">{formatCurrency(newPrice)}</TableCell>
                                </React.Fragment>
                            )
                        })}
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
            {productsToUpdate.length > 100 && (
                    <p className="text-center text-xs text-muted-foreground p-2">E mais {productsToUpdate.length - 100} produtos...</p>
                )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleUpdatePrices} disabled={isSubmitting || selectedProducts.length === 0 || isNaN(percentValue) || priceTypes.length === 0}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar Ajuste de {percentage}%
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
