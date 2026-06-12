'use client';

import { usePathname } from "next/navigation";
import { SidebarWrapper } from "@/components/layout/SidebarWrapper";
import UserLocationTracker from "@/components/layout/UserLocationTracker";
import GlobalPermissionHandler from "@/components/layout/GlobalPermissionHandler";
import PwaUpdateNotification from "@/components/PwaUpdateNotification";
import IosInstallPrompt from "@/components/IosInstallPrompt";
import { useAuth } from "@/firebase/auth/use-user";
import { Loader2 } from "lucide-react";
import { canAccessPage, allMenuItems } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const publicPaths = ['/login', '/signup', '/forgot-password', '/planos'];
const publicPrefixes = ['/orcamentos/view/', '/recibo/view/', '/definir-senha', '/cliente/definir-senha'];

// Pré-ordenar itens do menu para matching de rota mais eficiente (do mais específico para o menos específico)
const sortedMenuItems = [...allMenuItems].sort((a, b) => b.href.length - a.href.length);

export function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, userProfile, company } = useAuth();
  const router = useRouter();

  const isPublicPage =
    publicPaths.includes(pathname ?? '') ||
    publicPrefixes.some((prefix) => (pathname ?? '').startsWith(prefix));

  const isCftvPage = pathname === '/orcamentos/cameras';
  const isMapPage = pathname === '/equipe';

  useEffect(() => {
    if (!loading && userProfile && !isPublicPage) {
      const currentMenuItem = sortedMenuItems.find(item => item.href !== '/' && (pathname ?? '').startsWith(item.href));
      const pageKey = currentMenuItem ? currentMenuItem.page : (pathname ?? '').substring(1).split('/')[0];

      if (!pageKey) return;

      let hasAccess = canAccessPage(userProfile.role, pageKey, company);

      // Exceção: Permitir a execução de O.S. para usuários que têm acesso a "Minhas Tarefas" (como os técnicos)
      if ((pathname ?? '').startsWith('/ordem-de-servico/executar/') && canAccessPage(userProfile.role, 'minhas-os', company)) {
        hasAccess = true;
      }

      if (!hasAccess) {
        router.replace('/dashboard');
      }
    }
  }, [loading, userProfile, company, pathname, isPublicPage, router]);


  // Removemos o bloqueio de carregamento total para que a transição entre páginas seja instantânea.
  // O estado 'loading' agora é gerenciado internamente pelas páginas (ex: DashboardSkeleton).

  if (isPublicPage) {
    return (
      <div className="h-full w-full overflow-x-hidden">
        <PwaUpdateNotification />
        <IosInstallPrompt />
        {children}
      </div>
    );
  }

  return (
    <SidebarWrapper>
      <PwaUpdateNotification />
      <IosInstallPrompt />
      <GlobalPermissionHandler />
      <UserLocationTracker />
      <div className={cn(
        "flex-1 bg-background max-w-full overflow-x-hidden overflow-y-auto premium-scrollbar pb-32 px-4 sm:px-6 lg:px-8",
        (isCftvPage || isMapPage) && "p-0 overflow-y-hidden pb-0"
      )}>
        {children}
      </div>
    </SidebarWrapper>
  );
}
