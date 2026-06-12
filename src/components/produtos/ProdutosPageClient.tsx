
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getProducts, addProduct, updateProduct, deleteProduct, getSuppliers, getStockLocations, bulkAddProducts, updatePromotion, addPromotion, deletePromotion, getDistributorsOnce, getProductsOnce, bulkAddProductsFromDistributor } from '@/lib/firebase/firestore';
import type { Product, Supplier, StockLocation, Promotion } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Search, Package, Upload, Download, Settings2, Percent, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { read, utils, writeFile } from 'xlsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '../ui/label';
import dynamic from 'next/dynamic';

const AddEditProductDialog = dynamic(() => import('@/components/produtos/add-edit-product-dialog'), { ssr: false });
const AddEditPromotionDialog = dynamic(() => import('@/components/promotions/AddEditPromotionDialog'), { ssr: false });
const BulkPriceUpdateDialog = dynamic(() => import('@/components/produtos/bulk-price-update-dialog'), { ssr: false });
import { Card, CardContent, CardHeader } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { isFuture, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';


export default function ProdutosPageClient({ showOnlyPromotions = false, companyId: companyIdProp, distributorName }: { showOnlyPromotions?: boolean, companyId?: string, distributorName?: string }) {
    const { userProfile, firebase, company } = useAuth();
    const { toast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [userProducts, setUserProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('Ativo');

    // For standard users
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | undefined>(undefined);

    // For distributors
    const [isPromoDialogOpen, setPromoDialogOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promotion | undefined>(undefined);

    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isPriceUpdateOpen, setPriceUpdateOpen] = useState(false);
    const [fileToImport, setFileToImport] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const [productToAdd, setProductToAdd] = useState<Product | null>(null);
    const [isAddConfirmOpen, setAddConfirmOpen] = useState(false);
    const [isAddAllConfirmOpen, setAddAllConfirmOpen] = useState(false);

    const isDistributor = userProfile?.role === 'distribuidor';
    const isSalesperson = userProfile?.role === 'vendedor';

    const companyId = companyIdProp || userProfile?.companyId;
    const isReadOnly = !!companyIdProp && companyIdProp !== userProfile?.companyId;

    // Use the name passed as prop, or the current user's company name if they are a distributor
    const distributorNameForList = distributorName || (isDistributor || isSalesperson ? (userProfile?.displayName || company?.name) : undefined);

    useEffect(() => {
        if (isReadOnly && userProfile?.companyId && firebase.db) {
            getProductsOnce(firebase.db, userProfile.companyId, 'Todos').then(setUserProducts);
        }
    }, [isReadOnly, userProfile?.companyId, firebase.db]);

    useEffect(() => {
        const newProductData = localStorage.getItem('newProductFromPromotion');
        if (newProductData && !isReadOnly) {
            try {
                const promoData = JSON.parse(newProductData);
                const productForDialog: Partial<Product> = {
                    description: promoData.description || '',
                    detailedDescription: promoData.detailedDescription || '',
                    sellingPrice: promoData.sellingPrice || 0,
                    materialPrice: promoData.materialPrice || 0,
                    imageUrl: promoData.imageUrl || '',
                    segment: promoData.segment || 'OUTROS',
                    status: 'Ativo',
                    manufacturer: promoData.manufacturer || '',
                };
                setEditingProduct(productForDialog);
                setDialogOpen(true);
                localStorage.removeItem('newProductFromPromotion');
            } catch (error) {
                console.error("Failed to parse promotion data from localStorage", error);
                localStorage.removeItem('newProductFromPromotion');
            }
        }

        if (companyId && firebase.db) {
            const unsubProducts = getProducts(
                firebase.db,
                companyId,
                (data) => {
                    setProducts(data);
                    setIsLoading(false);
                },
                (error) => {
                    toast({
                        variant: 'destructive',
                        title: 'Erro ao buscar produtos',
                        description: error.message,
                    });
                },
                filterStatus as 'Ativo' | 'Inativo' | 'Todos'
            );

            const unsubSuppliers = getSuppliers(firebase.db, companyId, setSuppliers, console.error);

            let unsubLocations = () => { };
            if (!isReadOnly) {
                unsubLocations = getStockLocations(firebase.db, companyId, setLocations, console.error);
            }

            setIsLoading(false);

            return () => {
                unsubProducts();
                unsubSuppliers();
                unsubLocations();
            };
        } else if (!userProfile) {
            setIsLoading(false);
        }
    }, [companyId, userProfile?.role, firebase.db, filterStatus, toast, isReadOnly]);

    const onProductSaved = async (productData: Omit<Product, 'id' | 'companyId'>, productId?: string) => {
        if (!companyId || !firebase.db) return;

        try {
            if (productId) { // Editing
                await updateProduct(firebase.db, productId, { ...productData, companyId: companyId });
            } else { // Adding
                await addProduct(firebase.db, { ...productData, companyId: companyId });
            }
            setDialogOpen(false);
            toast({ title: "Sucesso!", description: `Produto ${productId ? 'atualizado' : 'adicionado'}.` });

        } catch (err: any) {
            toast({
                variant: "destructive",
                title: `Erro ao ${editingProduct ? 'atualizar' : 'adicionar'} produto`,
                description: err.message,
            });
            throw err;
        }
    };

    const onPromoSaved = async (productData: Omit<Product, 'id' | 'companyId'>, productId?: string) => {
        if (!userProfile?.companyId || !userProfile.uid || !userProfile.displayName || !firebase.db) return;

        const dataToSave: Omit<Product, 'id'> = {
            ...productData,
            isPromotion: true,
            segment: 'PROMOÇÃO',
            companyId: userProfile.companyId,
        };

        let finalProductId = productId;

        try {
            if (finalProductId) { // Editing
                await updateProduct(firebase.db, finalProductId, dataToSave);
            } else { // Adding
                finalProductId = await addProduct(firebase.db, dataToSave);
            }

            if (!finalProductId) throw new Error("ID do produto não disponível para salvar a promoção.");

            const promoCollection = collection(firebase.db, 'promotions');
            const q = query(promoCollection, where("productId", "==", finalProductId));
            const existingPromoSnap = await getDocs(q);

            const promoDataForDb: Omit<Promotion, 'id'> = {
                productId: finalProductId,
                productName: dataToSave.description,
                description: dataToSave.detailedDescription || '',
                manufacturer: dataToSave.manufacturer || '',
                specifications: dataToSave.notes,
                promoPrice: dataToSave.promoPrice || 0,
                originalPrice: dataToSave.sellingPrice,
                expiresAt: dataToSave.promoExpiresAt,
                imageUrl: dataToSave.imageUrl,
                distributorId: userProfile.uid,
                distributorName: userProfile.displayName,
                createdAt: dataToSave.creationDate || new Date().toISOString(),
                status: dataToSave.status === 'Ativo' ? 'active' : 'inactive',
            };

            if (!existingPromoSnap.empty) {
                const promoDoc = existingPromoSnap.docs[0];
                await updatePromotion(firebase.db, promoDoc.id, promoDataForDb);
            } else {
                await addPromotion(firebase.db, promoDataForDb);
            }

            toast({ title: 'Sucesso!', description: `Promoção ${productId ? 'atualizada' : 'adicionada'}.` });
            setPromoDialogOpen(false);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao salvar promoção', description: error.message });
        }
    };


    const handleProductSelectForAdding = (product: Product) => {
        const existingProduct = userProducts.find(p => p.originProductId === product.id);
        if (existingProduct) {
            toast({ title: "Produto já existe", description: "Este produto já está no seu catálogo." });
            return;
        }
        setProductToAdd(product);
        setAddConfirmOpen(true);
    };

    const handleConfirmAddProduct = async () => {
        if (!productToAdd || !userProfile?.companyId || !firebase.db) return;

        const isPromoActive = productToAdd.isPromotion && (!productToAdd.promoExpiresAt || isFuture(parseISO(productToAdd.promoExpiresAt)));
        const distributorPrice = isPromoActive && productToAdd.promoPrice ? productToAdd.promoPrice : productToAdd.sellingPrice;

        const {
            id,
            companyId: originCompanyId,
            stockQuantity,
            stockLevels,
            ...restOfProduct
        } = productToAdd;

        const newProductData: Omit<Product, 'id'> = {
            ...restOfProduct,
            companyId: userProfile.companyId,
            materialPrice: distributorPrice,
            sellingPrice: parseFloat((distributorPrice * 1.4).toFixed(2)),
            stockQuantity: 0,
            stockLevels: {},
            originProductId: productToAdd.id,
            originDistributorCompanyId: productToAdd.companyId,
        };

        try {
            await addProduct(firebase.db, newProductData);
            toast({ title: "Produto Adicionado!", description: `${productToAdd.description} foi adicionado ao seu catálogo.` });
            const updatedUserProducts = await getProductsOnce(firebase.db, userProfile.companyId, 'Todos');
            setUserProducts(updatedUserProducts);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao adicionar', description: error.message });
        } finally {
            setAddConfirmOpen(false);
            setProductToAdd(null);
        }
    };

    const handleEdit = async (product: Product) => {
        if (isReadOnly) return;
        if (isDistributor) {
            if (!firebase.db) return;
            setEditingProduct(product);
            setPromoDialogOpen(true);
        } else {
            setEditingProduct(product);
            setDialogOpen(true);
        }
    };

    const handleAddNew = () => {
        if (isReadOnly) return;
        if (isDistributor) {
            setEditingPromo(undefined);
            setEditingProduct({ isPromotion: true, segment: 'PROMOÇÃO', status: 'Ativo' });
            setPromoDialogOpen(true);
        } else {
            const defaultProduct: Partial<Product> = showOnlyPromotions ? { isPromotion: true, promoPrice: 0, status: 'Ativo' } : { status: 'Ativo' };
            setEditingProduct(defaultProduct);
            setDialogOpen(true);
        }
    };

    const handleDelete = async (productId: string) => {
        if (isReadOnly || !firebase.db) return;
        try {
            await deleteProduct(firebase.db, productId);
            toast({ title: 'Item excluído com sucesso!' });
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao excluir item',
                description: err.message,
            });
        }
    };

    const filteredProducts = products.filter((product) => {
        if (showOnlyPromotions && !product.isPromotion) {
            return false;
        }
        const search = searchTerm.toLowerCase();
        const itemData = product as any;

        const desc = product.description || itemData['DESCRIÇÃO'] || itemData['DESCRICAO'] || '';
        const cod = product.item || itemData['CÓDIGO'] || itemData['CODIGO'] || '';
        const man = product.manufacturer || itemData['FABRICANTE'] || '';
        const seg = product.segment || itemData['CATEGORIA'] || '';

        return (
            String(desc).toLowerCase().includes(search) ||
            String(cod).toLowerCase().includes(search) ||
            String(man).toLowerCase().includes(search) ||
            String(seg).toLowerCase().includes(search)
        );
    }).sort((a, b) => {
        const searchStr = searchTerm.trim().toLowerCase();
        
        const descA = String(a.description || (a as any)['DESCRIÇÃO'] || (a as any)['DESCRICAO'] || '');
        const descB = String(b.description || (b as any)['DESCRIÇÃO'] || (b as any)['DESCRICAO'] || '');

        if (searchStr) {
            const codA = String(a.item || (a as any)['CÓDIGO'] || (a as any)['CODIGO'] || '').toLowerCase();
            const codB = String(b.item || (b as any)['CÓDIGO'] || (b as any)['CODIGO'] || '').toLowerCase();
            
            // Prioridade 1: Código exato
            const aExactCod = codA === searchStr;
            const bExactCod = codB === searchStr;
            if (aExactCod && !bExactCod) return -1;
            if (!aExactCod && bExactCod) return 1;

            // Prioridade 2: Código começando com a busca
            const aStartsCod = codA.startsWith(searchStr);
            const bStartsCod = codB.startsWith(searchStr);
            if (aStartsCod && !bStartsCod) return -1;
            if (!aStartsCod && bStartsCod) return 1;

            // Prioridade 3: Descrição exata
            const descALower = descA.toLowerCase();
            const descBLower = descB.toLowerCase();
            const aExactDesc = descALower === searchStr;
            const bExactDesc = descBLower === searchStr;
            if (aExactDesc && !bExactDesc) return -1;
            if (!aExactDesc && bExactDesc) return 1;

            // Prioridade 4: Descrição começando com a busca
            const aStartsDesc = descALower.startsWith(searchStr);
            const bStartsDesc = descBLower.startsWith(searchStr);
            if (aStartsDesc && !bStartsDesc) return -1;
            if (!aStartsDesc && bStartsDesc) return 1;
        }

        return descA.localeCompare(descB);
    });

    const handleExportToExcel = () => {
        const suppliersMap = new Map(suppliers.map(s => [s.id, s.name]));

        const dataToExport = products.map(p => {
            const stockLevelData = locations.reduce((acc, loc) => {
                acc[`ESTOQUE ${loc.name.toUpperCase()}`] = p.stockLevels?.[loc.id] || 0;
                return acc;
            }, {} as Record<string, number>);

            return {
                'CÓDIGO': p.item,
                'DESCRIÇÃO': p.description,
                'DESCRIÇÃO DETALHADA': p.detailedDescription,
                'MODELO': p.model,
                'FABRICANTE': p.manufacturer,
                'DISTRIBUIDOR': suppliersMap.get(p.mainSupplierId || '') || p.distributor || (p as any).DISTRIBUIDOR || '',
                'UNIDADE': p.unit,
                'PREÇO DE CUSTO': p.materialPrice,
                'PREÇO DE VENDA': p.sellingPrice,
                'PREÇO DE SERVIÇO': p.servicePrice,
                'CATEGORIA': p.segment,
                'STATUS': p.status,
                'URL IMAGEM': p.imageUrl,
                'NOTAS': p.notes,
                'ESTOQUE TOTAL': p.stockQuantity,
                'ESTOQUE MÍNIMO': p.minStockQuantity,
                'ESTOQUE MÁXIMO': p.maxStockQuantity,
                'ALERTA DE ESTOQUE': p.stockAlert,
                'LOCALIZAÇÃO': p.locationDetail,
                ...stockLevelData,
                'PESO LÍQUIDO (KG)': p.weight,
                'PESO BRUTO (KG)': p.grossWeight,
                'ALTURA (CM)': p.height,
                'LARGURA (CM)': p.width,
                'COMPRIMENTO (CM)': p.length,
                'NCM': p.ncm,
                'CEST': p.cest,
                'EAN': p.ean,
                'ORIGEM': p.origin,
                'CFOP VENDA': p.cfop_venda,
                'CFOP COMPRA': p.cfop_compra,
                'CST ICMS': p.cst_icms,
                'ALÍQUOTA ICMS (%)': p.aliq_icms,
                'CST PIS': p.cst_pis,
                'ALÍQUOTA PIS (%)': p.aliq_pis,
                'CST COFINS': p.cst_cofins,
                'ALÍQUOTA COFINS (%)': p.aliq_cofins,
                'CST IPI': p.cst_ipi,
                'ALÍQUOTA IPI (%)': p.aliq_ipi,
                'SITUAÇÃO TRIBUTÁRIA': p.situacao_tributaria,
                'CÓDIGO ANP': p.codigo_anp,
                'GTIN TRIBUTÁVEL': p.gtin_tributavel,
            };
        });

        const worksheet = utils.json_to_sheet(dataToExport);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Produtos');
        writeFile(workbook, 'catalogo_produtos_completo.xlsx');
    };

    const handleImportFile = async () => {
        if (!fileToImport || !companyId || !firebase.db) return;

        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = utils.sheet_to_json(worksheet);

                if (json.length > 0) {
                    const { added, updated, skipped } = await bulkAddProducts(firebase.db, companyId, json as any[], suppliers, locations);
                    toast({
                        title: "Importação Concluída!",
                        description: `${added} produtos adicionados, ${updated} atualizados, ${skipped} ignorados.`,
                    });
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

    const handleAddAllFilteredProducts = async () => {
        if (!isReadOnly || filteredProducts.length === 0 || !userProfile?.companyId || !firebase.db) return;

        const productsToAdd = filteredProducts.filter(distributorProduct =>
            !userProducts.some(userProduct => userProduct.originProductId === distributorProduct.id)
        );

        if (productsToAdd.length === 0) {
            toast({ title: "Tudo em dia!", description: "Todos os produtos filtrados já estão no seu catálogo." });
            setAddAllConfirmOpen(false);
            return;
        }

        setIsImporting(true);
        try {
            const addedCount = await bulkAddProductsFromDistributor(firebase.db, userProfile.companyId, productsToAdd);
            toast({ title: "Sucesso!", description: `${addedCount} novo(s) produto(s) foram adicionados ao seu catálogo.` });

            const updatedUserProducts = await getProductsOnce(firebase.db, userProfile.companyId, 'Todos');
            setUserProducts(updatedUserProducts);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao adicionar produtos', description: error.message });
        } finally {
            setIsImporting(false);
            setAddAllConfirmOpen(false);
        }
    };

    const productsToAddCount = useMemo(() => {
        return filteredProducts.filter(p => !userProducts.some(up => up.originProductId === p.id)).length;
    }, [filteredProducts, userProducts]);

    return (
        <div className="flex flex-col w-full max-w-[1750px] mx-auto p-4 md:p-8 animate-in fade-in duration-500 overflow-x-hidden">
            <header className="flex flex-col gap-6 pt-4 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-background/60 backdrop-blur-md p-4 rounded-xl border border-border/40 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Package className="text-primary h-5 w-5" />
                        </div>
                        <h1 className="text-xl font-semibold tracking-tighter shrink-0">
                            {showOnlyPromotions ? 'Promoções' : 'Catálogo de Itens'}
                            <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-none font-semibold">
                                {products.length}
                            </Badge>
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        {!isReadOnly && (
                            <>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="rounded-2xl h-11 border-border/40 shadow-sm font-semibold">
                                            <Settings2 className="mr-2 h-4 w-4" />
                                            Ações
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="rounded-2xl shadow-2xl border-border/40">
                                        <DropdownMenuItem onClick={() => setImportModalOpen(true)}>
                                            <Upload className="mr-2 h-4 w-4" /> Importar Planilha
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleExportToExcel}>
                                            <Download className="mr-2 h-4 w-4" /> Exportar para Excel
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setPriceUpdateOpen(true)}>
                                            <Percent className="mr-2 h-4 w-4" /> Atualizar Preços
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button onClick={handleAddNew} className="rounded-2xl h-11 px-6 shadow-lg shadow-primary/10 font-semibold">
                                    <PlusCircle className="mr-2 h-4 w-4" /> {showOnlyPromotions ? 'Adicionar Promoção' : 'Adicionar Item'}
                                </Button>
                            </>
                        )}
                        {isReadOnly && (
                            <Button onClick={() => setAddAllConfirmOpen(true)} className="rounded-2xl h-11 px-6 shadow-lg shadow-primary/10 font-semibold" disabled={isImporting || filteredProducts.length === 0}>
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Adicionar {filteredProducts.length === products.length ? 'Todos' : `${filteredProducts.length} Filtrados`} ao Catálogo
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome, código, fabricante ou segmento..."
                            className="w-full rounded-2xl bg-background/50 border-border/40 pl-10 h-11 shadow-sm focus:ring-primary/20 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {!isReadOnly && (
                        <div className="flex items-center gap-3">
                            <Label htmlFor="status-filter" className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger id="status-filter" className="w-[180px] rounded-2xl h-11 bg-background/50 border-border/40 shadow-sm focus:ring-primary/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-2xl border-border/40">
                                    <SelectItem value="Ativo">Ativos</SelectItem>
                                    <SelectItem value="Inativo">Inativos</SelectItem>
                                    <SelectItem value="Todos">Todos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-border/40 bg-background/50 backdrop-blur-sm shadow-xl min-h-[400px]">
                        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                    </div>
                ) : (
                    <Card className="flex-1 flex flex-col min-h-0 border-border/40 bg-background/50 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden">
                        <CardContent className="flex-1 overflow-auto p-0">
                            <ProductList
                                products={filteredProducts}
                                onRowClick={isReadOnly ? undefined : handleEdit}
                                onAddProduct={handleProductSelectForAdding}
                                onDelete={!isReadOnly ? handleDelete : undefined}
                                onEdit={!isReadOnly ? handleEdit : undefined}
                                isReadOnly={isReadOnly}
                                suppliers={suppliers}
                                distributorName={distributorNameForList}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>

            {!isReadOnly ? (
                <>
                    {isDistributor ? (
                        <AddEditPromotionDialog
                            isOpen={isPromoDialogOpen}
                            setOpen={setPromoDialogOpen}
                            onSave={onPromoSaved}
                            product={editingProduct as any}
                        />
                    ) : (
                        <AddEditProductDialog
                            isOpen={isDialogOpen}
                            setOpen={setDialogOpen}
                            onProductSaved={onProductSaved}
                            product={editingProduct}
                            suppliers={suppliers}
                            locations={locations}
                        />
                    )}

                    <BulkPriceUpdateDialog
                        isOpen={isPriceUpdateOpen}
                        setOpen={setPriceUpdateOpen}
                        products={products}
                        suppliers={suppliers}
                    />
                    <AlertDialog open={isImportModalOpen} onOpenChange={setImportModalOpen}>
                        <AlertDialogContent className="rounded-xl border-border/40 shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Importar Produtos de Planilha</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Selecione um arquivo .xlsx or .csv. Certifique-se de que as colunas da sua planilha correspondem aos campos do sistema.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid w-full max-w-sm items-center gap-1.5 p-2">
                                <Label htmlFor="import-file" className="text-xs font-semibold uppercase text-muted-foreground">Arquivo da Planilha</Label>
                                <Input id="import-file" type="file" accept=".xlsx, .csv" className="rounded-xl border-border/40" onChange={(e) => setFileToImport(e.target.files?.[0] || null)} />
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleImportFile} disabled={!fileToImport || isImporting} className="rounded-xl bg-primary shadow-lg shadow-primary/20">
                                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Importar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            ) : (
                <>
                    <AlertDialog open={isAddConfirmOpen} onOpenChange={setAddConfirmOpen}>
                        <AlertDialogContent className="rounded-xl border-border/40 shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Adicionar ao seu Catálogo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Deseja adicionar o produto "{productToAdd?.description}" ao seu catálogo?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleConfirmAddProduct} className="rounded-xl bg-primary shadow-lg shadow-primary/20">Adicionar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog open={isAddAllConfirmOpen} onOpenChange={setAddAllConfirmOpen}>
                        <AlertDialogContent className="rounded-xl border-border/40 shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Adicionar Produtos ao Catálogo?</AlertDialogTitle>
                                <AlertDialogDescription className="text-base font-medium">
                                    Ao confirmar, <span className="font-semibold text-primary">{productsToAddCount} produtos</span> deste fornecedor serão adicionados à sua lista. Deseja continuar?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleAddAllFilteredProducts} disabled={isImporting} className="rounded-xl bg-primary shadow-lg shadow-primary/20">
                                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirmar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
}
