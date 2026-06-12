
"use client";

import { useState, useEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientToaster } from "@/components/ui/client-toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import FirebaseErrorListener from "@/components/FirebaseErrorListener";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PWAInstallProvider } from "@/hooks/use-pwa-install";
import { AppLayoutContent } from "./layout/AppLayoutContent";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";

import { DataProvider } from "@/providers/data-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de cache para listas
      gcTime: 1000 * 60 * 15,    // 15 minutos de garbage collection
      refetchOnWindowFocus: false, // Desativado conforme solicitado
    },
  },
});

// Configuração de Persistência no Navegador
if (typeof window !== 'undefined') {
  const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
  });

  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    maxAge: 1000 * 60 * 60 * 24, // Manter cache por 24h
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseClientProvider>
        <PWAInstallProvider>
          <ThemeProvider
              attribute="class"
              defaultTheme="medium"
              disableTransitionOnChange
              themes={["light", "dark", "medium"]}
          >
              <FirebaseErrorListener />
              <PushNotificationManager />
              <DataProvider>
                <SidebarProvider>
                    <AppLayoutContent>
                      {children}
                    </AppLayoutContent>
                </SidebarProvider>
              </DataProvider>
              <ClientToaster />
          </ThemeProvider>
        </PWAInstallProvider>
      </FirebaseClientProvider>
    </QueryClientProvider>
  );
}
