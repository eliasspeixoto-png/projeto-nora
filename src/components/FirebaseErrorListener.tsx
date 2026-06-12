
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

// This is a client component that will listen for the custom error event
// and display a toast notification. In a real app, you might want to
// use a more sophisticated error reporting service.
export default function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error("Caught Firestore Permission Error:", error);

      // In a development environment, we can throw the error to show
      // Next.js's error overlay, which is very useful for debugging.
      if (process.env.NODE_ENV === 'development') {
        // We throw it in a timeout to break out of the current call stack,
        // which prevents React's error boundary from catching it and
        // allows Next.js's overlay to appear.
        setTimeout(() => {
          throw error;
        });
      } else {
        // In production, you'd likely want to show a generic toast and
        // report the error to a service like Sentry, LogRocket, etc.
        toast({
          variant: "destructive",
          title: "Erro de Permissão",
          description: "Você não tem permissão para realizar esta ação.",
        });
      }
    };

    errorEmitter.on('permission-error', handleError);

    // Cleanup the listener when the component unmounts
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  // This component doesn't render anything itself
  return null;
}
