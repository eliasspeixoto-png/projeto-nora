
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/firebase/auth/use-user';
import { getDistributorsOnce, addDistributorClick } from '@/lib/firebase/firestore'; 
import type { UserProfile } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDistanceInKm } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function PartnerDistributors() {
    const [distributors, setDistributors] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { firebase, userProfile, company } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (firebase.db) {
            getDistributorsOnce(firebase.db)
                .then(data => {
                    setDistributors(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load distributors for banner:", err);
                    setIsLoading(false);
                });
        }
    }, [firebase.db]);

    const filteredDistributors = useMemo(() => {
        if (!company) {
            return [];
        }

        const hasCompanyCoords = company.latitude && company.longitude;
        const RADIUS_KM = 80;

        return distributors.filter(distributor => {
            if (hasCompanyCoords && distributor.latitude && distributor.longitude) {
                const distance = getDistanceInKm(company.latitude!, company.longitude!, distributor.latitude!, distributor.longitude!);
                return distance <= RADIUS_KM;
            }
            
            if (company.state && distributor.state) {
                return distributor.state.toLowerCase() === company.state.toLowerCase();
            }

            return false;
        }).sort((a, b) => {
            if (hasCompanyCoords && a.latitude && a.longitude && b.latitude && b.longitude) {
                const distA = getDistanceInKm(company.latitude!, company.longitude!, a.latitude, a.longitude);
                const distB = getDistanceInKm(company.latitude!, company.longitude!, b.latitude, b.longitude);
                return distA - distB;
            }
            return a.displayName.localeCompare(b.displayName);
        });
    }, [distributors, company]);

    const handleClick = (e: React.MouseEvent, distributorId: string) => {
        e.preventDefault();
        if (userProfile?.companyId && company?.name && firebase.db) {
            addDistributorClick(firebase.db, {
                distributorId: distributorId,
                timestamp: new Date().toISOString(),
                clickedByCompanyId: userProfile.companyId,
                clickedByCompanyName: company.name,
            });
        }
        router.push(`/distribuidor/${distributorId}`);
    };
    
    if (isLoading) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-center overflow-hidden">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-32 flex-shrink-0" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (!userProfile || !['admin', 'supervisor', 'comprador'].includes(userProfile.role) || filteredDistributors.length === 0) {
        return null; 
    }

    return (
        <Card className="w-full overflow-hidden border-border/40 bg-background/50 backdrop-blur-sm shadow-premium">
            <CardContent className="p-0 px-4 md:px-6">
                <div className="relative w-full group py-4">
                    <div className="flex gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth">
                        {filteredDistributors.map((distributor, index) => (
                             <div className="snap-start flex-shrink-0" key={`${distributor.uid}-${index}`}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Link 
                                                href={`/distribuidor/${distributor.uid}`} 
                                                onClick={(e) => handleClick(e, distributor.uid)} 
                                                className="relative block h-12 w-24 md:h-16 md:w-32 transition-transform hover:scale-110 active:scale-95 duration-300 group"
                                            >
                                                <Image 
                                                    src={distributor.logoUrl || 'https://picsum.photos/seed/placeholder/200'} 
                                                    alt={`Logo ${distributor.displayName}`}
                                                    fill
                                                    sizes="(max-width: 768px) 96px, 128px"
                                                    style={{ objectFit: 'contain' }}
                                                    className="p-1 drop-shadow-sm transition-all duration-300 group-hover:grayscale group-hover:opacity-60"
                                                />
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="bg-background/90 backdrop-blur-md border-border/40">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest">{distributor.displayName}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
            {filteredDistributors.length > 4 && (
                 <CardFooter className="p-4 pt-0 md:p-6 md:pt-0">
                    <Button variant="ghost" size="sm" className="ml-auto text-[10px] font-semibold uppercase tracking-widest hover:bg-primary/5" asChild>
                        <Link href="/distribuidor">
                            Ver todos <ArrowRight className="ml-2 h-3 w-3" />
                        </Link>
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}
