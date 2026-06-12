

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import type { Tool, UserProfile } from '@/lib/data';
import { getTools, addTool, updateTool, deleteTool, getTeamMembers } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Search, Wrench, AlertTriangle, CheckCircle, HelpCircle, ArrowRightLeft, Undo2, Hand, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AddEditToolDialog from '@/components/ferramentas/AddEditToolDialog';
import CheckoutToolDialog from '@/components/ferramentas/CheckoutToolDialog';
import ReasonDialog from '@/components/ferramentas/ReasonDialog'; 
import ToolHistoryDialog from '@/components/ferramentas/ToolHistoryDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { canPerformAction } from '@/lib/permissions';

const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const statusConfig: Record<Tool['status'], { label: string; variant: 'success' | 'warning' | 'default' | 'destructive' | 'info' }> = {
    'Disponível': { label: 'Disponível', variant: 'success' },
    'Em Uso': { label: 'Em Uso', variant: 'warning' },
    'Em Manutenção': { label: 'Em Manutenção', variant: 'default' },
    'Descartada': { label: 'Descartada', variant: 'destructive' },
    'Aguardando Aceite': { label: 'Aguardando Aceite', variant: 'info' },
};

const conditionConfig: Record<Tool['condition'], { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
    'OK': { label: 'OK', variant: 'success' },
    'Avariada': { label: 'Avariada', variant: 'warning' },
    'Extraviada': { label: 'Extraviada', variant: 'destructive' },
};

export default function FerramentasPageClient() {
    const { userProfile, company, firebase } = useAuth();
    const { toast } = useToast();
    const [tools, setTools] = useState<Tool[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isAddEditDialogOpen, setAddEditDialogOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<Tool | undefined>(undefined);
    const [isCheckoutDialogOpen, setCheckoutDialogOpen] = useState(false);
    const [toolToCheckout, setToolToCheckout] = useState<Tool | null>(null);
    const [isReasonDialogOpen, setReasonDialogOpen] = useState(false);
    const [actionWithReason, setActionWithReason] = useState<{ tool: Tool; action: 'maintenance' | 'dispose'; } | null>(null);
    const [isHistoryDialogOpen, setHistoryDialogOpen] = useState(false);
    const [toolForHistory, setToolForHistory] = useState<Tool | null>(null);

    const isTechnician = userProfile?.role === 'tecnico';
    const canEdit = canPerformAction(userProfile?.role!, 'ferramentas', 'edit', company?.permissions);
    const canDelete = canPerformAction(userProfile?.role!, 'ferramentas', 'delete', company?.permissions);

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        const unsubscribe = getTools(firebase.db, userProfile.companyId, (data) => {
            setTools(data);
            setIsLoading(false);
        }, (error) => {
            toast({ variant: 'destructive', title: 'Erro ao carregar ferramentas', description: error.message });
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [userProfile?.companyId, toast, firebase.db]);

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) return;
        const unsubTeam = getTeamMembers(firebase.db, userProfile.companyId, setTeamMembers, console.error);
        return () => unsubTeam();
    }, [userProfile?.companyId, firebase.db]);

    const createHistoryEntry = (action: string, details: string) => {
        if (!userProfile) return null;
        return {
            date: new Date().toISOString(),
            action,
            details,
            userId: userProfile.uid,
            userName: userProfile.displayName,
        };
    };

    const handleSaveTool = async (toolData: Partial<Omit<Tool, 'id' | 'companyId'>>) => {
        if (!userProfile?.companyId || !firebase.db) return;
        try {
            const historyEntry = createHistoryEntry(editingTool ? 'Edição' : 'Criação', editingTool ? 'Dados da ferramenta atualizados.' : 'Ferramenta adicionada ao inventário.');
            if (!historyEntry) return;

            if (editingTool) {
                await updateTool(firebase.db, editingTool.id, { ...toolData, history: [...(editingTool.history || []), historyEntry] });
                toast({ title: 'Sucesso', description: 'Ferramenta atualizada.' });
            } else {
                await addTool(firebase.db, { ...(toolData as Omit<Tool, 'id' | 'companyId'>), companyId: userProfile.companyId, history: [historyEntry], condition: 'OK', status: 'Disponível' });
                toast({ title: 'Sucesso', description: 'Ferramenta cadastrada.' });
            }
            setAddEditDialogOpen(false);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
        }
    };
    
    const handleCheckout = async (toolId: string, technicianId: string, technicianName: string) => {
        const tool = tools.find(t => t.id === toolId);
        if (!tool || !firebase.db) return;

        const historyEntry = createHistoryEntry('Entrega Solicitada', `Enviada para aceite de ${technicianName}.`);
        if (!historyEntry) return;

        try {
            await updateTool(firebase.db, toolId, {
                status: 'Aguardando Aceite',
                currentHolderId: technicianId,
                currentHolderName: technicianName,
                history: [...(tool.history || []), historyEntry],
            });
            toast({ title: 'Sucesso!', description: `Aguardando aceite de ${technicianName}.` });
            setCheckoutDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro na entrega', description: error.message });
        }
    };
    
    const handleAcceptTool = async (tool: Tool) => {
        if (!firebase.db || !userProfile) return;
        const historyEntry = createHistoryEntry('Aceite', `Ferramenta aceita e recebida por ${tool.currentHolderName}.`);
        if (!historyEntry) return;

        try {
            await updateTool(firebase.db, tool.id, {
                status: 'Em Uso',
                lastUsed: new Date().toISOString(),
                history: [...(tool.history || []), historyEntry],
            });
            toast({ title: 'Ferramenta Aceita!', description: `Você agora está com a posse da ferramenta ${tool.name}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro no aceite', description: error.message });
        }
    };
    
    const handleReturnTool = async (tool: Tool) => {
        if (!firebase.db || !userProfile) return;
        const historyEntry = createHistoryEntry('Devolvido', `Retornou ao estoque por ${userProfile.displayName}. Condição no retorno: ${tool.condition}`);
        if (!historyEntry) return;
        
        try {
            await updateTool(firebase.db, tool.id, {
                status: 'Disponível',
                currentHolderId: '',
                currentHolderName: '',
                history: [...(tool.history || []), historyEntry],
            });
            toast({ title: 'Devolvida!', description: `A ferramenta ${tool.name} voltou para o estoque.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro na devolução', description: error.message });
        }
    };
    
    const handleUpdateStatusOrCondition = async (tool: Tool, update: {status?: Tool['status'], condition?: Tool['condition']}, reason?: string) => {
        if (!firebase.db) return;

        let actionText = '';
        if (update.status) actionText = `Status logístico alterado para "${update.status}"`;
        if (update.condition) actionText = `Condição física alterada para "${update.condition}"`;

        const historyEntry = createHistoryEntry('Atualização', `${actionText}${reason ? `. Motivo: ${reason}` : ''}`);
        if (!historyEntry) return;

        try {
            await updateTool(firebase.db, tool.id, {...update, history: [...(tool.history || []), historyEntry]});
            toast({ title: 'Status Atualizado!', description: `A ferramenta ${tool.name} foi atualizada.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
        }
    };

    const handleActionWithReason = (tool: Tool, action: 'maintenance' | 'dispose') => {
        setActionWithReason({ tool, action });
        setReasonDialogOpen(true);
    };

    const executeActionWithReason = async (reason: string) => {
        if (!actionWithReason || !firebase.db) return;
        const { tool, action } = actionWithReason;

        const updateData: Partial<Tool> = {
            deletedAt: new Date().toISOString()
        };

        if (action === 'maintenance') {
            await handleUpdateStatusOrCondition(tool, { status: 'Em Manutenção' }, reason);
        } else if (action === 'dispose') {
            await handleUpdateStatusOrCondition(tool, { status: 'Descartada', ...updateData }, reason);
        }
        setReasonDialogOpen(false);
        setActionWithReason(null);
    };

    const handleViewHistory = (tool: Tool) => {
        setToolForHistory(tool);
        setHistoryDialogOpen(true);
    };

    const filteredTools = useMemo(() => {
        let toolsToDisplay = tools.filter(tool => tool.status !== 'Descartada');
        if (isTechnician && userProfile) {
            toolsToDisplay = tools.filter(tool => tool.currentHolderId === userProfile.uid);
        }
        return toolsToDisplay.filter(tool =>
            normalizeString(tool.name).includes(normalizeString(searchTerm)) ||
            normalizeString(tool.type).includes(normalizeString(searchTerm)) ||
            normalizeString(tool.code).includes(normalizeString(searchTerm)) ||
            normalizeString(tool.status).includes(normalizeString(searchTerm)) ||
            normalizeString(tool.currentHolderName).includes(normalizeString(searchTerm))
        ).sort((a,b) => a.name.localeCompare(b.name));
    }, [tools, searchTerm, isTechnician, userProfile]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4 bg-background/50 backdrop-blur-md">
                <div className="relative">
                    <Loader2 className="animate-spin text-primary h-12 w-12 opacity-20" />
                    <Wrench className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/40 animate-pulse">Sincronizando Ativos & Ferramental</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 text-foreground">
            
            <header className="flex flex-col gap-8 px-6 pt-8 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner text-primary">
                            <Wrench className="h-8 w-8" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="font-semibold tracking-tighter text-xl">
                                {isTechnician ? 'Minhas Ferramentas' : 'Controle de Ferramental'}
                            </h1>

                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative group w-full sm:w-[350px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/30 group-focus-within:text-primary transition-all" />
                            <Input
                                placeholder="Busca inteligente de ativos..."
                                className="h-9 pl-12 bg-background/40 backdrop-blur-md border-border/40 rounded-lg font-semibold shadow-sm focus-visible:ring-primary/20 text-sm text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {canEdit && (
                            <Button 
                                onClick={() => {setEditingTool(undefined); setAddEditDialogOpen(true);}} 
                                className="h-12 w-full sm:w-auto px-8 rounded-2xl font-semibold tracking-tight shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-3 bg-primary shrink-0"
                            >
                                <PlusCircle className="h-5 w-5" /> Novo Ativo
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-1 mt-4 px-6 overflow-hidden w-full max-w-full">
                {/* Mobile View */}
                <div className="grid gap-4 md:hidden w-full min-w-0">
                    {filteredTools.length > 0 ? filteredTools.map(tool => (
                        <Card key={tool.id} className="w-full border-border/40 bg-background/40 backdrop-blur-3xl rounded-xl shadow-premium overflow-hidden active:scale-[0.98] transition-transform" onClick={() => handleViewHistory(tool)}>
                            <CardContent className="p-8 space-y-6">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex flex-col min-w-0">
                                        <p className="font-semibold text-lg tracking-tight text-foreground truncate">{tool.name}</p>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/30 mt-1">{tool.type} • CÓD: {tool.code || 'S/N'}</p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-10 w-10 rounded-xl hover:bg-primary/10 text-primary/40 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                            <DropdownMenuItem onClick={() => handleViewHistory(tool)} className="rounded-xl"><History className="mr-2 h-4 w-4" />Histórico Completo</DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-primary/5" />
                                            {tool.status !== 'Descartada' && (
                                                <>
                                                    {isTechnician ? (
                                                        <>
                                                            {tool.status === 'Aguardando Aceite' && (
                                                                <DropdownMenuItem onClick={() => handleAcceptTool(tool)} className="rounded-xl text-emerald-500 focus:text-emerald-500 font-semibold"><Hand className="mr-2 h-4 w-4" />Aceitar Posse</DropdownMenuItem>
                                                            )}
                                                            {tool.status === 'Em Uso' && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleUpdateStatusOrCondition(tool, { condition: 'OK' })} className="rounded-xl"><CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />Reportar OK</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleUpdateStatusOrCondition(tool, { condition: 'Avariada' })} className="rounded-xl text-amber-500 focus:text-amber-500"><AlertTriangle className="mr-2 h-4 w-4"/>Reportar Avaria</DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {tool.status === 'Disponível' && tool.condition === 'OK' && canEdit && <DropdownMenuItem onClick={() => {setToolToCheckout(tool); setCheckoutDialogOpen(true);}} className="rounded-xl"><ArrowRightLeft className="mr-2 h-4 w-4"/>Entregar Direto</DropdownMenuItem>}
                                                            {tool.status === 'Em Uso' && canEdit && <DropdownMenuItem onClick={() => handleReturnTool(tool)} className="rounded-xl"><Undo2 className="mr-2 h-4 w-4"/>Baixar no Estoque</DropdownMenuItem>}
                                                            <DropdownMenuSeparator className="bg-primary/5" />
                                                            {canEdit && <DropdownMenuItem onClick={() => {setEditingTool(tool); setAddEditDialogOpen(true);}} className="rounded-xl"><Edit className="mr-2 h-4 w-4"/>Editar Ativo</DropdownMenuItem>}
                                                            {canDelete && <DropdownMenuItem onClick={() => handleActionWithReason(tool, 'dispose')} className="rounded-xl text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Descartar Ativo</DropdownMenuItem>}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold uppercase tracking-widest text-primary/30">LOGÍSTICA</span>
                                        <Badge variant={statusConfig[tool.status]?.variant || 'default'} className="w-fit font-semibold text-xs uppercase tracking-widest px-3 py-1 rounded-lg">
                                            {statusConfig[tool.status]?.label || tool.status}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-semibold uppercase tracking-widest text-primary/30">ESTADO FÍSICO</span>
                                        <Badge variant={conditionConfig[tool.condition]?.variant || 'default'} className="w-fit font-semibold text-xs uppercase tracking-widest px-3 py-1 rounded-lg">
                                            {conditionConfig[tool.condition]?.label || tool.condition}
                                        </Badge>
                                    </div>
                                </div>

                                {!isTechnician && tool.currentHolderName && (
                                    <div className="pt-4 border-t border-border/40 flex items-center gap-3">

                                        <span className="text-xs font-semibold text-foreground/60">{tool.currentHolderName}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )) : (
                         <div className="h-64 flex flex-col items-center justify-center gap-4 bg-background/20 backdrop-blur-md rounded-xl border border-dashed border-border/40 text-muted-foreground/40 opacity-50">
                            <Wrench className="h-12 w-12" />
                            <span className="text-xs font-semibold uppercase tracking-widest">Nenhum ativo localizado</span>
                         </div>
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block border-border/40 shadow-premium bg-background/40 backdrop-blur-3xl rounded-xl overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <Table>
                            <TableHeader className="bg-primary/[0.03] border-border/40 h-[34px]">
                                <TableRow className="hover:bg-transparent h-[34px]">
                                    <TableHead className="px-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Descrição do Ativo</TableHead>
                                    <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Status / Localização</TableHead>
                                    {!isTechnician && <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Responsável Atual</TableHead>}
                                    <TableHead className="px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 text-center h-[34px]">Estado</TableHead>
                                    <TableHead className="w-20 px-10 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/40 h-[34px]">Gestão</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTools.map(tool => (
                                    <TableRow key={tool.id} className="[0.03] cursor-pointer transition-all border-border/40 group h-[34px] hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30" onClick={() => handleViewHistory(tool)}>
                                        <TableCell className="py-0 px-10">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">{tool.name}</span>
                                                <span className="text-[10px] font-semibold text-primary/30 uppercase tracking-widest mt-0.5">{tool.type} • CÓD: {tool.code || 'S/N'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-0 px-6 text-center">
                                            <Badge variant={statusConfig[tool.status]?.variant || 'default'} className="font-semibold text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-xl shadow-lg shadow-black/5">
                                                {statusConfig[tool.status]?.label || tool.status}
                                            </Badge>
                                        </TableCell>
                                        {!isTechnician && (
                                            <TableCell className="py-0 px-6">
                                                {tool.currentHolderName ? (
                                                    <div className="flex items-center gap-3">

                                                        <span className="text-xs font-semibold text-foreground/70">{tool.currentHolderName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-primary/20 uppercase tracking-widest">Estoque Central</span>
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell className="py-0 px-6 text-center">
                                            <Badge variant={conditionConfig[tool.condition]?.variant || 'default'} className="font-semibold text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-xl">
                                                {conditionConfig[tool.condition]?.label || tool.condition}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-0 px-10 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-10 w-10 rounded-xl text-primary/20 hover:text-primary hover:bg-primary/10 transition-all active:scale-95" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-premium bg-background/90 backdrop-blur-3xl font-semibold">
                                                    <DropdownMenuItem onClick={() => handleViewHistory(tool)} className="rounded-xl font-semibold"><History className="mr-2 h-4 w-4" />Registro de Logs</DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-primary/5" />
                                                    {tool.status !== 'Descartada' && (
                                                        <>
                                                            {isTechnician ? (
                                                                <>
                                                                    {tool.status === 'Aguardando Aceite' && (
                                                                        <DropdownMenuItem onClick={() => handleAcceptTool(tool)} className="rounded-xl text-emerald-500 focus:text-emerald-500"><Hand className="mr-2 h-4 w-4" />Aceitar Ferramenta</DropdownMenuItem>
                                                                    )}
                                                                    {tool.status === 'Em Uso' && (
                                                                        <>
                                                                            <DropdownMenuItem onClick={() => handleUpdateStatusOrCondition(tool, { condition: 'OK' })} className="rounded-xl"><CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />Confirmar Integridade</DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => handleUpdateStatusOrCondition(tool, { condition: 'Avariada' })} className="rounded-xl text-amber-500 focus:text-amber-500"><AlertTriangle className="mr-2 h-4 w-4"/>Reportar Avaria</DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {tool.status === 'Disponível' && tool.condition === 'OK' && canEdit && <DropdownMenuItem onClick={() => {setToolToCheckout(tool); setCheckoutDialogOpen(true);}} className="rounded-xl"><ArrowRightLeft className="mr-2 h-4 w-4"/>Entregar p/ Técnico</DropdownMenuItem>}
                                                                    {tool.status === 'Em Uso' && canEdit && <DropdownMenuItem onClick={() => handleReturnTool(tool)} className="rounded-xl"><Undo2 className="mr-2 h-4 w-4"/>Confirmar Devolução</DropdownMenuItem>}
                                                                    <DropdownMenuSeparator className="bg-primary/5" />
                                                                    {canEdit && <DropdownMenuItem onClick={() => {setEditingTool(tool); setAddEditDialogOpen(true);}} className="rounded-xl"><Edit className="mr-2 h-4 w-4"/>Editar Dados</DropdownMenuItem>}
                                                                    {canDelete && <DropdownMenuItem onClick={() => handleActionWithReason(tool, 'dispose')} className="rounded-xl text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Descartar Ativo</DropdownMenuItem>}
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {canEdit && <AddEditToolDialog isOpen={isAddEditDialogOpen} setOpen={setAddEditDialogOpen} onSave={handleSaveTool} tool={editingTool} />}
            {canEdit && <CheckoutToolDialog isOpen={isCheckoutDialogOpen} setOpen={setCheckoutDialogOpen} tool={toolToCheckout} teamMembers={teamMembers} onCheckout={handleCheckout} />}
            {actionWithReason && <ReasonDialog
                isOpen={isReasonDialogOpen}
                setOpen={setReasonDialogOpen}
                title={actionWithReason.action === 'maintenance' ? "Enviar para Manutenção" : "Descartar Ferramenta"}
                description={`Por favor, forneça um motivo para ${actionWithReason.action === 'maintenance' ? 'enviar a ferramenta para manutenção' : 'descartar a ferramenta'} "${actionWithReason.tool.name}".`}
                onConfirm={executeActionWithReason}
            />}
            {toolForHistory && <ToolHistoryDialog isOpen={isHistoryDialogOpen} setOpen={setHistoryDialogOpen} tool={toolForHistory} />}
        </div>
    );
}

    
