"use client";

import { useEffect } from "react";
import { useAuth } from "@/firebase/auth/use-user";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import TechnicianDashboard from "@/components/dashboard/TechnicianDashboard";
import DeveloperDashboard from "@/components/dashboard/DeveloperDashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import BuyerDashboard from "@/components/dashboard/BuyerDashboard";
import DistributorDashboard from "@/components/dashboard/DistributorDashboard";
import { Loader2 } from "lucide-react";
import SalespersonDashboard from "@/components/dashboard/SalespersonDashboard";

export default function DashboardPage() {
  const { userProfile, isDeveloper, loading } = useAuth();
 
  useEffect(() => {
    if (!loading && userProfile?.role === 'cliente') {
      window.location.href = '/cliente/dashboard';
    }
  }, [userProfile, loading]);
  
  const renderDashboard = () => {
    if (loading || !userProfile) {
      return (
        <div className="flex h-[80vh] w-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
        </div>
      );
    }
    
    if (userProfile.role === 'cliente') {
        return (
          <div className="flex h-full flex-1 items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin" />
             <span className="ml-2 text-sm">Redirecionando...</span>
          </div>
        );
    }

    if (isDeveloper && !userProfile?.companyId) {
      return <DeveloperDashboard />;
    }
    
    switch (userProfile.role) {
      case 'admin':
      case 'supervisor':
        return <AdminDashboard />;
      case 'tecnico':
        return <TechnicianDashboard />;
      case 'comprador':
        return <BuyerDashboard />;
      case 'distribuidor':
        return <DistributorDashboard />;
      case 'vendedor':
        return <SalespersonDashboard />;
      default:
        return (
          <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
             <p>Seu perfil não possui um painel configurado.</p>
          </div>
        );
    }
  };

  return (
    <ProtectedRoute requireAuth>
       {renderDashboard()}
    </ProtectedRoute>
  );
}
