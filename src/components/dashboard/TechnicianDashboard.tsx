
"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import type { Quote, Visit, UserProfile } from "@/lib/data";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/auth/use-user";
import { getQuotes, getVisits } from "@/lib/firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, Construction, CheckCircle, Hourglass, Loader2, Sparkles, TrendingUp } from "lucide-react";
import ActiveTasks from "./ActiveTasks";
import CompletedTasks from "./CompletedTasks";
import { useSidebar } from "@/components/ui/sidebar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";

const StatCard = ({ title, value, icon: Icon, color, onClick, description }: { title: string, value: string | number, icon: React.ElementType, color: string, onClick?: () => void, description?: string }) => {
    return (
        <Card 
            className="border-border/40 bg-background/50 backdrop-blur-sm shadow-xl hover:bg-primary/5 transition-all duration-300 cursor-pointer group" 
            onClick={onClick}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-[10px] font-semibold tracking-widest text-muted-foreground">{title}</CardTitle>
                <Icon className="h-4 w-4 transition-transform group-hover:scale-110" style={{ color }} />
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-lg sm:text-xl font-semibold tracking-tight">{value}</div>
                {description && <p className="text-[10px] text-muted-foreground mt-1 font-medium">{description}</p>}
            </CardContent>
        </Card>
    );
};


export default function TechnicianDashboard() {
    const router = useRouter();
    const { userProfile, firebase } = useAuth();
    const { setUnseenTasksCount } = useSidebar();
    const { toast } = useToast();
    const [serviceOrders, setServiceOrders] = useState<Quote[]>([]);
    const [allTechQuotes, setAllTechQuotes] = useState<Quote[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);

    const checkAndRequestLocationPermission = useCallback(async () => {
        if (!navigator.permissions) return;
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
            if (permissionStatus.state === 'prompt') {
                setShowLocationPrompt(true);
            }
        } catch (e) {
            console.error("Error checking geolocation permission:", e);
        }
    }, []);

    useEffect(() => {
      if (!userProfile || !userProfile.companyId || !firebase.db) {
        setIsLoading(false);
        return;
      }
      
      checkAndRequestLocationPermission();

      const osStatus: Quote['status'][] = ['Pendente', 'Atribuída', 'Em Execução', 'Agendado', 'revision-pending'];
      
      const unsubOS = getQuotes(firebase.db, userProfile.companyId, userProfile!, (allQuotes) => {
          const techQuotes = allQuotes.filter(q => q.assignedTechnicianId === userProfile!.uid);
          setAllTechQuotes(techQuotes);
          
          const relevantOS = techQuotes.filter(q => osStatus.includes(q.status));
          setServiceOrders(relevantOS);
      }, console.error);

      const unsubVisits = getVisits(firebase.db, userProfile.companyId, userProfile!, (allVisits) => {
          const relevantVisits = allVisits.filter(v => v.technicianId === userProfile!.uid);
          setVisits(relevantVisits);
      }, console.error);

      setIsLoading(false);
      
      return () => {
        unsubOS();
        unsubVisits();
      };
    }, [userProfile, firebase.db, checkAndRequestLocationPermission]);

    const handleLocationPermissionRequest = () => {
        setShowLocationPrompt(false);
        navigator.geolocation.getCurrentPosition(
            () => {
                toast({ title: "Obrigado!", description: "Permissão de localização concedida." });
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    toast({
                        variant: "destructive",
                        title: "Permissão Negada",
                        description: "Você pode reativar a permissão nas configurações do seu navegador."
                    });
                }
            }
        );
    };

    const stats = useMemo(() => {
        const assignedCount = serviceOrders.filter(os => os.status === 'Atribuída').length + visits.filter(v => v.status === 'Atribuída').length;
        setUnseenTasksCount(assignedCount);

        const finishedCount = allTechQuotes.filter(q => q.status === 'Finalizado').length;
        const totalCount = allTechQuotes.length;
        const efficiency = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 100;

        return {
            assigned: assignedCount,
            inExecution: serviceOrders.filter(os => os.status === 'Em Execução').length,
            pending: serviceOrders.filter(os => os.status === 'Pendente').length,
            efficiency
        };
    }, [serviceOrders, visits, allTechQuotes, setUnseenTasksCount]);

    if (isLoading) {
      return (
        <div className="flex h-full flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    return (
        <div className="flex-1 space-y-6 pb-10">
            <div className="space-y-0.5">
                <h1 className="text-xl font-semibold tracking-tighter flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                    Meu Painel Técnico
                </h1>
                <p className="text-[12px] text-muted-foreground font-medium">Foco total na execução. Aqui está o resumo das suas atividades.</p>
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="Atribuídas" 
                    value={stats.assigned} 
                    icon={UserCheck} 
                    color="hsl(var(--chart-4))" 
                    description="Novas ordens de serviço"
                    onClick={() => router.push('/minhas-os')} 
                />
                <StatCard 
                    title="Em Execução" 
                    value={stats.inExecution} 
                    icon={Construction} 
                    color="hsl(var(--chart-2))" 
                    description="Trabalho em andamento"
                    onClick={() => router.push('/minhas-os')} 
                />
                <StatCard 
                    title="Pendentes Agendar" 
                    value={stats.pending} 
                    icon={Hourglass} 
                    color="hsl(var(--chart-5))" 
                    description="Aguardando contato"
                    onClick={() => router.push('/ordem-de-servico')} 
                />
                <StatCard 
                    title="Eficiência" 
                    value={`${stats.efficiency}%`} 
                    icon={TrendingUp} 
                    color="hsl(var(--chart-1))" 
                    description="Taxa de conclusão total"
                />
            </div>
            
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
                    <CheckCircle className="h-4 w-4" /> Histórico de Conclusão
                </div>
                <CompletedTasks serviceOrders={serviceOrders} visits={visits} userProfile={userProfile} />
            </div>

            <AlertDialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
                <AlertDialogContent className="border-border/40 bg-background/80 backdrop-blur-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Permitir Localização?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Para usar o mapa da equipe e outras funcionalidades, o sistema precisa da sua permissão para acessar sua localização em segundo plano. Seus dados de localização são visíveis apenas para os administradores da sua empresa.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-border/40">Agora não</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLocationPermissionRequest} className="bg-primary hover:bg-primary/90">Sim, permitir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
