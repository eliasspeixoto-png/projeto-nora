"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardSkeleton() {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1750px] mx-auto overflow-x-hidden bg-background/50">
            {/* Hero Skeleton (PremiumHero) - Ajustado para ser mais compacto e sofisticado */}
            <div className="relative h-[160px] w-full rounded-2xl bg-muted/5 animate-pulse overflow-hidden border border-border/20 shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.03] to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                <div className="p-6 md:p-8 space-y-4">
                    <Skeleton className="h-10 w-1/3 bg-muted/20" />
                    <Skeleton className="h-4 w-1/4 bg-muted/10" />
                </div>
            </div>

            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="space-y-3">
                    <Skeleton className="h-7 w-56 bg-muted/20" />
                    <Skeleton className="h-3 w-40 bg-muted/10" />
                </div>
                <div className="hidden md:block">
                    <Skeleton className="h-10 w-32 rounded-xl bg-muted/20" />
                </div>
            </div>

            {/* Modern KPIs Grid - Mais fiel ao ModernKPIs.tsx */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="glass-premium border-border/30 bg-background/40 relative overflow-hidden h-28">
                        <CardContent className="p-4 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-start">
                                <Skeleton className="h-4 w-1/2 bg-muted/20" />
                                <Skeleton className="h-8 w-8 rounded-lg bg-primary/5" />
                            </div>
                            <Skeleton className="h-7 w-2/3 bg-muted/30" />
                            <Skeleton className="h-1.5 w-full rounded-full bg-muted/10" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Section (MainPulse mimicking) */}
            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 glass-premium border-border/30 bg-background/40 min-h-[400px]">
                    <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-48 bg-muted/20" />
                        <Skeleton className="h-3 w-64 bg-muted/10 mt-1" />
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-end gap-3 px-6 pb-6">
                        {[...Array(12)].map((_, i) => (
                            <Skeleton 
                                key={i} 
                                className="w-full rounded-t-md bg-muted/20" 
                                style={{ 
                                    height: `${[40, 60, 45, 70, 50, 80, 55, 65, 40, 75, 50, 85][i]}%`,
                                    opacity: 0.3 + (i * 0.05)
                                }}
                            />
                        ))}
                    </CardContent>
                </Card>
                <Card className="glass-premium border-border/30 bg-background/40 min-h-[400px]">
                    <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-40 bg-muted/20" />
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-[300px] gap-8">
                        <div className="relative w-40 h-40 rounded-full border-[6px] border-muted/10 flex items-center justify-center">
                            <div className="w-28 h-28 rounded-full border-[6px] border-muted/5 border-t-primary/20 animate-spin" />
                        </div>
                        <div className="w-full space-y-3">
                            <Skeleton className="h-4 w-full bg-muted/20" />
                            <Skeleton className="h-4 w-3/4 bg-muted/10 mx-auto" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Operational Intelligence */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass-premium border-border/30 bg-background/40 h-64">
                    <CardContent className="p-6 space-y-5">
                        <Skeleton className="h-6 w-40 bg-muted/20 mb-2" />
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-xl bg-muted/20" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-2/3 bg-muted/20" />
                                    <Skeleton className="h-3 w-1/3 bg-muted/10" />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card className="glass-premium border-border/30 bg-background/40 h-64">
                    <CardContent className="p-6 space-y-4">
                        <Skeleton className="h-6 w-40 bg-muted/20" />
                        <div className="flex-1 bg-muted/5 rounded-xl border border-dashed border-border/40 h-32 flex items-center justify-center">
                            <Skeleton className="h-8 w-1/3 bg-muted/10" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
