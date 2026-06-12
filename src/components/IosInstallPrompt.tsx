
'use client';

import { useState, useEffect } from 'react';
import { Share, Upload, X } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @fileOverview Guia visual para instalação do PWA no iOS.
 * Detecta se o dispositivo é Apple e se o app ainda não está instalado.
 */

export default function IosInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. Verifica se é iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // 2. Verifica se já está rodando como "standalone" (instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    // 3. Só mostra se for iOS e não estiver instalado
    if (isIos && !isStandalone) {
      // Pequeno delay para não assustar o usuário assim que a página abre
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-4 right-4 z-[60] no-print"
      >
        <div className="bg-card border-2 border-primary/20 shadow-2xl rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          
          <button 
            onClick={() => setShowPrompt(false)}
            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col gap-2 p-1">
            <h4 className="font-bold text-base text-center">Instalar NORA Pro no iPhone</h4>
            <p className="text-sm text-center text-muted-foreground leading-relaxed mt-1">
              Este aviso <strong>não é um botão</strong>. <br/><br/>
              Para instalar, você precisa usar o menu do próprio iPhone:
              <br/>
              1. Toque no ícone <span className="inline-flex items-center justify-center bg-muted p-1 rounded mx-1"><Upload className="h-4 w-4 text-blue-500" /></span> (Compartilhar) lá na barra inferior do seu Safari.
              <br/>
              2. Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          </div>
          
          {/* Seta indicativa BEM GRANDE para o botão de compartilhar do Safari */}
          <div className="flex flex-col items-center justify-center mt-3 animate-bounce">
            <span className="text-xs font-bold text-primary mb-1 uppercase tracking-widest">O Botão fica aqui embaixo</span>
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-primary" />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
