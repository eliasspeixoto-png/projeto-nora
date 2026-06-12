
"use client";

import { useCallback, useRef } from 'react';

// Using a locally hosted, royalty-free sound
const NOTIFICATION_SOUND_URL = "/sounds/notification.mp3";

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pre-load the audio element
  if (typeof window !== 'undefined' && !audioRef.current) {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.preload = 'auto';
  }

  const playNotificationSound = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      // Rewind to start in case it's already playing
      audio.currentTime = 0;
      audio.play().catch(error => {
        // Autoplay can be blocked by the browser, log the error but don't crash
        // The sound will play on subsequent notifications after a user interaction.
        console.warn("Could not play notification sound automatically:", error.message);
      });
    }
  }, []);

  return { playNotificationSound };
}

    
