'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { RefreshCw, Zap, Sparkles } from 'lucide-react';

/**
 * @fileOverview Componente de detecção ultra-rápida de atualizações do PWA e deploys.
 * Monitora o Service Worker, rotas, foco da janela, retorno do app e API de versão em tempo real.
 */

const LOCAL_BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || '';

const PwaUpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const pathname = usePathname();
  const checkingRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  // Executa atualização imediata e limpa caches desatualizados
  const applyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      // Tentar pular espera do SW (assíncrono sem travar)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }).catch(console.warn);
      }

      // Tentar limpar caches (assíncrono sem travar)
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames
              .filter((name) => !name.includes('google-fonts'))
              .map((name) => caches.delete(name))
          );
        }).catch(console.warn);
      }
    } finally {
      // Pequeno atraso para dar tempo ao SW de receber a mensagem, e forçar reload
      setTimeout(() => {
        window.location.href = window.location.pathname + '?v=' + new Date().getTime();
      }, 300);
    }
  }, [isUpdating]);

  // Função para verificar se há nova versão disponível no servidor
  const checkForUpdates = useCallback(async () => {
    if (checkingRef.current || hasTriggeredRef.current) return;
    checkingRef.current = true;

    try {
      // 1. Checagem via Service Worker
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            setUpdateAvailable(true);
            hasTriggeredRef.current = true;
            return;
          }
          await registration.update().catch(() => {});
        }
      }

      // 2. Checagem via API de Versão (tempo real independente de SW)
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.buildTime && LOCAL_BUILD_TIME && data.buildTime !== LOCAL_BUILD_TIME) {
          console.log('⚡ Nova versão de deploy detectada:', data.buildTime, 'vs', LOCAL_BUILD_TIME);
          setUpdateAvailable(true);
          hasTriggeredRef.current = true;
        }
      }
    } catch (e) {
      // Falha silenciosa de rede
    } finally {
      checkingRef.current = false;
    }
  }, []);

  // Monitoramento contínuo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    // 1. Listener de Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration) return;

        if (registration.waiting) {
          setUpdateAvailable(true);
          hasTriggeredRef.current = true;
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                setUpdateAvailable(true);
                hasTriggeredRef.current = true;
              }
            });
          }
        });
      }).catch(() => {});

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // 2. Checagem imediata ao montar
    checkForUpdates();

    // 3. Checagem ao focar na aba ou voltar para o app no celular
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // 4. Heartbeat rápido a cada 30 segundos
    const interval = setInterval(checkForUpdates, 30000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  // Checar também a cada mudança de rota
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    checkForUpdates();
  }, [pathname, checkForUpdates]);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl border border-primary-foreground/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="font-bold text-sm leading-tight flex items-center gap-1.5 text-white">
              Nova versão disponível! <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            </h4>
            <p className="text-xs text-white/80 leading-snug mt-0.5">
              Atualização pronta com novas melhorias.
            </p>
          </div>
        </div>
        <Button
          onClick={applyUpdate}
          disabled={isUpdating}
          size="sm"
          className="bg-white text-primary hover:bg-white/90 font-semibold shadow-md shrink-0 h-9 px-3.5"
        >
          {isUpdating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <span className="flex items-center gap-1 text-xs">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Atualizar
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PwaUpdateNotification;
