"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import type { Vehicle, UserProfile } from '@/lib/data';
import { getVehiclesOnce, addVehicle, updateVehicle, deleteVehicle, getTeamMembersOnce } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Car, Search, MoreHorizontal, Edit, Trash2, Smartphone, ShieldCheck, User, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSortableData } from '@/hooks/use-sortable-data';
import AddEditVehicleDialog from '@/components/veiculos/add-edit-vehicle-dialog';
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
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const normalizeString = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export default function VeiculosPage() {
    const { userProfile, firebase } = useAuth();
    const { toast } = useToast();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | undefined>(undefined);
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
    
    const { items: sortedVehicles, requestSort, sortConfig } = useSortableData(vehicles, { key: 'brand', direction: 'asc' });

    const fetchVehicles = async () => {
        if (!userProfile?.companyId || !firebase.db) return;
        setIsLoading(true);
        try {
            const data = await getVehiclesOnce(firebase.db, userProfile.companyId);
            setVehicles(data);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Erro ao carregar veículos' });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            fetchVehicles();
            getTeamMembersOnce(firebase.db, userProfile.companyId).then(setTeamMembers);
        } else if (!userProfile) {
            setIsLoading(false);
        }
    }, [userProfile?.companyId, firebase.db]);

    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setDialogOpen(true);
    };

    const handleAddNew = () => {
        setEditingVehicle(undefined);
        setDialogOpen(true);
    };

    const confirmDelete = (vehicleId: string) => {
        setVehicleToDelete(vehicleId);
        setAlertOpen(true);
    };

    const handleDelete = async () => {
        if (!vehicleToDelete || !firebase.db) return;
        try {
            await deleteVehicle(firebase.db, vehicleToDelete);
            toast({ title: 'Sucesso!', description: 'Veículo excluído.' });
            fetchVehicles();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
        } finally {
            setAlertOpen(false);
            setVehicleToDelete(null);
        }
    };
    
    const filteredVehicles = useMemo(() => {
        let filtered = [...sortedVehicles];
        if (searchTerm) {
            const lowerCaseSearch = normalizeString(searchTerm);
            filtered = filtered.filter(vehicle => 
                normalizeString(vehicle.brand).includes(lowerCaseSearch) ||
                normalizeString(vehicle.model).includes(lowerCaseSearch) ||
                normalizeString(vehicle.plate).includes(lowerCaseSearch) ||
                (vehicle.technicianNames && normalizeString(vehicle.technicianNames.join(' ')).includes(lowerCaseSearch))
            );
        }
        return filtered;
    }, [sortedVehicles, searchTerm]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
            <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1 min-w-0">
                        <div className="space-y-1 shrink-0">
                            <h1 className="font-semibold tracking-tighter flex items-center gap-3 truncate opacity-80 text-xl">
                                <Car className="text-primary h-8 w-8" /> 
                                Veículos
                            </h1>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.3em] opacity-40 ml-1">Gerenciamento de Frota</p>
                        </div>
                        <div className="relative w-full lg:max-w-md min-w-0 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                            <Input 
                                placeholder="Buscar por marca, modelo, placa ou técnico..." 
                                className="h-9 w-full rounded-lg bg-background/50 border-border/40 pl-11 font-semibold focus:bg-background transition-all text-xs" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>
                    </div>
                    <Button onClick={handleAddNew} className="h-9 w-full sm:w-auto shrink-0 shadow-premium rounded-lg font-semibold uppercase tracking-widest bg-primary hover:scale-[1.02] active:scale-95 transition-all text-xs">
                        <PlusCircle className="mr-2 h-5 w-5" /> Novo Veículo
                    </Button>
                </div>
            </header>

            <div className="flex-1 mt-6 px-4 md:px-8 pb-24 overflow-hidden w-full max-w-full">
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden w-full min-w-0 pb-10">
                    {filteredVehicles.length > 0 ? filteredVehicles.map(vehicle => (
                        <Card key={vehicle.id} className="w-full min-w-0 border-none bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden transition-all duration-300 active:scale-[0.98]">
                            <CardContent className="p-6 space-y-4 min-w-0">
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-xs text-primary/60 uppercase tracking-widest truncate">{vehicle.brand}</p>
                                            <div className="h-1 w-1 rounded-full bg-primary/20 shrink-0" />
                                            <p className="font-semibold text-xs text-primary/60 uppercase tracking-widest truncate">{vehicle.year}</p>
                                        </div>
                                        <h3 className="font-semibold text-xl tracking-tighter truncate break-words text-foreground/90 mt-1 uppercase">{vehicle.model}</h3>
                                    </div>
                                    <Badge variant="secondary" className="h-8 px-4 rounded-full font-mono font-semibold text-[12px] uppercase tracking-wider shrink-0 bg-primary/5 text-primary border-none">
                                        {vehicle.plate}
                                    </Badge>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-border/40">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-wrap gap-1 min-w-0">
                                            {vehicle.technicianNames && vehicle.technicianNames.length > 0 ? (
                                                vehicle.technicianNames.map((name, i) => (
                                                    <Badge key={i} variant="outline" className="h-6 px-3 rounded-full font-semibold text-[10px] uppercase tracking-wide border-border/40">
                                                        {name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest opacity-40">Sem técnico vinculado</span>
                                            )}
                                        </div>
                                    </div>

                                    {vehicle.maintenanceList && vehicle.maintenanceList.length > 0 && (
                                         <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                             {vehicle.maintenanceList.filter(m => m.status === 'Em Manutenção').length > 0 && (
                                                 <Badge className="h-5 px-2 text-[9px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800">
                                                     🟣 {vehicle.maintenanceList.filter(m => m.status === 'Em Manutenção').length} Em Manutenção
                                                     {vehicle.maintenanceList.find(m => m.status === 'Em Manutenção')?.expectedReturnDate && (
                                                         <span className="ml-1 opacity-80">(Prev: {vehicle.maintenanceList.find(m => m.status === 'Em Manutenção')?.expectedReturnDate?.split('-').reverse().join('/')})</span>
                                                     )}
                                                 </Badge>
                                             )}
                                             {vehicle.maintenanceList.filter(m => m.status === 'Agendado').length > 0 && (
                                                 <Badge className="h-5 px-2 text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200 border-none">
                                                     🔵 {vehicle.maintenanceList.filter(m => m.status === 'Agendado').length} Agendado(s)
                                                 </Badge>
                                             )}
                                             {vehicle.maintenanceList.filter(m => m.status === 'Pendente').length > 0 && (
                                                 <Badge className="h-5 px-2 text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-200 border-none">
                                                     🟠 {vehicle.maintenanceList.filter(m => m.status === 'Pendente').length} Pendente(s)
                                                 </Badge>
                                             )}
                                             {vehicle.maintenanceList.filter(m => m.status === 'Concluído').length > 0 && 
                                              vehicle.maintenanceList.filter(m => m.status === 'Agendado' || m.status === 'Pendente' || m.status === 'Em Manutenção').length === 0 && (
                                                 <Badge className="h-5 px-2 text-[9px] font-bold bg-green-500/10 text-green-600 border border-green-200 border-none">
                                                     🟢 {vehicle.maintenanceList.filter(m => m.status === 'Concluído').length} Concluído(s)
                                                 </Badge>
                                             )}
                                         </div>
                                     )}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button variant="ghost" className="flex-1 h-9 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all font-semibold uppercase text-[10px] tracking-widest text-xs" onClick={() => handleEdit(vehicle)}>
                                        <Edit className="mr-2 h-4 w-4" /> Editar
                                    </Button>
                                    <Button variant="ghost" className="h-9 w-12 rounded-xl bg-rose-500/5 text-rose-500 hover:bg-rose-500/10 transition-all font-semibold text-xs" onClick={() => confirmDelete(vehicle.id)}>
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="h-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/40 bg-background/20 backdrop-blur-3xl p-8 text-center">
                            <Car className="h-8 w-8 text-primary/20 mb-3" />
                            <p className="text-muted-foreground font-semibold uppercase tracking-widest text-[10px] opacity-60">Nenhum veículo encontrado na frota.</p>
                        </div>
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block border-none overflow-hidden w-full bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium">
                    <div className="overflow-x-auto w-full">
                        <Table>
                            <TableHeader className="bg-transparent border-none h-[34px]">
                                <TableRow className="hover:bg-transparent border-none h-[34px]">
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'brand' ? sortConfig.direction : null}
                                        onClick={() => requestSort('brand')}
                                        className="px-8 font-semibold text-[10px] opacity-40 h-[34px]"
                                    >
                                        Veículo
                                    </TableHead>
                                    <TableHead 
                                        isSortable 
                                        sortDirection={sortConfig?.key === 'plate' ? sortConfig.direction : null}
                                        onClick={() => requestSort('plate')}
                                        className="px-8 font-semibold text-[10px] opacity-40 h-[34px]"
                                    >
                                        Placa
                                    </TableHead>
                                    <TableHead 
                                        className="px-8 font-semibold text-[10px] opacity-40 h-[34px]"
                                    >
                                        Colaborador(es) Vinculado(s)
                                    </TableHead>
                                    <TableHead 
                                        className="px-8 font-semibold text-[10px] opacity-40 h-[34px]"
                                    >
                                        Manutenções
                                    </TableHead>
                                    <TableHead className="w-20 px-8 h-[34px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="border-none">
                                {filteredVehicles.map(vehicle => {
                                    const mList = vehicle.maintenanceList || [];
                                    const inMaintList = mList.filter(m => m.status === 'Em Manutenção');
                                    const inMaintCount = inMaintList.length;
                                    const activeInMaint = inMaintList[0];
                                    const scheduledCount = mList.filter(m => m.status === 'Agendado').length;
                                    const pendingCount = mList.filter(m => m.status === 'Pendente').length;
                                    const doneCount = mList.filter(m => m.status === 'Concluído').length;

                                    return (
                                    <TableRow key={vehicle.id} className="group transition-all duration-500 border-border/40 h-[42px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30 cursor-pointer" onClick={() => handleEdit(vehicle)}>
                                        <TableCell className="py-1 px-8">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-semibold text-xs uppercase tracking-widest text-primary/40 group-hover:text-primary/60 transition-colors">{vehicle.brand}</span>
                                                    <div className="h-1 w-1 rounded-full bg-primary/20 shrink-0" />
                                                    <span className="font-semibold text-xs uppercase tracking-widest text-primary/40 group-hover:text-primary/60 transition-colors">{vehicle.year}</span>
                                                </div>
                                                <span className="font-semibold text-xs tracking-tight text-foreground uppercase">{vehicle.model}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-1 px-8">
                                            <Badge variant="outline" className="h-6 px-4 rounded-full font-mono font-semibold text-xs uppercase tracking-widest border-border/40 group-hover:border-primary/25 transition-all">
                                                {vehicle.plate}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-1 px-8">
                                            <div className="flex flex-wrap gap-1.5">
                                                {vehicle.technicianNames && vehicle.technicianNames.length > 0 ? (
                                                    vehicle.technicianNames.map((name, i) => (
                                                        <Badge key={i} variant="secondary" className="h-5 px-2.5 rounded-full font-semibold text-[9px] uppercase tracking-widest bg-primary/5 text-primary/70 group-hover:text-primary transition-all border-none">
                                                            {name}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest opacity-20 group-hover:opacity-40 transition-all">Sem vínculo</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-1 px-8">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {inMaintCount > 0 && (
                                                    <Badge className="h-5 px-2 text-[9px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800">
                                                        🟣 {inMaintCount} Em Manutenção
                                                        {activeInMaint?.expectedReturnDate && (
                                                            <span className="ml-1 opacity-80">(Prev: {activeInMaint.expectedReturnDate.split('-').reverse().join('/')})</span>
                                                        )}
                                                    </Badge>
                                                )}
                                                {scheduledCount > 0 && (
                                                    <Badge className="h-5 px-2 text-[9px] font-bold bg-blue-500/10 text-blue-600 border border-blue-200 border-none">
                                                        🔵 {scheduledCount} Agendado{scheduledCount > 1 ? 's' : ''}
                                                    </Badge>
                                                )}
                                                {pendingCount > 0 && (
                                                    <Badge className="h-5 px-2 text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-200 border-none">
                                                        🟠 {pendingCount} Pendente{pendingCount > 1 ? 's' : ''}
                                                    </Badge>
                                                )}
                                                {doneCount > 0 && scheduledCount === 0 && pendingCount === 0 && inMaintCount === 0 && (
                                                    <Badge className="h-5 px-2 text-[9px] font-bold bg-green-500/10 text-green-600 border border-green-200 border-none">
                                                        🟢 {doneCount} Concluído{doneCount > 1 ? 's' : ''}
                                                    </Badge>
                                                )}
                                                {mList.length === 0 && (
                                                    <span className="text-[10px] font-semibold opacity-30">Em dia</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-1 px-8 text-right" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-6 w-6 p-0 rounded-md hover:bg-primary/10 transition-all" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="p-2 rounded-2xl bg-background/80 backdrop-blur-3xl border-border/40 shadow-premium">
                                                    <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-primary/10" onClick={() => handleEdit(vehicle)}>
                                                        <Edit className="mr-3 h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="h-11 rounded-xl font-semibold uppercase text-[10px] tracking-widest cursor-pointer focus:bg-rose-500/10 text-rose-500" onClick={() => confirmDelete(vehicle.id)}>
                                                        <Trash2 className="mr-3 h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                                {filteredVehicles.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-0 h-40 text-center">
                                            <div className="flex flex-col items-center justify-center py-10 opacity-20">
                                                <Car className="h-8 w-8 mb-3" />
                                                <p className="font-semibold uppercase tracking-[0.2em] text-[10px]">Nenhum veículo na listagem</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
            
            <AddEditVehicleDialog 
                isOpen={isDialogOpen}
                setOpen={setDialogOpen}
                vehicle={editingVehicle}
                teamMembers={teamMembers}
                onVehicleSaved={fetchVehicles}
            />

             <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent className="w-[95vw] max-w-lg border border-border/40 bg-background rounded-2xl shadow-2xl">
                    <AlertDialogHeader className="space-y-4">
                        <AlertDialogTitle className="text-2xl font-semibold tracking-tighter uppercase opacity-80 flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                                <Trash2 className="h-6 w-6" />
                            </div>
                            Excluir Veículo?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                            Esta ação removerá permanentemente o veículo da sua frota. Verifique se não há ordens de serviço ativas vinculadas a este veículo antes de proceder.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-8">
                        <AlertDialogCancel className="w-full sm:w-auto h-14 rounded-2xl font-semibold uppercase text-[10px] tracking-[0.2em] border-border/40">Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 w-full sm:w-auto h-14 rounded-2xl font-semibold uppercase text-[10px] tracking-[0.2em] text-white shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Confirmar Exclusão</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
