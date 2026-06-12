
'use client';
import { useEffect, useState } from 'react';
import { initializeFirebase } from '@/lib/firebase';
import { AuthProvider } from '@/firebase/auth/use-user';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

interface FirebaseInstances {
    app: FirebaseApp;
    auth: Auth;
    db: Firestore;
    storage: FirebaseStorage;
    messaging?: any;
}

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [firebase, setFirebase] = useState<FirebaseInstances | null>(null);

  useEffect(() => {
    const instances = initializeFirebase();
    setFirebase(instances);
  }, []);

  if (!firebase) {
    // Render nothing or a minimal loader, but crucially, this must be consistent
    // between server and client initial render. An empty fragment is safest.
    return <></>; 
  }

  return (
    <AuthProvider firebase={firebase}>
      {children}
    </AuthProvider>
  );
}
