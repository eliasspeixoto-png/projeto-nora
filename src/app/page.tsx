
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // We only want to redirect once the auth state is conclusive
    if (loading) return;

    // Wait for both user and userProfile to be loaded before redirecting
    if (user && userProfile) {
      if (userProfile.forcePasswordChange) {
        const path = userProfile.role === 'cliente' ? '/cliente/definir-senha' : '/definir-senha';
        router.push(path);
      } else if (userProfile.role === 'cliente') {
        router.push('/cliente/dashboard');
      } else {
        router.push('/dashboard');
      }
    } else if (!user) { // Only redirect to login if there is no user and we are not loading
      router.push('/login');
    }
  }, [user, userProfile, loading, router]);

  // Render a loader while the redirect logic is running
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="ml-2">Carregando...</p>
    </div>
  );
}
