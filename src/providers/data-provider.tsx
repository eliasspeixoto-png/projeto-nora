'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { getTeamMembers } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

interface DataContextType {
  teamMembers: UserProfile[];
  isDataLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { userProfile, firebase } = useAuth();
  const { toast } = useToast();
  
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    // Only load essential team data globally (needed for sidebar and general UI)
    if (!userProfile?.companyId || !firebase.db) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);

    const unsubTeam = getTeamMembers(
      firebase.db,
      userProfile.companyId,
      (data) => {
        setTeamMembers(data);
        setIsDataLoading(false);
      },
      (error: any) => {
        console.error("Error loading Team:", error);
        toast({ variant: 'destructive', title: 'Erro ao carregar colaboradores', description: error.message });
        setIsDataLoading(false);
      }
    );

    return () => {
      unsubTeam();
    };
  }, [userProfile?.companyId, firebase.db, toast]);

  return (
    <DataContext.Provider value={{ teamMembers, isDataLoading }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
}
