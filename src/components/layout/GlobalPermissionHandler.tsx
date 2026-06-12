'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Camera, Mic, MapPin, Bell, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function GlobalPermissionHandler() {
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const checkPermissions = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.permissions) return;

    // Se o usuário escolheu ver "Depois" nesta sessão, não abrimos de novo até recarregar/nova sessão
    const hasSkippedThisSession = sessionStorage.getItem('nora_permissions_later');
    if (hasSkippedThisSession) return;

    // Trava de segurança: Se o usuário já interagiu com este popup de forma permanente, não abre de novo
    const hasInteracted = localStorage.getItem('nora_permissions_prompted');
    if (hasInteracted) return;

    try {
      // Verifica status das permissões críticas
      const [geoStatus, micStatus, camStatus] = await Promise.all([
        navigator.permissions.query({ name: 'geolocation' }),
        navigator.permissions.query({ name: 'microphone' as any }),
        navigator.permissions.query({ name: 'camera' as any }),
      ]);

      // Notificações (Sons e Alertas)
      let notifyStatus = { state: 'granted' };
      if ("Notification" in window) {
        notifyStatus = await navigator.permissions.query({ name: 'notifications' as any });
      }

      // Se TUDO já estiver autorizado, não precisamos mais encher o saco do usuário
      // Marcamos como interagido para evitar futuras verificações desnecessárias
      if (
        geoStatus.state === 'granted' &&
        micStatus.state === 'granted' &&
        camStatus.state === 'granted' &&
        (!notifyStatus || notifyStatus.state === 'granted')
      ) {
        localStorage.setItem('nora_permissions_prompted', 'true');
        return;
      }

      // Se qualquer um estiver em 'prompt' (não perguntado), mostramos o diálogo explicativo
      if (
        geoStatus.state === 'prompt' ||
        micStatus.state === 'prompt' ||
        camStatus.state === 'prompt' ||
        (notifyStatus && notifyStatus.state === 'prompt')
      ) {
        setShowDialog(true);
      }
    } catch (e) {
      console.warn("Falha ao verificar permissões automaticamente:", e);
    }
  }, []);

  useEffect(() => {
    // Pequeno delay para garantir que a interface carregou e evitar flashes
    const timer = setTimeout(checkPermissions, 2000);
    return () => clearTimeout(timer);
  }, [checkPermissions]);

  const handleClose = () => {
    // Marca no localStorage de forma permanente (ex: após Autorizar Todos ser clicado)
    localStorage.setItem('nora_permissions_prompted', 'true');
    setShowDialog(false);
  };

  const handleLater = () => {
    // Apenas oculta o diálogo na sessão atual (ao clicar em 'Depois' ou fechar o modal)
    sessionStorage.setItem('nora_permissions_later', 'true');
    setShowDialog(false);
  };

  const requestAll = async () => {
    // Fecha o modal IMEDIATAMENTE para que o usuário não precise esperar o processamento das permissões
    handleClose();

    try {
      // 1. Solicitar GPS
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });

      // 2. Solicitar Câmera e Microfone (Hardware)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(t => t.stop()); // Fecha o hardware após liberar
      } catch (e) {
        console.warn("Câmera ou Microfone não disponíveis ou negados.");
      }

      // 3. Solicitar Notificações (Sons de Alerta)
      if ("Notification" in window) {
        await Notification.requestPermission();
      }

      // 4. Desbloqueio de áudio (Speech Synthesis)
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(utterance);
      }

      toast({
        title: "Sistema Configurado!",
        description: "Hardware, localização e sons liberados com sucesso.",
        duration: 10000,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Configuração Manual Necessária",
        description: "Alguns recursos foram negados. Clique no cadeado da barra de endereços para permitir.",
        duration: 10000,
      });
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={(open) => !open && handleLater()}>
      <DialogContent className="sm:max-w-md border-primary/20 shadow-glow-primary">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-6 w-6" />
            Configuração Necessária
          </DialogTitle>
          <DialogDescription className="text-foreground font-medium pt-2 text-justify">
            Olá! Para que o sistema funcione corretamente no seu dispositivo, precisamos que você autorize os acessos abaixo. Isso é essencial para o rastreamento da equipe, fotos de serviço e a assistente de voz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 text-sm">
            <div className="p-2 bg-blue-100 rounded-full shrink-0"><MapPin className="h-4 w-4 text-blue-600" /></div>
            <div>
              <p className="font-semibold">GPS / Localização</p>
              <p className="text-muted-foreground text-xs">Obrigatório para o Mapa Equipe e registro de local nas O.S.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="p-2 bg-green-100 rounded-full shrink-0"><Camera className="h-4 w-4 text-green-600" /></div>
            <div>
              <p className="font-semibold">Câmera e Microfone</p>
              <p className="text-muted-foreground text-xs">Para anexar fotos aos serviços e falar com a assistente.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <div className="p-2 bg-purple-100 rounded-full shrink-0"><Volume2 className="h-4 w-4 text-purple-600" /></div>
            <div>
              <p className="font-semibold">Sons e Notificações</p>
              <p className="text-muted-foreground text-xs">Para alertas de novos pedidos e voz da assistente.</p>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleLater}>Depois</Button>
          <Button className="w-full sm:w-auto shadow-glow-primary bg-primary hover:bg-primary/90" onClick={requestAll}>
            Autorizar Todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
