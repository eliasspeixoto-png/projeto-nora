"use client";

import { useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { useAuth } from '@/firebase/auth/use-user';
import { saveFcmToken } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PushNotificationManager() {
  const { user, firebase } = useAuth();
  const { toast } = useToast();
  const { db, messaging } = firebase;

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(e => console.log('Erro ao tocar som:', e));
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!messaging || !user) return;
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        });
        
        if (token) {
          await saveFcmToken(db, user.uid, token);
          return token;
        }
      }
    } catch (error) {
      console.error('Erro ao configurar notificações push:', error);
    }
  }, [messaging, user, db]);

  useEffect(() => {
    if (!messaging || !user) return;

    // Tentar obter o token automaticamente se a permissão já existir
    if (Notification.permission === 'granted') {
      requestPermission();
    }

    // Listener para mensagens em primeiro plano
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Mensagem recebida em foreground:', payload);
      
      playNotificationSound();

      toast({
        title: payload.notification?.title || "Nova Notificação",
        description: payload.notification?.body || "Você tem uma nova atualização.",
        duration: 8000,
      });
    });

    return () => unsubscribe();
  }, [messaging, user, requestPermission, playNotificationSound, toast]);

  // Se não houver permissão, mostramos um pequeno lembrete discreto ou nada
  // Para este MVP, vamos apenas rodar em background.
  // Poderíamos retornar um banner aqui se Notification.permission === 'default'
  
  return null;
}
