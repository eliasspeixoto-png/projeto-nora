
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { getDistributorById } from '@/lib/firebase/firestore'; 
import type { UserProfile } from '@/lib/data';
import { Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProdutosPageClient from '@/components/produtos/ProdutosPageClient';

export default function DistributorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const distributorId = (params as any)?.id as string;
    const { firebase } = useAuth();
    
    const [distributor, setDistributor] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!distributorId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const distData = await getDistributorById(firebase.db, distributorId);
                setDistributor(distData);

            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [distributorId, firebase.db]);

    if (isLoading) {
        return <div className="flex h-full flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!distributor) {
        return <div className="flex h-full flex-1 items-center justify-center"><p>Distribuidor não encontrado.</p></div>;
    }

    const phones = [distributor.phone, distributor.whatsapp].filter(Boolean).join(' - ');

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {distributor.logoUrl && (
                        <div className="relative w-24 h-20">
                            <Image src={distributor.logoUrl} alt={distributor.displayName} fill style={{objectFit: 'contain'}} sizes="96px" />
                        </div>
                    )}
                    <div>
                        <h1 className="font-semibold text-xl" style={{color: distributor.nameColor || 'hsl(var(--foreground))'}}>{distributor.displayName}</h1>
                        {phones && <p className="text-muted-foreground">{phones}</p>}
                    </div>
                </div>
                <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2"/> Voltar</Button>
            </div>
            
            <Tabs defaultValue="promotions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="promotions">Promoções</TabsTrigger>
                  <TabsTrigger value="products">Catálogo de Produtos</TabsTrigger>
              </TabsList>
              <TabsContent value="promotions" className="mt-4">
                  <ProdutosPageClient showOnlyPromotions={true} companyId={distributor.companyId} distributorName={distributor.displayName} />
              </TabsContent>
              <TabsContent value="products" className="mt-4">
                  <ProdutosPageClient companyId={distributor.companyId} distributorName={distributor.displayName} />
              </TabsContent>
            </Tabs>
        </div>
    );
}
