"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    History,
    TrendingUp,
    BarChart3,
    Users,
    FileText,
    PieChart,
    ArrowUpRight,
    Search,
    Sparkles,
    LayoutDashboard,
    Wrench,
    X,
    AlertTriangle,
    CheckCircle2,
    Clock,
    MapPin,
    Phone,
    RefreshCw,
    ChevronUp,
    ChevronDown,
    DollarSign,
    Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { allMenuItems } from "@/lib/permissions";
import { useAuth } from "@/firebase/auth/use-user";
import { getQuotesOnce } from "@/lib/firebase/firestore";
import { isWithinInterval, startOfMonth, parseISO, isValid, endOfMonth } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type PreventiveClient = {
    id: string;
    clientCode: string;
    name: string;
    phone: string;
    whatsapp?: string;
    city?: string;
    state?: string;
    preventiveMaintenanceFrequency: number;
    lastPreventiveMaintenanceDate: string | null;
    nextDueDate: string | null;
    diasAtraso: number;
    status: 'em_dia' | 'pendente' | 'atrasado';
};

type SortField = 'name' | 'nextDueDate' | 'diasAtraso';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'todos' | 'atrasado' | 'pendente' | 'em_dia';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    atrasado: {
        label: 'Atrasado',
        icon: AlertTriangle,
        badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    },
    pendente: {
        label: 'Próximo',
        icon: Clock,
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    },
    em_dia: {
        label: 'Em dia',
        icon: CheckCircle2,
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
};

function formatDate(iso: string | null) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

// ── Static report list ────────────────────────────────────────────────────────
const reports = [
    {
        href: "/relatorios/historico",
        label: "Histórico Geral",
        description: "Acesse o log completo de O.S., Visitas e Compras da empresa.",
        icon: History,
        page: "relatorios",
        trending: "+12% esta semana",
        inline: false,
    },
    {
        href: "/relatorios/resultados",
        label: "Faturamento e Resultados",
        description: "Veja o faturamento, receitas e custos.",
        icon: DollarSign,
        page: "relatorios",
        trending: "Mês atual",
        inline: false,
    },
    {
        href: "/relatorios/rentabilidade-comodato",
        label: "Rentabilidade Comodato",
        description: "Análise de retorno sobre ativos em regime de comodato.",
        icon: TrendingUp,
        page: "comodato",
        trending: "Estável",
        inline: false,
    },
    {
        href: "/relatorios/conversao",
        label: "Conversão de Vendas",
        description: "Taxa de transformação de orçamentos em ordens de serviço.",
        icon: ArrowUpRight,
        page: "relatorios",
        trending: "+5.4%",
        inline: false,
    },
    {
        href: "/relatorios/desempenho",
        label: "Desempenho Vendas",
        description: "Ranking de produtos e serviços que mais geram receita.",
        icon: BarChart3,
        page: "relatorios",
        trending: "Top: Sensores",
        inline: false,
    },
    {
        href: "/relatorios/desempenho-tecnicos",
        label: "Desempenho Técnicos",
        description: "Métricas de eficiência e qualidade por membro da equipe.",
        icon: Users,
        page: "equipe",
        trending: "Eficiência 94%",
        inline: false,
    },
    {
        href: "/relatorios/analise-clientes",
        label: "Ranking de Clientes",
        description: "Identifique seus clientes mais valiosos e recorrentes.",
        icon: Sparkles,
        page: "clientes",
        trending: "20 novos este mês",
        inline: false,
    },
    {
        href: "/relatorios/extrato-cliente",
        label: "Extrato do Cliente",
        description: "Histórico individualizado de serviços e faturamentos por cliente.",
        icon: FileText,
        page: "clientes",
        trending: "Consulta rápida",
        inline: false,
    },
    {
        href: "#preventive",
        label: "Manutenção Preventiva",
        description: "Lista de clientes comodato com manutenções agendadas.",
        icon: Wrench,
        page: "relatorios",
        trending: "Comodatos ativos",
        inline: true,   // ← abre painel inline
    },
];

const pageColorMap = allMenuItems.reduce((acc, item) => {
    acc[item.page] = item.color;
    return acc;
}, {} as Record<string, string>);

// ── Preventive Panel ──────────────────────────────────────────────────────────
function PreventivePanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
    const [data, setData] = useState<PreventiveClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
    const [sortField, setSortField] = useState<SortField>('diasAtraso');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/preventive?companyId=${companyId}`);
            const json = await res.json();
            setData(Array.isArray(json) ? json : []);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [companyId]);

    const toggleSort = (f: SortField) => {
        if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(f); setSortDir('desc'); }
    };

    const filtered = useMemo(() => {
        let r = data;
        if (filterStatus !== 'todos') r = r.filter(c => c.status === filterStatus);
        if (search.trim()) {
            const q = search.toLowerCase();
            r = r.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.clientCode?.toLowerCase().includes(q) ||
                c.city?.toLowerCase().includes(q)
            );
        }
        return [...r].sort((a, b) => {
            const av = sortField === 'name' ? a.name : sortField === 'nextDueDate' ? (a.nextDueDate ?? '') : a.diasAtraso;
            const bv = sortField === 'name' ? b.name : sortField === 'nextDueDate' ? (b.nextDueDate ?? '') : b.diasAtraso;
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, filterStatus, search, sortField, sortDir]);

    const counts = {
        total: data.length,
        atrasado: data.filter(c => c.status === 'atrasado').length,
        pendente: data.filter(c => c.status === 'pendente').length,
        em_dia: data.filter(c => c.status === 'em_dia').length,
    };

    const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
        <button
            onClick={() => toggleSort(field)}
            className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
            {label}
            {sortField === field
                ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />
                : <ChevronDown className="h-3 w-3 opacity-30" />}
        </button>
    );

    return (
        <div className="rounded-[2rem] border border-primary/20 bg-background/60 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-primary/5 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/20 bg-primary/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-sm tracking-tight">Manutenção Preventiva</h2>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Clientes comodato</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={load}
                        disabled={loading}
                        className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 divide-x divide-border/20 border-b border-border/20">
                {[
                    { label: 'Total', value: counts.total, color: 'text-primary' },
                    { label: 'Atrasados', value: counts.atrasado, color: 'text-red-400' },
                    { label: 'Próximos', value: counts.pendente, color: 'text-amber-400' },
                    { label: 'Em dia', value: counts.em_dia, color: 'text-emerald-400' },
                ].map(k => (
                    <div key={k.label} className="px-5 py-3 flex flex-col items-center">
                        <span className={cn("text-2xl font-bold tracking-tight", k.color)}>
                            {loading ? '–' : k.value}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{k.label}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 px-5 py-3 border-b border-border/10 bg-muted/5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Buscar cliente, código ou cidade…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs rounded-xl border-border/30 bg-background/40"
                    />
                </div>
                <div className="flex gap-1.5">
                    {(['todos', 'atrasado', 'pendente', 'em_dia'] as FilterStatus[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={cn(
                                "px-3 py-1 rounded-xl text-[10px] font-semibold uppercase tracking-wider border transition-all",
                                filterStatus === s
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border/30 text-muted-foreground hover:border-primary/30"
                            )}
                        >
                            {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2 bg-muted/10 border-b border-border/10">
                    <SortBtn field="name" label="Cliente" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Frequência</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Última visita</span>
                    <SortBtn field="nextDueDate" label="Próxima" />
                    <SortBtn field="diasAtraso" label="Status" />
                </div>

                {/* Rows */}
                <div className="max-h-[420px] overflow-y-auto">
                    {loading ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-40" />
                            Carregando…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                            <Wrench className="h-6 w-6 mx-auto mb-2 opacity-20" />
                            Nenhum cliente encontrado
                        </div>
                    ) : (
                        filtered.map((c, i) => {
                            const cfg = STATUS_CONFIG[c.status];
                            const Icon = cfg.icon;
                            return (
                                <div
                                    key={c.id}
                                    className={cn(
                                        "grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-muted/10 transition-colors",
                                        i !== filtered.length - 1 && "border-b border-border/10"
                                    )}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="font-semibold text-sm truncate">{c.name}</span>
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                            <span className="font-mono">{c.clientCode}</span>
                                            {c.city && (
                                                <>
                                                    <span>·</span>
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">{[c.city, c.state].filter(Boolean).join(' – ')}</span>
                                                </>
                                            )}
                                        </div>
                                        {c.phone && (
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                                <Phone className="h-3 w-3" />{c.phone}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {c.preventiveMaintenanceFrequency === 1 ? 'Mensal' : `${c.preventiveMaintenanceFrequency}m`}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{formatDate(c.lastPreventiveMaintenanceDate)}</span>
                                    <div className="flex flex-col gap-0.5">
                                        <span className={cn("text-sm font-semibold", c.status === 'atrasado' ? 'text-red-400' : '')}>
                                            {formatDate(c.nextDueDate)}
                                        </span>
                                        {c.diasAtraso > 0 && (
                                            <span className="text-[10px] text-red-400 font-medium">{c.diasAtraso}d atraso</span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border w-fit",
                                        cfg.badge
                                    )}>
                                        <Icon className="h-2.5 w-2.5" />{cfg.label}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsHub() {
    const { userProfile, firebase } = useAuth();
    const [showPreventive, setShowPreventive] = useState(false);
    const [faturamento, setFaturamento] = useState<number | null>(null);
    const [loadingFaturamento, setLoadingFaturamento] = useState(true);

    useEffect(() => {
        if (userProfile?.companyId && firebase.db) {
            getQuotesOnce(firebase.db, userProfile.companyId, userProfile).then(quotes => {
                const now = new Date();
                const start = startOfMonth(now);
                const end = endOfMonth(now);
                const total = quotes.filter(q => {
                    if (q.status !== 'Finalizado' || !q.completionDate) return false;
                    const cDate = parseISO(q.completionDate);
                    return isValid(cDate) && isWithinInterval(cDate, { start, end });
                }).reduce((sum, q) => sum + (q.total || 0), 0);
                setFaturamento(total);
                setLoadingFaturamento(false);
            });
        }
    }, [userProfile, firebase]);

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
            <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-8">
                <div className="space-y-1">
                    <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                        <LayoutDashboard className="text-primary h-8 w-8" />
                        Intelligence Hub
                    </h1>
                </div>
            </header>

            <main className="px-4 md:px-8 pb-10 space-y-8">
                {/* Painel Rápido de Faturamento */}
                <div className="bg-primary/5 border border-primary/20 backdrop-blur-sm rounded-[2.5rem] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase tracking-widest text-xs">
                            <TrendingUp className="h-4 w-4 text-primary" /> Faturamento Mês Atual
                        </div>
                        {loadingFaturamento ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                                <span className="text-sm text-muted-foreground">Calculando...</span>
                            </div>
                        ) : (
                            <div className="text-4xl font-bold tracking-tighter text-primary">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(faturamento || 0)}
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">Baseado nas ordens de serviço finalizadas neste mês.</p>
                    </div>
                    <Link href="/relatorios/resultados" className="shrink-0">
                        <button className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm">
                            Ver Relatório Completo
                        </button>
                    </Link>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {reports.map((report) => {
                        const color = pageColorMap[report.page] || 'hsl(var(--primary))';
                        const Icon = report.icon;
                        const isActive = report.inline && showPreventive;

                        const cardContent = (
                            <div className={cn(
                                "relative h-full bg-background/40 backdrop-blur-3xl rounded-[2.5rem] border shadow-premium transition-all duration-500 hover:scale-[1.02] hover:bg-background/60 overflow-hidden p-8 flex flex-col justify-between",
                                isActive ? "border-primary/40 bg-background/60 scale-[1.02]" : "border-border/40"
                            )}>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />

                                <div className="relative">
                                    <div className="flex items-start justify-between mb-8">
                                        <div
                                            className="p-4 rounded-2xl shadow-2xl transition-all duration-700 group-hover:rotate-6 group-hover:scale-110"
                                            style={{ backgroundColor: `${color}15`, color, boxShadow: `0 10px 30px -10px ${color}40` }}
                                        >
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <Badge variant="outline" className="bg-primary/5 border-border/40 text-[9px] font-semibold uppercase tracking-[0.2em] px-3 h-6 rounded-full opacity-40 group-hover:opacity-100 transition-opacity">
                                            {report.inline ? 'Inline' : 'Analítico'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-lg font-semibold uppercase tracking-tight leading-tight group-hover:text-primary transition-colors">
                                            {report.label}
                                        </h3>
                                        <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest leading-relaxed line-clamp-2">
                                            {report.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="relative mt-10 flex items-center justify-between pt-6 border-t border-border/40">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-30">Status / Tendência</span>
                                        <span className="text-[10px] font-semibold tracking-tight text-primary uppercase">
                                            {report.trending}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "h-10 w-10 rounded-2xl flex items-center justify-center bg-primary text-white shadow-lg shadow-primary/20 transition-all group-hover:rotate-45",
                                        isActive && "rotate-45"
                                    )}>
                                        <ArrowUpRight className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        );

                        if (report.inline) {
                            return (
                                <button
                                    key={report.label}
                                    onClick={() => setShowPreventive(v => !v)}
                                    className="group outline-none text-left"
                                >
                                    {cardContent}
                                </button>
                            );
                        }

                        return (
                            <Link key={report.label} href={report.href} className="group outline-none">
                                {cardContent}
                            </Link>
                        );
                    })}
                </div>

                {/* Inline Preventive Panel */}
                {showPreventive && userProfile?.companyId && (
                    <PreventivePanel
                        companyId={userProfile.companyId}
                        onClose={() => setShowPreventive(false)}
                    />
                )}

                {/* Bottom feature cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-primary/5 backdrop-blur-3xl border border-dashed border-primary/20 rounded-[2.5rem] p-8 flex items-center gap-6 group hover:bg-primary/10 transition-colors">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                            <Search className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold uppercase text-sm tracking-tight">Arquitetura de Busca Unificada</h4>
                        </div>
                    </div>
                    <div className="bg-primary/5 backdrop-blur-3xl border border-dashed border-primary/20 rounded-[2.5rem] p-8 flex items-center gap-6 group hover:bg-primary/10 transition-colors">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold uppercase text-sm tracking-tight">Relatórios Inteligentes</h4>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
