"use client";

import { useAuth } from '@/firebase/auth/use-user';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireRole 
}: { 
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRole?: 'admin' | 'cliente' | 'tecnico' | 'supervisor' | 'surveyor';
}) {
  const { user, userProfile, loading, isSubscriptionExpired } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Esperar até que o estado de auth esteja definitivamente resolvido
    if (loading) return;

    // Se auth é necessária e não há usuário, redirecionar para login.
    if (requireAuth && !user) {
      router.push('/login');
      return;
    }
    
    // Se auth NÃO é necessária (ex: página de login) e o usuário está logado, redirecionar para o dashboard.
    if (!requireAuth && user && userProfile) {
      const destination = userProfile.role === 'cliente' ? '/cliente/dashboard' : '/dashboard';
      router.push(destination);
      return;
    }
    
    // Se o usuário está logado, verificar mudança de senha forçada.
    if (user && userProfile?.forcePasswordChange) {
      const path = userProfile.role === 'cliente' ? '/cliente/definir-senha' : '/definir-senha';
      if (pathname !== path) {
        router.push(path);
      }
      return;
    }
    
    // Se uma role específica é necessária e a role do usuário não corresponde, redirecionar.
    if (requireRole && userProfile && userProfile.role !== requireRole) {
      router.push('/dashboard');
      return;
    }
  }, [user, userProfile, loading, router, requireAuth, requireRole, pathname, isSubscriptionExpired]);
  

  // Mostrar loader APENAS quando realmente precisamos esperar e NÃO temos dados cacheados.
  // Se temos userProfile do cache (mesmo antes do loading terminar), renderizamos o conteúdo.
  const needsRedirect = 
    (requireAuth && !user && !userProfile) || 
    (!requireAuth && user && !userProfile) || 
    (requireRole && userProfile && userProfile.role !== requireRole);

  if (loading && needsRedirect) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Verificando acesso...</p>
      </div>
    );
  }

  // If all checks pass, render the children in a centered container for auth pages.
  if (!requireAuth) {
    // Se loading terminou e o usuário está logado, não renderizar o form de login (redirecionamento está ocorrendo)
    if (!loading && user && userProfile) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-background p-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="ml-2">Redirecionando...</p>
        </div>
      );
    }
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            {children}
        </div>
    );
  }

  // Para páginas protegidas com dados em cache, renderizar imediatamente
  if (userProfile) {
    return <>{children}</>;
  }

  // Fallback: sem dados de cache e sem user, mostrar loader
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="ml-2">Verificando acesso...</p>
    </div>
  );
}
