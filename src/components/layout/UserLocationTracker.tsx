
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { updateTeamMemberLocationHistory } from '@/lib/firebase/firestore';

const MOBILE_SEND_INTERVAL = 5 * 60 * 1000; // 5 mins

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export default function UserLocationTracker() {
  const { user, userProfile, firebase } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const updateLocation = useCallback(async () => {
    if (!user || !userProfile?.uid || !firebase.db || !navigator.geolocation) {
      return;
    }
    
    if (navigator.permissions) {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
            if (permissionStatus.state === 'denied') {
                return;
            }
        } catch(e) {}
    }

    navigator.geolocation.getCurrentPosition(
      async (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { 
          latitude, 
          longitude, 
          accuracy: accuracy || 0, 
          timestamp: new Date().toISOString(),
          source: (isMobile ? 'mobile_gps' : 'desktop_browser') as 'mobile_gps' | 'desktop_browser'
        };
        
        try {
          await updateTeamMemberLocationHistory(firebase.db, userProfile.uid, userProfile.companyId || '', newLocation, true);
        } catch (error) {
            // Ignore silent
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, [user, userProfile, firebase.db, isMobile]);

  useEffect(() => {
    if (!user || !userProfile?.uid) {
      return;
    }

    const allowedRoles = ['tecnico', 'supervisor', 'admin'];
    if (!allowedRoles.includes(userProfile.role || '')) {
      return;
    }

    const stopTracking = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
    
    const startTracking = () => {
      stopTracking();
      setTimeout(() => {
        updateLocation(); 

        if (isMobile) {
          const id = setInterval(updateLocation, MOBILE_SEND_INTERVAL);
          intervalIdRef.current = id;
        }
      }, 10000);
    };

    startTracking();

    const handleOffline = () => {
      if (userProfile?.uid && firebase.db) {
        updateTeamMemberLocationHistory(firebase.db, userProfile.uid, userProfile.companyId || '', undefined, false);
      }
    }

    window.addEventListener('beforeunload', handleOffline);

    return () => {
      stopTracking();
      handleOffline();
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, [user, userProfile, isMobile, firebase.db, updateLocation]);

  return null;
}
