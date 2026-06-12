"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// Define a interface para o evento 'beforeinstallprompt'
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallContextType {
  canInstall: boolean;
  installPrompt: () => void;
}

const PWAInstallContext = createContext<PWAInstallContextType | undefined>(undefined);


export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Previne o mini-infobar padrão do Chrome em alguns cenários
      event.preventDefault();
      // Guarda o evento para que possa ser acionado mais tarde.
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    
    // O evento 'beforeinstallprompt' é disparado quando o navegador
    // determina que o PWA é instalável.
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Limpa o listener quando o componente é desmontado
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  const installPrompt = () => {
    if (!installEvent) {
      // Se não houver evento de instalação, não faz nada
      return;
    }
    // Mostra o prompt de instalação do navegador
    installEvent.prompt();
    
    // Espera o usuário responder ao prompt
    installEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      // O evento só pode ser usado uma vez, então limpamos o estado
      setInstallEvent(null);
    });
  };

  return (
    <PWAInstallContext.Provider value={{ canInstall: !!installEvent, installPrompt }}>
        {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);
  if (context === undefined) {
    throw new Error('usePWAInstall must be used within a PWAInstallProvider');
  }
  return context;
}
