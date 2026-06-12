
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getStockLocations, addStockLocation, updateStockLocation, deleteStockLocation, getVehicles, getProductsOnce, updateProductStockLevels, getTeamMembers } from '@/lib/firebase/firestore';
import type { StockLocation, Vehicle, Product, UserProfile } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Warehouse } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StockLocationList from '@/components/estoque/StockLocationList';
import AddEditStockLocationDialog from '@/components/estoque/AddEditStockLocationDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ProductStockLevels from '@/components/estoque/ProductStockLevels';
import StockMovementForm from '@/components/estoque/StockMovementForm';

export default function EstoquePage() {
    const { userProfile, company, firebase } = useAuth();
    const { toast } = useToast();
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isLocationDialogOpen, setLocationDialogOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<StockLocation | undefined>(undefined);
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [locationToDelete, setLocationToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        const unsubLocations = getStockLocations(firebase.db, userProfile.companyId, setLocations, console.error);
        const unsubVehicles = getVehicles(firebase.db, userProfile.companyId, setVehicles, console.error);
        
        getProductsOnce(firebase.db, userProfile.companyId, 'Todos').then(setProducts);

        const unsubTeam = getTeamMembers(firebase.db, userProfile.companyId, setTeamMembers, console.error);

        setIsLoading(false);

        return () => {
            unsubLocations();
            unsubVehicles();
            unsubTeam();
        };
    }, [userProfile?.companyId, firebase.db]);

    const handleEditLocation = (location: StockLocation) => {
        setEditingLocation(location);
        setLocationDialogOpen(true);
    };

    const handleAddNewLocation = () => {
        setEditingLocation(undefined);
        setLocationDialogOpen(true);
    };

    const confirmDeleteLocation = (locationId: string) => {
        setLocationToDelete(locationId);
        setAlertOpen(true);
    };

    const handleDeleteLocation = async () => {
        if (!locationToDelete || !firebase.db) return;
        try {
            await deleteStockLocation(firebase.db, locationToDelete);
            toast({ title: "Sucesso!", description: "Local de estoque excluído." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
        } finally {
            setAlertOpen(false);
            setLocationToDelete(null);
        }
    };
    
     const onLocationSaved = async (data: Omit<StockLocation, 'id' | 'companyId'>) => {
        if (!userProfile?.companyId || !firebase.db) return;
        const dataToSave = { ...data, companyId: userProfile.companyId };
        try {
            if (editingLocation) {
                await updateStockLocation(firebase.db, editingLocation.id, dataToSave);
                toast({ title: "Sucesso!", description: "Local atualizado." });
            } else {
                await addStockLocation(firebase.db, dataToSave);
                toast({ title: "Sucesso!", description: "Local de estoque criado." });
            }
            setLocationDialogOpen(false);
        } catch (error: any) {
             toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
        }
    };
    
    const handleStockMovement = async (type: 'transfer' | 'entry' | 'exit', productId: string, quantity: number, fromLocationId?: string, toLocationId?: string, purchaseOrderNumber?: string) => {
        if (!firebase.db) return;
        try {
            await updateProductStockLevels(firebase.db, type, productId, quantity, fromLocationId, toLocationId, purchaseOrderNumber);
            toast({ title: "Sucesso!", description: `Movimentação de estoque realizada com sucesso.` });
            // Re-fetch products to update UI
            if (userProfile?.companyId) {
                getProductsOnce(firebase.db, userProfile.companyId, 'Todos').then(setProducts);
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro na Movimentação", description: error.message });
        }
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8"/></div>;
    }

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
            <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
                    <div className="space-y-1">
                        <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                            <Warehouse className="text-primary h-8 w-8" />
                            Gestão de Estoque
                        </h1>

                    </div>
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <Button 
                            onClick={handleAddNewLocation} 
                            className="h-12 w-full lg:w-auto px-8 shadow-premium rounded-2xl font-semibold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all text-white"
                        >
                            <PlusCircle className="mr-2 h-5 w-5" /> Novo Local
                        </Button>
                    </div>
                </div>
            </header>

            <Tabs defaultValue="overview" className="flex-1 flex flex-col px-4 md:px-8 pt-6 min-h-0 w-full max-w-full overflow-hidden">
                <TabsList className="h-14 p-1.5 bg-background/40 backdrop-blur-3xl rounded-[1.5rem] border border-border/40 shadow-premium self-start mb-8 gap-1">
                    <TabsTrigger value="overview" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Visão Geral</TabsTrigger>
                    <TabsTrigger value="movement" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Movimentação</TabsTrigger>
                    <TabsTrigger value="locations" className="h-full px-6 rounded-xl font-semibold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Locais de Estoque</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="flex-1 min-h-0 outline-none w-full">
                    <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <ProductStockLevels products={products} locations={locations} />
                    </div>
                </TabsContent>

                <TabsContent value="movement" className="outline-none">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
                        <StockMovementForm 
                            locations={locations} 
                            products={products} 
                            vehicles={vehicles}
                            teamMembers={teamMembers}
                            onStockMovement={handleStockMovement}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="locations" className="outline-none">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium border border-border/40 overflow-hidden">
                            <StockLocationList locations={locations} onEdit={handleEditLocation} onDelete={confirmDeleteLocation} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
             <AddEditStockLocationDialog 
                isOpen={isLocationDialogOpen}
                setOpen={setLocationDialogOpen}
                location={editingLocation}
                onLocationSaved={onLocationSaved}
                vehicles={vehicles}
                allLocations={locations}
            />
            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-lg border border-border/40 bg-background rounded-[2rem] shadow-2xl">
                    <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80">Excluir Local de Estoque?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">Esta ação é irreversível. Apenas locais sem itens vinculados podem ser excluídos para garantir a integridade dos dados.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                        <AlertDialogCancel className="w-full sm:w-auto h-12 rounded-xl font-semibold border-border/40">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteLocation} className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto h-12 rounded-xl font-semibold text-white shadow-lg shadow-destructive/20 transition-all active:scale-95">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
