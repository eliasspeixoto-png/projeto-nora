
"use client";

import { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import type { Product, Supplier } from "@/lib/data";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash2, ArrowUpDown, ImageIcon, ZoomIn, Package, PlusCircle, RefreshCw, Loader2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isFuture, parseISO } from 'date-fns';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";

type SortKey = keyof Product | 'totalPrice';
type SortDirection = 'asc' | 'desc';

type ProductListProps = {
  products: Product[];
  onRowClick?: (product: Product) => void;
  onAddProduct?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  isReadOnly?: boolean;
  sortConfig?: any;
  requestSort?: (key: any) => void;
  suppliers: Supplier[];
  distributorName?: string;
};

const formatProductName = (name: string) => {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '-';
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
};

const ProductCard = memo(({ product, onRowClick, suppliersMap, distributorName, isReadOnly, onAddProduct, onEdit, confirmDelete, handleImageClick }: any) => {
    const isPromoActive = product.isPromotion && (!product.promoExpiresAt || isFuture(parseISO(product.promoExpiresAt)));
    const itemData = product as any;
    
    const displayDescription = product.description || itemData['DESCRIÇÃO'] || itemData['DESCRICAO'] || 'Sem nome';
    const displayItem = product.item || itemData['CÓDIGO'] || itemData['CODIGO'] || '-';
    const displayDistributor = 
    itemData['DISTRIBUIDOR'] || 
    itemData['distribuidor'] || 
    product.distributor || 
    (product.mainSupplierId ? suppliersMap.get(product.mainSupplierId) : null) || 
    distributorName || 
    '-';
    
    const displaySellingPrice = product.sellingPrice || itemData['PREÇO DE VENDA'] || itemData['PRECO DE VENDA'] || 0;
    const displayStock = product.stockQuantity || itemData['ESTOQUE TOTAL'] || itemData['estoque'] || 0;

    return (
        <Card className={cn("w-full border-border/40 bg-background/50 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden transition-all hover:shadow-premium active:scale-[0.98]", onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(product)}>
            <CardHeader className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div 
                            className="relative flex-shrink-0 w-16 h-16 rounded-2xl border border-border/40 flex items-center justify-center bg-muted/30 cursor-pointer group shadow-inner"
                            onClick={(e) => { e.stopPropagation(); product.imageUrl && handleImageClick(product.imageUrl) }}
                        >
                        {product.imageUrl ? (
                            <>
                                <Image src={product.imageUrl} alt={displayDescription} fill={true} style={{objectFit:"contain"}} className="rounded-2xl p-1" sizes="64px"/>
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                    <ZoomIn className="text-white h-6 w-6"/>
                                </div>
                            </>
                        ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                        )}
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold tracking-tight leading-tight">{formatProductName(displayDescription)}</CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] font-mono border-border/40 text-muted-foreground">{displayItem}</Badge>
                                {isPromoActive && <Badge className="bg-primary/10 text-primary border-none text-[10px] font-semibold">PROMOÇÃO</Badge>}
                            </div>
                        </div>
                    </div>
                        {(onEdit || confirmDelete || onAddProduct) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 transition-colors" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl shadow-premium border-border/40">
                                {isReadOnly ? (
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddProduct?.(product); }} className="rounded-xl font-semibold">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar ao Catálogo
                                    </DropdownMenuItem>
                                ) : (
                                    <>
                                        {onEdit && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="rounded-xl font-semibold"><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                                        {confirmDelete && (
                                            <>
                                                <DropdownMenuSeparator className="bg-primary/5"/>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete(product.id); }} className="text-destructive focus:text-destructive rounded-xl font-semibold"><Trash2 className="mr-2 h-4 w-4"/>Excluir</DropdownMenuItem>
                                            </>
                                        )}
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 bg-background/50 p-2.5 rounded-xl border border-border/40 shadow-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">P. Venda</span>
                        <div className="font-bold text-sm text-blue-600">
                            {isPromoActive && typeof product.promoPrice === 'number' ? (
                                <div className="flex flex-col">
                                    <span className="text-primary">{formatCurrency(product.promoPrice)}</span>
                                    <span className="text-muted-foreground line-through text-[10px] opacity-60">{formatCurrency(displaySellingPrice)}</span>
                                </div>
                            ) : (
                                <span>{formatCurrency(displaySellingPrice)}</span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1 bg-background/50 p-2.5 rounded-xl border border-border/40 shadow-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-60">Estoque</span>
                        <p className="font-bold text-sm text-foreground/80">{displayStock}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

const ProductTableRow = memo(({ product, onRowClick, suppliersMap, distributorName, isReadOnly, onAddProduct, onEdit, confirmDelete, handleImageClick }: any) => {
    const isPromoActive = product.isPromotion && (!product.promoExpiresAt || isFuture(parseISO(product.promoExpiresAt)));
    const itemData = product as any;
    
    const displayDescription = product.description || itemData['DESCRIÇÃO'] || itemData['DESCRICAO'] || 'Sem nome';
    const displayItem = product.item || itemData['CÓDIGO'] || itemData['CODIGO'] || '-';
    const displayDistributor = 
    itemData['DISTRIBUIDOR'] || 
    itemData['distribuidor'] || 
    product.distributor || 
    (product.mainSupplierId ? suppliersMap.get(product.mainSupplierId) : null) || 
    distributorName || 
    '-';
    
    const displaySellingPrice = product.sellingPrice || itemData['PREÇO DE VENDA'] || itemData['PRECO DE VENDA'] || 0;
    const displayStock = product.stockQuantity || itemData['ESTOQUE TOTAL'] || itemData['estoque'] || 0;

    return (
    <TableRow className={cn("group transition-all duration-500 border-border/40 h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30", onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(product)}>
        <TableCell className="py-0 font-mono text-xs hidden sm:table-cell pl-6 text-foreground/60">{displayItem}</TableCell>
        <TableCell className="py-0">
            <div className="flex items-center gap-3">
                <div 
                    className="relative flex-shrink-0 w-8 h-8 rounded-lg border border-border/40 flex items-center justify-center bg-background/50 cursor-pointer group/img shadow-sm"
                    onClick={(e) => { e.stopPropagation(); product.imageUrl && handleImageClick(product.imageUrl); }}
                >
                {product.imageUrl ? (
                    <>
                    <Image src={product.imageUrl} alt={displayDescription} fill={true} style={{objectFit:"contain"}} className="rounded-lg p-0.5" sizes="32px"/>
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <ZoomIn className="text-white h-4 w-4"/>
                    </div>
                    </>
                ) : (
                    <ImageIcon className="h-3 w-3 text-muted-foreground/20" />
                )}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-foreground truncate max-w-[200px]">{formatProductName(displayDescription)}</span>
                    {isPromoActive && <Badge className="w-fit text-[9px] h-3 px-1.5 mt-0.5 bg-primary/10 text-primary border-none font-semibold uppercase tracking-tighter">PROMOÇÃO</Badge>}
                </div>
            </div>
        </TableCell>
        <TableCell className="py-0 hidden lg:table-cell text-xs font-semibold text-foreground/80 uppercase">{product.manufacturer || itemData['FABRICANTE'] || '-'}</TableCell>
        <TableCell className="py-0 hidden lg:table-cell text-xs font-semibold text-foreground/80 truncate max-w-[150px] uppercase">
            {displayDistributor}
        </TableCell>
        <TableCell className="py-0 hidden xl:table-cell text-xs">
            <Badge variant="secondary" className="h-6 px-2 text-xs bg-primary/5 text-primary border-none font-semibold uppercase">{product.segment || itemData['CATEGORIA'] || 'OUTROS'}</Badge>
        </TableCell>
        <TableCell className="py-0 hidden xl:table-cell text-xs">
            <Badge variant={(product.status === 'Ativo' || itemData['STATUS'] === 'Ativo') ? 'success' : 'destructive'} className="h-6 px-2 text-xs font-semibold uppercase">{product.status || itemData['STATUS'] || 'Ativo'}</Badge>
        </TableCell>
        <TableCell className="py-0 text-center font-semibold text-xs text-foreground/80 hidden sm:table-cell">{displayStock}</TableCell>
        <TableCell className="py-0 text-right text-xs hidden sm:table-cell pr-6 font-semibold text-blue-600">
            {isPromoActive && typeof product.promoPrice === 'number' ? (
                <div className="flex flex-col items-end">
                    <span className="text-primary">{formatCurrency(product.promoPrice)}</span>
                    <span className="text-muted-foreground line-through text-[9px] opacity-60 ml-1">{formatCurrency(displaySellingPrice)}</span>
                </div>
            ) : (
                <span>{formatCurrency(displaySellingPrice)}</span>
            )}
        </TableCell>
        <TableCell className="py-0 text-right pr-6">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 transition-colors" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl shadow-premium border-border/40">
                {isReadOnly ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddProduct?.(product); }} className="rounded-xl font-semibold">
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar ao Catálogo
                    </DropdownMenuItem>
                ) : (
                    <>
                        {onEdit && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="rounded-xl font-semibold"><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                        {confirmDelete && (
                            <>
                                <DropdownMenuSeparator className="bg-primary/5"/>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); confirmDelete(product.id); }} className="text-destructive focus:text-destructive rounded-xl font-semibold"><Trash2 className="mr-2 h-4 w-4"/>Excluir</DropdownMenuItem>
                            </>
                        )}
                    </>
                )}
                </DropdownMenuContent>
            </DropdownMenu>
        </TableCell>
    </TableRow>
    );
});

export default function ProductList({ products, onRowClick, onAddProduct, onEdit, onDelete, isReadOnly, distributorName, sortConfig, requestSort, suppliers }: ProductListProps) {
  const [isAlertOpen, setAlertOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isImageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const suppliersMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);

  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageModalOpen(true);
  };
  
  };

  const confirmDelete = (productId: string) => {
    setProductToDelete(productId);
    setAlertOpen(true);
  }

  const handleDelete = () => {
    if (productToDelete) {
      onDelete?.(productToDelete);
    }
    setAlertOpen(false);
    setProductToDelete(null);
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden h-full">
        <ScrollArea className="h-full">
            <div className="grid gap-4 p-4 pb-20">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-semibold">Distribuidor:</span>
                                <span className="font-medium text-right truncate max-w-[150px] uppercase">{displayDistributor}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-semibold">Segmento:</span>
                                <Badge variant="secondary" className="text-[10px] bg-primary/5 text-primary border-none font-semibold uppercase">{product.segment || itemData['CATEGORIA'] || 'OUTROS'}</Badge>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground font-semibold">Status:</span>
                                <Badge variant={(product.status === 'Ativo' || itemData['STATUS'] === 'Ativo') ? 'success' : 'destructive'} className="text-[10px] font-semibold uppercase">{product.status || itemData['STATUS'] || 'Ativo'}</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
              )
            }) : (
            <div className="h-40 flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/20 bg-background/50 backdrop-blur-sm text-muted-foreground gap-2">
                <Package className="h-8 w-8 opacity-20" />
                <span className="font-semibold text-sm">Nenhum item encontrado.</span>
            </div>
            )}
            </div>
        </ScrollArea>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block h-full overflow-hidden rounded-xl border border-border/40 bg-background/20 backdrop-blur-md shadow-xl">
        <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-primary/10">
            <Table>
                <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/40 h-[34px]">
                    <TableRow className="hover:bg-transparent border-none h-[34px]">
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'item' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('item')}
                            className="w-[10%] text-[10px] font-semibold uppercase tracking-widest pl-6"
                        >
                            Código
                        </TableHead>
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'description' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('description')}
                            className="text-[10px] font-semibold uppercase tracking-widest"
                        >
                            Descrição
                        </TableHead>
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'manufacturer' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('manufacturer')}
                            className="hidden lg:table-cell w-[15%] text-[10px] font-semibold uppercase tracking-widest"
                        >
                            Fabricante
                        </TableHead>
                        <TableHead className="w-[15%] text-[10px] font-semibold uppercase tracking-widest h-[34px]">Distribuidor</TableHead>
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'segment' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('segment')}
                            className="hidden xl:table-cell w-[10%] text-[10px] font-semibold uppercase tracking-widest"
                        >
                            Segmento
                        </TableHead>
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('status')}
                            className="hidden xl:table-cell w-[10%] text-[10px] font-semibold uppercase tracking-widest"
                        >
                            Status
                        </TableHead>
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'stockQuantity' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('stockQuantity')}
                            className="text-center hidden sm:table-cell w-[10%] text-[10px] font-semibold uppercase tracking-widest"
                        >
                            Estoque
                        </TableHead>
                        <TableHead 
                            isSortable 
                            sortDirection={sortConfig?.key === 'sellingPrice' ? sortConfig.direction : null}
                            onClick={() => requestSort?.('sellingPrice')}
                            className="text-right hidden sm:table-cell w-[10%] text-[10px] font-semibold uppercase tracking-widest pr-6"
                        >
                            P. Venda
                        </TableHead>
                        <TableHead className="w-[64px] text-right pr-6 h-[34px] text-[10px] font-semibold uppercase tracking-widest">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.length > 0 ? products.map((product) => (
                        <ProductTableRow 
                            key={product.id}
                            product={product}
                            onRowClick={onRowClick}
                            suppliersMap={suppliersMap}
                            distributorName={distributorName}
                            isReadOnly={isReadOnly}
                            onAddProduct={onAddProduct}
                            onEdit={onEdit}
                            confirmDelete={confirmDelete}
                            handleImageClick={handleImageClick}
                        />
                    )) : (
                    <TableRow>
                        <TableCell colSpan={isReadOnly ? 8 : 9} className="py-0 h-40 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Package className="h-8 w-8 opacity-20" />
                                <span className="font-semibold text-sm">Nenhum item encontrado.</span>
                            </div>
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </div>

       <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent className="rounded-xl border-border/40 shadow-premium">
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o item do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90">Confirmar Exclusão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl h-auto flex flex-col p-2 border-none bg-black/10 backdrop-blur-xl shadow-none rounded-xl">
            <DialogTitle className="sr-only">Visualização de Imagem</DialogTitle>
            {selectedImageUrl && (
                <div className="relative w-full h-full min-h-[70vh] flex items-center justify-center p-4">
                    <Image 
                        src={selectedImageUrl} 
                        alt="Visualização do Produto" 
                        fill 
                        className="object-contain drop-shadow-premium"
                        sizes="(max-width: 768px) 100vw, 1200px"
                        quality={95}
                        priority
                    />
                </div>
            )}
            <DialogFooter className="sm:justify-center pb-4">
                 <Button onClick={() => setImageModalOpen(false)} variant="secondary" className="rounded-full px-8 bg-white/20 hover:bg-white/30 border-none text-white font-semibold backdrop-blur-md">
                    Fechar
                 </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
