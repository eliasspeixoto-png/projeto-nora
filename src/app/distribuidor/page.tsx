"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getDistributorsOnce, getSuppliersOnce, addSupplier } from '@/lib/firebase/firestore';
import type { UserProfile, Supplier, SupplierData } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ShoppingBag, Navigation, Smartphone, Mail, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { getDistanceInKm, cn } from '@/lib/utils';
import ProdutosPageClient from '@/components/produtos/ProdutosPageClient';

const normalizeString = (str: any): string => {
    if (!str) return '';
    return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

function DistributorPartnersPage() {
    const { firebase, company, userProfile } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [distributors, setDistributors] = useState<UserProfile[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        if (!firebase.db) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const [partners, mySuppliers] = await Promise.all([
                getDistributorsOnce(firebase.db),
                userProfile?.companyId ? getSuppliersOnce(firebase.db, userProfile.companyId) : Promise.resolve([]),
            ]);
            setDistributors(partners);
            setSuppliers(mySuppliers);
        } finally { setIsLoading(false); }
    }, [firebase.db, userProfile?.companyId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const partnersWithDistance = useMemo(() => {
        return distributors.map(d => {
            const dist = (company?.latitude && company?.longitude && d.latitude && d.longitude)
                ? getDistanceInKm(company.latitude, company.longitude, d.latitude, d.longitude)
                : Infinity;
            return { ...d, distance: dist };
        }).sort((a, b) => a.distance - b.distance);
    }, [distributors, company]);

    const filtered = partnersWithDistance.filter(d => normalizeString(d.displayName).includes(normalizeString(searchTerm)));

    return (
        <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden overscroll-x-none min-h-screen">
            <header className="flex flex-col gap-6 px-4 md:px-8 pt-8 pb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="font-semibold tracking-tighter opacity-80 flex items-center gap-3 text-xl">
                            <ShoppingBag className="text-primary h-8 w-8" />
                            Rede de Distribuidores
                        </h1>

                    </div>
                    <div className="relative group w-full md:w-[400px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30 group-focus-within:text-primary transition-colors" />
                        <Input 
                            type="search" 
                            placeholder="Pesquisar parceiro por nome..." 
                            className="h-14 w-full rounded-2xl bg-background/40 backdrop-blur-3xl border-border/40 pl-12 font-semibold focus:bg-background transition-all shadow-premium" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>
            </header>

            <main className="px-4 md:px-8 pb-10">
                {isLoading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Mapeando rede de parceiros...</span>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filtered.map(d => (
                            <div 
                                key={d.uid} 
                                onClick={() => router.push(`/distribuidor/${d.uid}`)}
                                className="group relative bg-background/40 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-border/40 shadow-premium transition-all duration-500 hover:scale-[1.02] hover:bg-background/60 cursor-pointer overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                                
                                <div className="relative space-y-6">
                                    <div className="flex items-center gap-5">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <Avatar className="h-16 w-16 rounded-2xl border-2 border-background shadow-lg relative z-10">
                                                <AvatarImage src={d.logoUrl} className="object-cover" />
                                                <AvatarFallback className="bg-primary/10 font-semibold text-xl text-primary">{d.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold uppercase tracking-tight truncate leading-tight" style={{ color: d.nameColor }}>{d.displayName}</h3>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1 opacity-60">
                                                <MapPin className="h-3 w-3 text-primary/40" /> {d.city}, {d.state}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 rounded-2xl bg-primary/5 border border-border/40">
                                            <span className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-40 flex items-center gap-2">
                                                <Navigation className="h-3 w-3" /> Distância
                                            </span>
                                            <span className="text-[11px] font-semibold tracking-tight text-primary">
                                                {isFinite(d.distance) ? `${d.distance.toFixed(1)} KM` : 'COORD. INDISP.'}
                                            </span>
                                        </div>

                                        <div className="grid gap-2 px-1">
                                            <div className="flex items-center gap-3 text-[10px] font-semibold opacity-60 group-hover:opacity-100 transition-opacity truncate">
                                                <div className="h-6 w-6 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                                                    <Mail className="h-3 w-3 text-primary" />
                                                </div>
                                                {d.email}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] font-semibold opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="h-6 w-6 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                                                    <Smartphone className="h-3 w-3 text-primary" />
                                                </div>
                                                {d.whatsapp || d.phone || 'S/ CONTATO'}
                                            </div>
                                        </div>
                                    </div>

                                    <Button 
                                        className={cn(
                                            "w-full h-12 rounded-2xl font-semibold uppercase text-[9px] tracking-widest transition-all shadow-lg",
                                            suppliers.some(s => s.distributorUid === d.uid) 
                                                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none pointer-events-none" 
                                                : "bg-primary text-white hover:scale-[1.03] active:scale-95"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (suppliers.some(s => s.distributorUid === d.uid)) return;
                                            addSupplier(firebase.db, { name: d.displayName, email: d.email, phone: d.phone, companyId: userProfile!.companyId, distributorUid: d.uid } as any);
                                            toast({ title: 'Parceiro Adicionado!', description: `${d.displayName} agora é seu fornecedor oficial.` });
                                            fetchData();
                                        }}
                                    >
                                        {suppliers.some(s => s.distributorUid === d.uid) ? 'COOPERADO' : 'HOMOLOGAR PARCEIRO'}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function DistributorPage() {
    const { userProfile, loading } = useAuth();
    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    return userProfile?.role === 'distribuidor' ? <ProdutosPageClient showOnlyPromotions={true} /> : <DistributorPartnersPage />;
}
