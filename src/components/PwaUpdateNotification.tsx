
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { RefreshCw, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * @fileOverview Componente de detecção de atualizações do PWA.
 * Monitora o Service Worker e avisa o usuário quando uma nova versão (incluindo ícones e lógica)
 * está disponível para ser instalada.
 */

const PwaUpdateNotification = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Registra o Service Worker e monitora mudanças
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration) return;

        // 1. Verifica se já existe uma atualização esperando
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowDialog(true);
        }

        // 2. Escuta quando uma nova versão termina de baixar
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowDialog(true);
              }
            });
          }
        });
      }).catch(() => {});

      // 3. Recarrega a página automaticamente quando a nova versão assumir o controle
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  // Força a checagem de nova versão sempre que o usuário muda de rota (ex: login -> dashboard)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update().catch(() => {});
        }
      }).catch(() => {});
    }
  }, [pathname]);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Envia comando para a nova versão ignorar a espera e ativar agora
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setShowDialog(false);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md border-primary/20 shadow-glow-primary bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Zap className="h-5 w-5 animate-pulse" />
            Nova Versão da Plataforma!
          </DialogTitle>
          <DialogDescription className="text-foreground pt-2">
            Acabamos de lançar melhorias no sistema (incluindo atualizações de ícone e áudio). 
            Deseja atualizar agora para garantir o funcionamento perfeito no seu celular?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleUpdate} className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PwaUpdateNotification;
