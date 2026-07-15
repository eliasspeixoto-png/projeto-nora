

"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getProducts, addProduct, updateProduct, deleteProduct, getSuppliers, getStockLocations, bulkAddProducts } from '@/lib/firebase/firestore';
import type { Product, Supplier, StockLocation } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Search, Package, Upload, Download, Settings2, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ProductList from '@/components/produtos/product-list';
import AddEditProductDialog from '@/components/produtos/add-edit-product-dialog';
// xlsx importado dinamicamente nas funções de uso
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import BulkPriceUpdateDialog from '@/components/produtos/bulk-price-update-dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function ProdutosPageClient() {
  const { userProfile, firebase } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Ativo');
  
  const { items: sortedProducts, requestSort, sortConfig } = useSortableData(products, { key: 'description', direction: 'asc' });
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isPriceUpdateOpen, setPriceUpdateOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile?.companyId && firebase.db) {
      const unsubProducts = getProducts(
        firebase.db,
        userProfile.companyId,
        setProducts,
        (error) => {
          toast({
            variant: 'destructive',
            title: 'Erro ao buscar produtos',
            description: error.message,
          });
        },
        filterStatus as 'Ativo' | 'Inativo' | 'Todos'
      );
       const unsubSuppliers = getSuppliers(firebase.db, userProfile.companyId, setSuppliers, console.error);
       const unsubLocations = getStockLocations(firebase.db, userProfile.companyId, setLocations, console.error);
       
      setIsLoading(false);

      return () => {
        unsubProducts();
        unsubSuppliers();
        unsubLocations();
      };
    } else if (!userProfile) {
        setIsLoading(false);
    }
  }, [userProfile?.companyId, firebase.db, filterStatus]);

  // Rola a lista para o topo sempre que a busca ou filtro mudar
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [searchTerm, filterStatus]);
  
  const onProductSaved = async (productData: Omit<Product, 'id' | 'companyId'>) => {
    if (!userProfile?.companyId || !firebase.db) return;
    
    try {
        if (editingProduct) {
            await updateProduct(firebase.db, editingProduct.id, {...productData, companyId: userProfile.companyId});
        } else {
            await addProduct(firebase.db, {...productData, companyId: userProfile.companyId});
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setDialogOpen(false);
    } catch(err: any) {
        toast({
            variant: "destructive",
            title: `Erro ao ${editingProduct ? 'atualizar' : 'adicionar'} item`,
            description: err.message,
        });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingProduct(undefined);
    setDialogOpen(true);
  };

  const handleDelete = async (productId: string) => {
    if (!firebase.db) return;
    try {
        await deleteProduct(firebase.db, productId);
        toast({ title: 'Item excluído com sucesso!' });
        queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch(err: any) {
        toast({
            variant: 'destructive',
            title: 'Erro ao excluir item',
            description: err.message,
        });
    }
  };

  const filteredProducts = sortedProducts.filter((product) => {
    const search = searchTerm.toLowerCase();
    return (
      product.description.toLowerCase().includes(search) ||
      product.item.toLowerCase().includes(search) ||
      (product.manufacturer && product.manufacturer.toLowerCase().includes(search)) ||
      (product.segment && product.segment.toLowerCase().includes(search))
    );
  });
  
  const handleExportToExcel = async () => {
    const { utils, writeFile } = await import('xlsx');
    const worksheet = utils.json_to_sheet(products);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Produtos');
    writeFile(workbook, 'catalogo_produtos.xlsx');
  };

   const handleImportFile = async () => {
    if (!fileToImport || !userProfile?.companyId || !firebase.db) return;
    
    setIsImporting(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const { read, utils } = await import('xlsx');
            const data = e.target?.result;
            const workbook = read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json(worksheet);

            if(json.length > 0) {
                const { added, updated, skipped } = await bulkAddProducts(firebase.db, userProfile.companyId as string, json as any, suppliers, locations);
                 toast({
                    title: "Importação Concluída!",
                    description: `${added} produtos adicionados, ${updated} atualizados, ${skipped} ignorados.`,
                });
                queryClient.invalidateQueries({ queryKey: ['products'] });
            } else {
                toast({ variant: 'destructive', title: "Arquivo Vazio", description: "A planilha selecionada não contém dados." });
            }
            
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erro na Importação", description: error.message });
        } finally {
            setIsImporting(false);
            setFileToImport(null);
            setImportModalOpen(false);
        }
    };
    reader.readAsBinaryString(fileToImport);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-semibold flex items-center gap-2 text-xl">
          <Package /> Catálogo de Produtos e Serviços
        </h1>
        <div className="flex gap-2">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Ações
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setImportModalOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Planilha
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={handleExportToExcel}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar para Excel
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => setPriceUpdateOpen(true)}>
                    <Percent className="mr-2 h-4 w-4" />
                    Atualizar Preços em Massa
                </DropdownMenuItem>
            </DropdownMenuContent>
           </DropdownMenu>
          <Button onClick={handleAddNew} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
          </Button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, fabricante ou segmento..."
            className="w-full rounded-lg bg-background pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="Ativo">Ativos</SelectItem>
                <SelectItem value="Inativo">Inativos</SelectItem>
                <SelectItem value="Todos">Todos</SelectItem>
            </SelectContent>
        </Select>
      </div>
      
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="flex-1 flex flex-col min-h-0">
            <CardContent ref={listContainerRef} className="flex-1 overflow-auto p-0">
                <ProductList 
                    products={filteredProducts} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                    suppliers={suppliers}
                    sortConfig={sortConfig}
                    requestSort={requestSort}
                />
            </CardContent>
        </Card>
      )}
      
      <AddEditProductDialog
        isOpen={isDialogOpen}
        setOpen={setDialogOpen}
        onProductSaved={onProductSaved}
        product={editingProduct}
        suppliers={suppliers}
        locations={locations}
      />
      <BulkPriceUpdateDialog 
        isOpen={isPriceUpdateOpen}
        setOpen={setPriceUpdateOpen}
        products={products}
        suppliers={suppliers}
      />
       <AlertDialog open={isImportModalOpen} onOpenChange={setImportModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Importar Produtos de Planilha</AlertDialogTitle>
                <AlertDialogDescription>
                    Selecione um arquivo .xlsx ou .csv. Certifique-se de que as colunas da sua planilha correspondem aos campos do sistema (ex: 'item', 'description', 'sellingPrice', 'manufacturer').
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="import-file">Arquivo da Planilha</Label>
              <Input id="import-file" type="file" accept=".xlsx, .csv" onChange={(e) => setFileToImport(e.target.files?.[0] || null)} />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleImportFile} disabled={!fileToImport || isImporting}>
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Importar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
