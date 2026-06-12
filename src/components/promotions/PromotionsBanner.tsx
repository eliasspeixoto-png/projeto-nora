'use client';

import { useState, useEffect, useMemo } from 'react';
import { getDistributors, addDistributorClick } from '@/lib/firebase/firestore'; 
import type { UserProfile } from '@/lib/data';
import Image from 'next/image';
import { useAuth } from '@/firebase/auth/use-user';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDistanceInKm } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function PromotionsBanner() {
    const [distributors, setDistributors] = useState<UserProfile[]>([]);
    const { userProfile, firebase, company } = useAuth();
    const { state: sidebarState, isMobile } = useSidebar();
    const router = useRouter();
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        if (firebase.db) {
            const unsubDistributors = getDistributors(firebase.db, setDistributors, (error) => {
                console.error("Failed to load distributors for banner:", error);
            });

            return () => {
                unsubDistributors();
            };
        }
    }, [firebase.db]);

    const filteredDistributors = useMemo(() => {
        if (!company) {
            return [];
        }

        const hasCompanyCoords = company.latitude && company.longitude;
        const RADIUS_KM = 100;

        return distributors.filter(distributor => {
            if (hasCompanyCoords && distributor.latitude && distributor.longitude) {
                const distance = getDistanceInKm(company.latitude!, company.longitude!, distributor.latitude!, distributor.longitude!);
                return distance <= RADIUS_KM;
            }
            
            if (company.state && distributor.state) {
                return distributor.state === company.state;
            }

            return false;
        });
    }, [distributors, company]);

    if (!userProfile || userProfile.role !== 'admin' || filteredDistributors.length === 0) {
        return null;
    }
    
    const bannerClasses = cn(
        "fixed bottom-4 z-40 print:hidden transition-all duration-300 ease-in-out",
        isMobile
            ? "left-4 right-4"
            : sidebarState === 'expanded' ? "left-[calc(var(--sidebar-width)_+_1rem)]" : "left-[calc(var(--sidebar-width-icon)_+_1rem)]",
        "right-4"
    );


    const handleClick = (e: React.MouseEvent, distributorId: string) => {
        e.preventDefault();
        if (userProfile?.companyId && company?.name) {
            addDistributorClick(firebase.db, {
                distributorId: distributorId,
                timestamp: new Date().toISOString(),
                clickedByCompanyId: userProfile.companyId,
                clickedByCompanyName: company.name
            });
        }
        router.push(`/distribuidor/${distributorId}`);
    };
    
    const handleToggleMinimize = () => {
        setIsMinimized(prev => !prev);
    };
    
    const duplicatedDistributors = filteredDistributors.length > 2 ? [...filteredDistributors, ...filteredDistributors] : filteredDistributors;

    return (
        <div className={bannerClasses}>
            <div className={cn(
                "relative w-full overflow-hidden group pb-2 transition-all duration-300",
                isMinimized && "w-1/2"
            )}>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-0 right-0 z-10 h-8 w-8 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                    onClick={handleToggleMinimize}
                    aria-label={isMinimized ? "Expandir banner" : "Recolher banner"}
                >
                    {isMinimized ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
                </Button>
                
                <div className={cn(
                    "flex gap-2",
                    !isMinimized && duplicatedDistributors.length > filteredDistributors.length && "animate-scroll-x [animation-play-state:running] group-hover:[animation-play-state:paused]"
                )}>
                    {duplicatedDistributors.map((distributor, index) => (
                        <div 
                            key={`${distributor.uid}-${index}`}
                            onClick={(e) => handleClick(e, distributor.uid)}
                            className={cn(
                                "border border-border p-0.5 rounded-lg shadow-lg flex items-center gap-2 w-80 flex-shrink-0 hover:border-primary transition-all cursor-pointer",
                                distributor.displayName?.toLowerCase().includes('ppa') ? 'bg-[#FF8C00]/50' : 'bg-[#87C984]/50'
                            )}
                        >
                            {distributor.logoUrl && (
                                <div className="relative w-10 h-10 flex-shrink-0">
                                    <Image src={distributor.logoUrl} alt={distributor.displayName} fill style={{ objectFit: 'contain' }} sizes="40px"/>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p 
                                    className="text-sm font-semibold truncate transition-colors" 
                                    title={distributor.displayName}
                                    style={{ color: distributor.nameColor || 'hsl(var(--foreground))' }}
                                >
                                    {distributor.displayName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Clique aqui e conheça nossas promoções e produtos!
                                    <ArrowRight className="inline-block ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
