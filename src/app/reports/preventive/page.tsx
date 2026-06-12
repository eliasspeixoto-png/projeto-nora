"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import {
    Wrench,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Phone,
    MapPin,
    RefreshCw,
    Search,
    Filter,
    ChevronUp,
    ChevronDown,
    Calendar,
    Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    comodatoStatus?: string;
    serviceDescription?: string;
    serviceValue?: number;
};

type SortField = 'name' | 'nextDueDate' | 'diasAtraso' | 'status';
type SortDir = 'asc' | 'desc';
type FilterStatus = 'todos' | 'atrasado' | 'pendente' | 'em_dia';

const STATUS_CONFIG = {
    atrasado: {
        label: 'Atrasado',
        icon: AlertTriangle,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    },
    pendente: {
        label: 'Próximo',
        icon: Clock,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
        badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    },
    em_dia: {
        label: 'Em dia',
        icon: CheckCircle2,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    },
};

function formatDate(iso: string | null) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

export default function PreventivePage() {
    const { userProfile } = useAuth();
    const [data, setData] = useState<PreventiveClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
    const [sortField, setSortField] = useState<SortField>('diasAtraso');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const companyId = userProfile?.companyId;

    const fetchData = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/preventive?companyId=${companyId}`);
            if (!res.ok) throw new Error('Erro ao carregar dados.');
            const json = await res.json();
            setData(Array.isArray(json) ? json : []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const filtered = useMemo(() => {
        let result = data;
        if (filterStatus !== 'todos') result = result.filter(c => c.status === filterStatus);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.clientCode?.toLowerCase().includes(q) ||
                c.city?.toLowerCase().includes(q)
            );
        }
        result = [...result].sort((a, b) => {
            let av: any, bv: any;
            if (sortField === 'name') { av = a.name; bv = b.name; }
            else if (sortField === 'nextDueDate') { av = a.nextDueDate ?? ''; bv = b.nextDueDate ?? ''; }
            else if (sortField === 'diasAtraso') { av = a.diasAtraso; bv = b.diasAtraso; }
            else { av = a.status; bv = b.status; }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [data, filterStatus, search, sortField, sortDir]);

    const counts = useMemo(() => ({
        total: data.length,
        atrasado: data.filter(c => c.status === 'atrasado').length,
        pendente: data.filter(c => c.status === 'pendente').length,
        em_dia: data.filter(c => c.status === 'em_dia').length,
    }), [data]);

    const SortIcon = ({ field }: { field: SortField }) => (
        <span className="ml-1 inline-flex flex-col opacity-40">
            {sortField === field
                ? sortDir === 'asc'
                    ? <ChevronUp className="h-3 w-3 opacity-100 text-primary" />
                    : <ChevronDown className="h-3 w-3 opacity-100 text-primary" />
                : <ChevronDown className="h-3 w-3" />}
        </span>
    );

    return (
        <div className="flex flex-col w-full min-h-screen max-w-[100vw] overflow-x-hidden">
            {/* Header */}
            <header className="px-4 md:px-8 pt-8 pb-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Wrench className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">Manutenção Preventiva</h1>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                                Clientes comodato · Agendamento de visitas
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        disabled={loading}
                        className="gap-2 rounded-xl border-border/40"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Atualizar
                    </Button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: counts.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
                        { label: 'Atrasados', value: counts.atrasado, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                        { label: 'Próximos', value: counts.pendente, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { label: 'Em dia', value: counts.em_dia, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map(kpi => (
                        <div key={kpi.label} className="rounded-2xl border border-border/30 bg-background/40 backdrop-blur-sm p-4 flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", kpi.bg)}>
                                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold tracking-tight">{loading ? '—' : kpi.value}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </header>

            {/* Filters */}
            <div className="px-4 md:px-8 pb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, código ou cidade…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 rounded-xl border-border/40 bg-background/40"
                    />
                </div>
                <div className="flex gap-2">
                    {(['todos', 'atrasado', 'pendente', 'em_dia'] as FilterStatus[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider border transition-all",
                                filterStatus === s
                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                    : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                        >
                            {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <main className="px-4 md:px-8 pb-10 flex-1">
                {error && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {!error && (
                    <div className="rounded-2xl border border-border/30 bg-background/40 backdrop-blur-sm overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-border/20 bg-muted/20">
                            {[
                                { label: 'Cliente', field: 'name' as SortField },
                                { label: 'Frequência', field: null },
                                { label: 'Última visita', field: null },
                                { label: 'Próxima', field: 'nextDueDate' as SortField },
                                { label: 'Status', field: 'status' as SortField },
                            ].map(col => (
                                <div
                                    key={col.label}
                                    onClick={() => col.field && toggleSort(col.field)}
                                    className={cn(
                                        "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center",
                                        col.field && "cursor-pointer select-none hover:text-foreground transition-colors"
                                    )}
                                >
                                    {col.label}
                                    {col.field && <SortIcon field={col.field} />}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {loading ? (
                            <div className="py-16 text-center text-muted-foreground text-sm">
                                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 opacity-40" />
                                Carregando…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="py-16 text-center text-muted-foreground text-sm">
                                <Wrench className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                Nenhum cliente encontrado
                            </div>
                        ) : (
                            filtered.map((client, i) => {
                                const cfg = STATUS_CONFIG[client.status];
                                const Icon = cfg.icon;
                                return (
                                    <div
                                        key={client.id}
                                        className={cn(
                                            "grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center transition-colors hover:bg-muted/10",
                                            i !== filtered.length - 1 && "border-b border-border/10"
                                        )}
                                    >
                                        {/* Cliente */}
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <span className="font-semibold text-sm truncate">{client.name}</span>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span className="font-mono">{client.clientCode}</span>
                                                {(client.city || client.state) && (
                                                    <>
                                                        <span>·</span>
                                                        <MapPin className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{[client.city, client.state].filter(Boolean).join(' - ')}</span>
                                                    </>
                                                )}
                                            </div>
                                            {client.phone && (
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                                    <Phone className="h-3 w-3" />
                                                    {client.phone}
                                                </div>
                                            )}
                                        </div>

                                        {/* Frequência */}
                                        <div className="text-sm text-muted-foreground font-medium">
                                            {client.preventiveMaintenanceFrequency === 1
                                                ? 'Mensal'
                                                : `${client.preventiveMaintenanceFrequency}m`}
                                        </div>

                                        {/* Última visita */}
                                        <div className="text-sm text-muted-foreground">
                                            {formatDate(client.lastPreventiveMaintenanceDate)}
                                        </div>

                                        {/* Próxima */}
                                        <div className="flex flex-col gap-0.5">
                                            <span className={cn("text-sm font-semibold", client.status === 'atrasado' ? 'text-red-400' : 'text-foreground')}>
                                                {formatDate(client.nextDueDate)}
                                            </span>
                                            {client.diasAtraso > 0 && (
                                                <span className="text-[10px] text-red-400 font-semibold">
                                                    {client.diasAtraso}d de atraso
                                                </span>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
                                                cfg.badge
                                            )}>
                                                <Icon className="h-3 w-3" />
                                                {cfg.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
