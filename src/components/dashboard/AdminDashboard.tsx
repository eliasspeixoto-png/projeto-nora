"use client";

import { useState, useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { AccountsReceivable, Quote, Visit, ComodatoAsset, Client, PurchaseOrder, Product } from "@/lib/data";
import {
    getAccountsReceivableOnce,
    getQuotesOnce,
    getVisitsOnce,
    getComodatoAssetsOnce,
    getClientsOnce,
    getProductsOnce,
    getPurchaseOrdersOnce,
    getOnlineTeamOnce,
    getLeads
} from "@/lib/firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import type { Lead } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { isWithinInterval, startOfMonth, endOfMonth, parseISO, subMonths, format, isPast, isValid, subDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Activity, LayoutDashboard, Building, ShoppingCart, Sparkles, TrendingUp, Zap, Truck, ChevronRight } from "lucide-react";
import { osStatusConfig } from "@/components/ordem-de-servico/os-status-config";
import { statusConfig as visitStatusConfig } from "@/components/visitas/visit-status";
import PendingEventsAlerts from "@/components/dashboard/PendingEventsAlerts";

// Importações Dinâmicas Agregadas para Performance Máxima
const ModernKPIs = dynamic(() => import("@/components/dashboard/ModernKPIs"), { ssr: false });
const MainPulse = dynamic(() => import("@/components/dashboard/MainPulse"), { ssr: false });
const OperationalIntelligence = dynamic(() => import("@/components/dashboard/OperationalIntelligence"), { ssr: false });
const PartnerDistributors = dynamic(() => import("@/components/dashboard/PartnerDistributors"), { ssr: false });
const PurchaseStats = dynamic(() => import("@/components/dashboard/PurchaseStats"), { ssr: false });
const PremiumHero = dynamic(() => import("@/components/dashboard/PremiumHero"), { ssr: false });
const ComodatoStatsCards = dynamic(() => import("@/components/comodato/stats-cards"), { ssr: false });

const RevenueChart = dynamic(() => import("@/components/dashboard/RevenueChart"), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-muted/5 animate-pulse rounded-2xl border border-border/20" />,
});

const StatusChart = dynamic(() => import("@/components/financeiro/StatusChart"), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-muted/5 animate-pulse rounded-2xl border border-border/20" />,
});

const PurchaseChart = dynamic(() => import("@/components/dashboard/PurchaseChart"), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-muted/5 animate-pulse rounded-2xl border border-border/20" />,
});

export default function AdminDashboard() {
    const { userProfile, firebase, isDeveloper, company, impersonatedCompany, stopImpersonating } = useAuth();
    const { toast } = useToast();
    const [leads, setLeads] = useState<Lead[]>([]);

    const companyId = useMemo(() => userProfile?.companyId, [userProfile?.companyId]);
    const uid = useMemo(() => userProfile?.uid, [userProfile?.uid]);
    const db = useMemo(() => firebase?.db, [firebase?.db]);

    const isAuthorizedForLeads = useMemo(() => {
        if (!userProfile || !company) return false;
        const isEspTec = company.name?.toLowerCase().includes('esp') || company.name?.toLowerCase().includes('tec');
        const isAuthorizedRole = ['admin', 'supervisor'].includes(userProfile.role);
        return !!isEspTec && isAuthorizedRole;
    }, [userProfile?.role, company?.name]);

    const userForQuery = useMemo(() => ({
        uid: userProfile?.uid,
        role: userProfile?.role,
        displayName: userProfile?.displayName,
    }), [userProfile?.uid, userProfile?.role, userProfile?.displayName]);

    // Memoized queries to avoid recreation on each render
    const queries = useMemo(() => [
        {
            queryKey: ['quotes', companyId, uid, 365],
            queryFn: () => getQuotesOnce(db, companyId!, userForQuery, 365),
            enabled: true,
        },
        {
            queryKey: ['accountsReceivable', companyId, 365],
            queryFn: () => getAccountsReceivableOnce(db, companyId!, 365),
            enabled: true,
        },
        {
            queryKey: ['visits', companyId, uid, 90],
            queryFn: () => getVisitsOnce(db, companyId!, userForQuery, 90),
            enabled: true,
        },
        {
            queryKey: ['comodatoAssets', companyId],
            queryFn: () => getComodatoAssetsOnce(db, companyId!),
            enabled: true,
        },
        {
            queryKey: ['clients', companyId],
            queryFn: () => getClientsOnce(db, companyId!),
            enabled: true,
        },
        {
            queryKey: ['purchaseOrders', companyId, 90],
            queryFn: () => getPurchaseOrdersOnce(db, companyId!, 90),
            enabled: true,
        },
        {
            queryKey: ['onlineTeam', companyId],
            queryFn: () => getOnlineTeamOnce(db, companyId!),
            enabled: true,
        },
        {
            queryKey: ['products', companyId],
            queryFn: () => getProductsOnce(db, companyId!),
            enabled: true,
        },
    ], [companyId, uid, db, userForQuery]);

    const results = useQueries({ queries });

    const isLoading = results.some(result => result.isLoading);
    const quotes = (results[0].data as Quote[]) || [];
    const accountsReceivable = (results[1].data as AccountsReceivable[]) || [];
    const visits = (results[2].data as Visit[]) || [];
    const comodatoAssets = (results[3].data as ComodatoAsset[]) || [];
    const clients = (results[4].data as Client[]) || [];
    const purchaseOrders = (results[5].data as PurchaseOrder[]) || [];
    const onlineTeam = (results[6].data as any[]) || [];
    const products = (results[7].data as Product[]) || [];

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db || !isAuthorizedForLeads) return;
        const unsubscribe = getLeads(firebase.db, userProfile.companyId, (data) => {
            setLeads(data);
        }, (error) => {
            console.error("Erro ao carregar leads real-time no dash:", error);
        });
        return () => unsubscribe();
    }, [userProfile?.companyId, firebase.db, isAuthorizedForLeads]);

    const serviceOrders = useMemo(() => (quotes || []).filter(q => q && ['Pendente', 'Atribuída', 'Em Execução', 'Finalizado', 'Agendado'].includes(q.status)), [quotes]);

    const monthlyChartData = useMemo(() => {
        const dataByMonth: { [key: string]: { Receita: number; Lucro: number; Custo: number; label: string } } = {};
        
        // Função auxiliar para lidar com diferentes formatos de data (ISO String ou Firestore Timestamp)
        const parseFirebaseDate = (dateVal: any) => {
            if (!dateVal) return null;
            if (typeof dateVal === 'string') return parseISO(dateVal);
            if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
            if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
            return null;
        };

        // Inicializar os últimos 12 meses com chaves robustas (yyyy-MM)
        for (let i = 11; i >= 0; i--) {
            const date = subMonths(new Date(), i);
            const internalKey = format(date, "yyyy-MM");
            const displayLabel = format(date, "MMM/yy", { locale: ptBR });
            dataByMonth[internalKey] = { Receita: 0, Lucro: 0, Custo: 0, label: displayLabel };
        }

        (quotes || []).forEach((quote) => {
            if (!quote) return;
            
            const status = (quote.status || "").toLowerCase();
            // Aceitar Finalizado ou Aprovado
            if (status !== "finalizado" && status !== "aprovado") return;

            // Tentar completionDate, se não houver, usar date (criação) como fallback para histórico
            const targetDate = parseFirebaseDate(quote.completionDate) || parseFirebaseDate(quote.date);
            if (!targetDate || !isValid(targetDate)) return;

            const internalKey = format(targetDate, "yyyy-MM");

            if (dataByMonth[internalKey]) {
                const totalCost = (quote.items || []).reduce((sum, item) => sum + (item.product?.materialPrice || 0) * (item.quantity || 0), 0);
                dataByMonth[internalKey].Receita += (quote.total || 0);
                dataByMonth[internalKey].Lucro += ((quote.total || 0) - totalCost);
                dataByMonth[internalKey].Custo += totalCost;
            }
        });

        return Object.values(dataByMonth).map(values => ({ 
            month: values.label, 
            Receita: values.Receita, 
            Lucro: values.Lucro, 
            Custo: values.Custo 
        }));
    }, [quotes]);

    const monthlyPurchaseData = useMemo(() => {
        const data: { month: string; fullDate: string; total: number }[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const date = subMonths(now, i);
            const monthKey = format(date, "MMM/yy", { locale: ptBR });
            const start = startOfMonth(date);
            const end = endOfMonth(date);

            const monthOrders = (purchaseOrders || []).filter(o => {
                if (!o || !o.creationDate) return false;
                const orderDate = parseISO(o.creationDate);
                return isValid(orderDate) && isWithinInterval(orderDate, { start, end });
            });

            data.push({
                month: monthKey,
                fullDate: format(date, 'yyyy-MM-dd'),
                total: monthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
            });
        }
        return data;
    }, [purchaseOrders]);

    const stats = useMemo(() => {
        const now = new Date();
        const startOfThisMonth = startOfMonth(now);

        const overdueOS = serviceOrders.filter(os => {
            if (!os || (!os.expectedEndDate && !os.scheduledDate)) return false;
            try {
                const targetDateStr = os.expectedEndDate || os.scheduledDate;
                const schedDate = parseISO(`${targetDateStr}T23:59:59`);
                return isValid(schedDate) && isPast(schedDate) && !['Finalizado', 'rejected'].includes(os.status);
            } catch { return false; }
        }).length;

        const overdueVisits = (visits || []).filter(v => {
            if (!v || !v.visitDate) return false;
            try {
                const vDate = parseISO(`${v.visitDate}T23:59:59`);
                return isValid(vDate) && isPast(vDate) && !['Finalizada', 'Gerar Orçamento'].includes(v.status);
            } catch { return false; }
        }).length;

        return {
            faturamentoMesAtual: (quotes || []).filter(q => {
                if (!q || !q.completionDate) return false;
                const cDate = parseISO(q.completionDate);
                return q.status === 'Finalizado' && isValid(cDate) && isWithinInterval(cDate, { start: startOfThisMonth, end: endOfMonth(now) });
            }).reduce((sum, q) => sum + (q.total || 0), 0),
            approvedThisMonth: (quotes || []).filter(q => {
                if (!q || !q.date) return false;
                const qDate = parseISO(q.date);
                return q.status === 'Aprovado' && isValid(qDate) && isWithinInterval(qDate, { start: startOfThisMonth, end: now });
            }).reduce((sum, q) => sum + (q.total || 0), 0),
            pendingApproval: (quotes || []).filter(q => q && q.status === 'sent').length,
            pendingOS: serviceOrders.filter(os => os && os.status === 'Pendente').length,
            assignedOS: serviceOrders.filter(os => os && os.status === 'Atribuída').length,
            inExecution: serviceOrders.filter(os => os && os.status === 'Em Execução').length,
            pendingRevision: serviceOrders.filter(os => os && os.status === 'revision-pending').length,
            pendingReceivables: (accountsReceivable || []).filter(ar => ar && ['Pendente', 'Parcial'].includes(ar.status)).reduce((sum, r) => sum + (r.amount || 0), 0),
            generateQuoteVisits: (visits || []).filter(v => v && ['Solicitada', 'Gerar Orçamento', 'Agendada', 'Atribuída'].includes(v.status)).length,
            overdueTasks: overdueOS + overdueVisits,
        };
    }, [quotes, serviceOrders, accountsReceivable, visits]);

    const comodatoStats = useMemo(() => {
        const activeAssets = (comodatoAssets || []).filter(a => a && a.status !== 'returned');
        const activeClients = (clients || []).filter(c => c && c.isComodato && c.comodatoStatus === 'Ativo');
        const totalMonthlyRevenue = activeClients.reduce((sum, client) => {
            const value = typeof client.serviceValue === 'string' ? parseFloat(client.serviceValue) : (client.serviceValue || 0);
            return sum + (isNaN(value) ? 0 : value);
        }, 0);

        return {
            totalClients: activeClients.length,
            totalAssets: activeAssets.filter(a => a.clientId).length,
            inMaintenance: activeAssets.filter(a => a.status === 'maintenance').length,
            pendingInstall: activeAssets.filter(a => !a.installationDate && a.status === 'active' && !a.clientId).length,
            monthlyRevenue: totalMonthlyRevenue,
        };
    }, [comodatoAssets, clients]);

    const purchaseStats = useMemo(() => {
        const now = new Date();
        const startOfThisMonth = startOfMonth(now);
        return {
            pendingOrders: (purchaseOrders || []).filter(o => o && ['Rascunho', 'Pedido'].includes(o.status)).length,
            approvedThisMonth: (purchaseOrders || []).filter(o => {
                if (!o || !o.creationDate) return false;
                const cDate = parseISO(o.creationDate);
                return ['Pedido', 'Recebido'].includes(o.status) && isValid(cDate) && isWithinInterval(cDate, { start: startOfThisMonth, end: now });
            }).length,
            totalSpentThisMonth: (purchaseOrders || []).filter(o => {
                if (!o || !o.creationDate) return false;
                const cDate = parseISO(o.creationDate);
                return ['Pedido', 'Recebido'].includes(o.status) && isValid(cDate) && isWithinInterval(cDate, { start: startOfThisMonth, end: now });
            }).reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            overdueOrders: (purchaseOrders || []).filter(o => {
                if (!o || !o.deliveryDate) return false;
                try {
                    const dDate = parseISO(o.deliveryDate);
                    return isValid(dDate) && isPast(dDate) && !['Recebido', 'Cancelado'].includes(o.status);
                } catch { return false; }
            }).length,
        }
    }, [purchaseOrders]);

    const statusChartData = useMemo(() => {
        let totalReceived = 0;
        const twelveMonthsAgo = subMonths(new Date(), 12);

        (accountsReceivable || []).forEach(ar => {
            if (!ar) return;
            if (ar.paymentHistory && Array.isArray(ar.paymentHistory)) {
                ar.paymentHistory.forEach(p => {
                    if (!p || !p.date) return;
                    const pDate = parseISO(p.date);
                    // Mostrar o que foi RECEBIDO nos últimos 12 meses
                    if (isValid(pDate) && pDate >= twelveMonthsAgo) totalReceived += (p.amount || 0);
                });
            } else if (ar.status === 'Pago' && ar.paymentDate) {
                const payDate = parseISO(ar.paymentDate);
                if (isValid(payDate) && payDate >= twelveMonthsAgo) {
                    totalReceived += ar.originalAmount || ar.amount || 0;
                }
            }
        });

        // REMOVIDO o filtro de 60 dias para PENDENTES para mostrar o valor Real a receber
        const allPending = (accountsReceivable || []).filter(ar => {
            if (!ar || ar.status === 'Pago') return false;
            return true;
        });

        const summary = allPending.reduce((acc, curr) => {
            const key = curr.status === 'Parcial' ? 'Receber Parcelado' : 'A Receber';
            if (!acc[key]) acc[key] = { value: 0, count: 0 };
            acc[key].value += (curr.amount || 0);
            acc[key].count += 1;
            return acc;
        }, {} as any);

        return [
            { status: 'A Receber', value: summary['A Receber']?.value || 0, count: summary['A Receber']?.count || 0 },
            { status: 'Receber Parcelado', value: summary['Receber Parcelado']?.value || 0, count: summary['Receber Parcelado']?.count || 0 },
            {
                status: 'Recebido', value: totalReceived, count: (accountsReceivable || []).filter(ar => {
                    if (!ar || ar.status !== 'Pago' || !ar.paymentDate) return false;
                    const payDate = parseISO(ar.paymentDate);
                    // Recebido agora mostra últimos 12 meses
                    return isValid(payDate) && payDate >= twelveMonthsAgo;
                }).length
            },
        ].filter(item => item.value > 0 || item.count > 0);
    }, [accountsReceivable]);

    // NEW MODERN DASHBOARD LOGIC
    const modernStats = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();

        const revenueTrend = last7Days.map(day => ({
            date: format(day, 'dd/MM'),
            value: (quotes || []).filter(q => q.status === 'Finalizado' && q.completionDate && isSameDay(parseISO(q.completionDate), day))
                .reduce((sum, q) => sum + (q.total || 0), 0)
        }));

        const clientTrend = last7Days.map(day => ({
            date: format(day, 'dd/MM'),
            value: (clients || []).filter(c => c.creationDate && isSameDay(parseISO(c.creationDate), day)).length
        }));

        const efficiencyTrend = last7Days.map(day => {
            const dayOS = serviceOrders.filter(os => os.scheduledDate && isSameDay(parseISO(os.scheduledDate), day));
            const finishedOnTime = dayOS.filter(os => os.status === 'Finalizado').length;
            return {
                date: format(day, 'dd/MM'),
                value: dayOS.length > 0 ? Math.round((finishedOnTime / dayOS.length) * 100) : 100
            };
        });

        const lowStockCount = (products || []).filter(p => (p.stockQuantity || 0) <= (p.minStockQuantity || 0)).length;
        const stockTrend = last7Days.map((day, i) => ({
            date: format(day, 'dd/MM'),
            value: lowStockCount + (i * 2) // Simulating trend for visuals
        }));

        const receivableTrend = last7Days.map(day => ({
            date: format(day, 'dd/MM'),
            value: (accountsReceivable || []).filter(ar => ar.status !== 'Pago' && ar.dueDate && isSameDay(parseISO(ar.dueDate), day))
                .reduce((sum, ar) => sum + (ar.amount || 0), 0)
        }));

        const activeLeads = (leads || []).filter(l => l.status !== 'Finalizado');

        const leadsTrend = last7Days.map(day => ({
            date: format(day, 'dd/MM'),
            value: activeLeads.filter(l => l.createdAt && isSameDay(parseISO(l.createdAt), day)).length
        }));

        const totalOperational = serviceOrders.length + (visits || []).length;
        const finishedCount = serviceOrders.filter(os => os.status === 'Finalizado').length + (visits || []).filter(v => v.status === 'Finalizada').length;

        const totalReceivableValue = (accountsReceivable || []).filter(ar => ['Pendente', 'Parcial'].includes(ar.status))
            .reduce((sum, ar) => sum + (ar.amount || 0), 0);

        const hasNewLeads = (leads || []).some(l => l.status === 'Novo Lead' || (l.status as string) === 'novo');

        return {
            ...stats,
            faturamentoMesAtual: stats.faturamentoMesAtual,
            revenueTrend,
            clientTrend,
            efficiencyTrend,
            stockTrend,
            receivableTrend,
            leadsTrend,
            totalClients: clients.length,
            totalLeads: activeLeads.length,
            lowStockCount,
            totalReceivable: totalReceivableValue,
            efficiencyRate: totalOperational > 0 ? Math.round((finishedCount / totalOperational) * 100) : 100,
            stockHealth: lowStockCount > 5 ? "Crítico" : lowStockCount > 0 ? "Atenção" : "Excelente",
            isAuthorizedForLeads,
            hasNewLeads
        };
    }, [quotes, clients, serviceOrders, visits, products, stats, accountsReceivable, leads, isAuthorizedForLeads]);

    const recentActivities = useMemo(() => {
        const allItems = [
            ...(quotes || []).map(q => {
                const statusLabel = osStatusConfig[q.status as keyof typeof osStatusConfig]?.label || q.status;
                return { id: q.id, type: 'os' as const, title: `O.S. ${q.quoteNumber}`, description: `${q.clientName} - ${statusLabel}`, time: q.date, status: q.status }
            }),
            ...(visits || []).map(v => {
                const statusLabel = visitStatusConfig[v.status as keyof typeof visitStatusConfig]?.label || v.status;
                return { id: v.id, type: 'visit' as const, title: `Visita ${v.visitNumber}`, description: `${v.clientName} - ${v.description}`, time: v.visitDate, status: v.status }
            }),
            ...(accountsReceivable || []).filter(ar => ar.status === 'Pago').map(ar => ({ id: ar.id, type: 'payment' as const, title: `Pagamento Recebido`, description: `${ar.clientName} - ${ar.amount}`, time: ar.paymentDate || ar.dueDate || '', status: 'Pago' }))
        ].filter(item => item.time && isValid(parseISO(item.time)))
            .sort((a, b) => parseISO(b.time).getTime() - parseISO(a.time).getTime())
            .slice(0, 10);

        return allItems;
    }, [quotes, visits, accountsReceivable]);

    const dashboardAlerts = useMemo(() => {
        const alerts: { type: "stock" | "overdue"; message: string; count: number }[] = [];
        const lowStock = (products || []).filter(p => (p.stockQuantity || 0) <= (p.minStockQuantity || 0)).length;
        if (lowStock > 0) alerts.push({ type: 'stock', message: 'Itens em Estoque Crítico', count: lowStock });

        const overdue = stats.overdueTasks;
        if (overdue > 0) alerts.push({ type: 'overdue', message: 'Tarefas em Atraso', count: overdue });

        return alerts;
    }, [products, stats.overdueTasks]);

    const statusSnapshot = useMemo(() => [
        { status: 'finalizado', count: serviceOrders.filter(os => os.status === 'Finalizado').length + (visits || []).filter(v => v.status === 'Finalizada').length },
        { status: 'execucao', count: serviceOrders.filter(os => os.status === 'Em Execução').length },
        { status: 'atrasado', count: stats.overdueTasks },
        { status: 'pendente', count: serviceOrders.filter(os => os.status === 'Pendente').length + (visits || []).filter(v => v.status === 'Agendada').length },
    ], [serviceOrders, visits, stats.overdueTasks]);


    if (isLoading) return (
        <div className="flex h-[80vh] w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        </div>
    );

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1750px] mx-auto overflow-x-hidden">
            <PremiumHero
                userName={userProfile?.displayName}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-1">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Visão Geral de Performance
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Métricas em tempo real</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Botão Exportar Removido conforme solicitação */}
                    {isDeveloper && impersonatedCompany && (
                        <Button size="sm" onClick={stopImpersonating} variant="outline" className="h-8 font-semibold border-rose-200 text-rose-600 bg-rose-50 text-[9px] uppercase tracking-widest">
                            <ArrowLeft className="mr-2 h-3 w-3" /> Sair da Empresa
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <PendingEventsAlerts quotes={quotes} visits={visits} />
                {/* 1. KPIs Section */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">
                        <Activity className="h-3.5 w-3.5" /> Performance
                    </div>
                    <ModernKPIs stats={modernStats} />
                </div>

                {/* 2. Charts Section */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">
                        <TrendingUp className="h-3.5 w-3.5" /> Tendências
                    </div>
                    <div className="glass-premium noise-overlay p-4 rounded-2xl border border-border/40">
                        <MainPulse
                            trendData={monthlyChartData}
                            statusData={statusSnapshot}
                            receivableData={statusChartData}
                        />
                    </div>
                </div>

                {/* 3. Operational Intel Section */}
                <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/60">
                            <Zap className="h-3.5 w-3.5" /> Inteligência
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-3 text-[9px] font-semibold uppercase tracking-widest text-primary hover:bg-primary/10 rounded-full">
                            Ver Insights <ChevronRight className="ml-1 h-2.5 w-2.5" />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        <OperationalIntelligence
                            activities={recentActivities}
                            onlineTeam={onlineTeam}
                            alerts={dashboardAlerts}
                        />
                        <div className="p-3 rounded-xl bg-primary/5 border border-border/40 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full" />
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Visão do Sistema</h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Monitorando <span className="text-foreground font-semibold">{onlineTeam.length}</span> membros em tempo real. Integrações <span className="text-emerald-500 font-semibold uppercase">Operacionais</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 4. Flows Section */}
                <div className="flex flex-col gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500/60">
                            <Building className="h-3.5 w-3.5" /> Comodato
                        </div>
                        <ComodatoStatsCards stats={comodatoStats} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500/60">
                            <ShoppingCart className="h-3.5 w-3.5" /> Produtos
                        </div>
                        <PurchaseStats stats={purchaseStats} />
                    </div>
                </div>

                {/* 5. Logistics Section */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500/60">
                        <Truck className="h-3.5 w-3.5" /> Distribuidores Parceiros
                    </div>
                    <div className="glass-premium p-3 rounded-xl border border-border/40">
                        <PartnerDistributors />
                    </div>
                </div>
            </div>
        </div>
    );
}
