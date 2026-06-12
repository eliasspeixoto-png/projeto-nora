
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword
} from 'firebase/auth';
import { UserProfile, Company } from '@/lib/data';
import { getCompany, getTeamMembers, updateTeamMember } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import { isPast, parseISO } from 'date-fns';



interface FirebaseInstances {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  messaging?: any; // Usando any temporariamente para evitar conflito de import, ou importar Messaging
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  isDeveloper: boolean;
  impersonatedCompany: { companyId: string; companyName: string; } | null;
  isSubscriptionExpired: boolean;
  subscriptionWarningDays: number | null;
  signIn: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  stopImpersonating: () => void;
  firebase: FirebaseInstances;
  setCompany: React.Dispatch<React.SetStateAction<Company | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helpers para leitura segura do sessionStorage
function getCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem('nora_user_profile');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function getCachedCompany(): Company | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem('nora_company_data');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

async function getUserProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
    }
  } catch (e) {
    return null;
  }
  return null;
}

const differenceInDaysCeil = (dateLeft: Date, dateRight: Date): number => {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(dateLeft.getFullYear(), dateLeft.getMonth(), dateLeft.getDate());
  const utc2 = Date.UTC(dateRight.getFullYear(), dateRight.getMonth(), dateRight.getDate());
  return Math.ceil((utc1 - utc2) / _MS_PER_DAY);
};

export function AuthProvider({ children, firebase }: { children: React.ReactNode, firebase: FirebaseInstances }) {
  const { auth, db } = firebase;
  const [user, setUser] = useState<User | null>(null);

  // Inicializar com cache do sessionStorage para exibição instantânea (evita flash de logo/loading)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(getCachedProfile);
  const [company, setCompany] = useState<any>(getCachedCompany);

  // authChecked: controla se o Firebase Auth já respondeu pelo menos uma vez
  // loading: só fica false quando temos certeza absoluta do estado (Auth + perfil + empresa)
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isDeveloper, setIsDeveloper] = useState(false);
  const [impersonatedCompany, setImpersonatedCompany] = useState<{ companyId: string; companyName: string; } | null>(null);
  const [isSubscriptionExpired, setSubscriptionExpired] = useState(false);
  const [subscriptionWarningDays, setSubscriptionWarningDays] = useState<number | null>(null);

  useEffect(() => {
    const impersonationData = localStorage.getItem('developer_impersonating');
    if (impersonationData) {
      try {
        setImpersonatedCompany(JSON.parse(impersonationData));
      } catch (e) { }
    }

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
      if (!currentUser) {
        // Usuário não logado: limpar tudo
        setLoading(false);
        setUserProfile(null);
        setCompany(null);
        setIsDeveloper(false);
        setSubscriptionExpired(false);
        setSubscriptionWarningDays(null);
        localStorage.removeItem('developer_impersonating');
        sessionStorage.removeItem('nora_user_profile');
        sessionStorage.removeItem('nora_company_data');
      }
      // Se currentUser existe, o loading permanecerá true até o useEffect de sincronização resolver
    });

    return () => authUnsubscribe();
  }, [auth]);

  // Query do Perfil do Usuário com Cache Gerenciado
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', user?.uid, impersonatedCompany?.companyId],
    queryFn: async () => {
      if (!user) return null;
      const profile = await getUserProfile(db, user.uid);
      if (!profile) return null;

      const impersonationData = typeof window !== 'undefined' ? localStorage.getItem('developer_impersonating') : null;
      let impersonatedId = null;
      try {
        impersonatedId = impersonationData ? JSON.parse(impersonationData).companyId : null;
      } catch (e) { }

      const isDev = profile.role === 'developer';
      let targetCompanyId = impersonatedId || profile.companyId;
      let finalProfile = { ...profile, companyId: targetCompanyId };

      if (isDev && impersonatedId) {
        finalProfile.role = 'admin';
      }

      return finalProfile;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutos para perfil
  });

  // Query da Empresa vinculada
  const { data: companyData, isLoading: companyLoading } = useQuery({
    queryKey: ['company', profileData?.companyId],
    queryFn: async () => {
      if (!profileData?.companyId) return null;
      return getCompany(db, profileData.companyId);
    },
    enabled: !!profileData?.companyId,
    staleTime: 1000 * 60 * 5, // 5 minutos para dados da empresa
  });

  // Sincronização de estados e determinação do 'loading' final
  useEffect(() => {
    // Não tomar decisões até o Firebase Auth inicializar
    if (!authChecked) return;

    // Atualizar perfil quando dados frescos chegam do TanStack Query
    if (profileData) {
      setUserProfile(profileData);
      setIsDeveloper(profileData.role === 'developer' || (typeof window !== 'undefined' && localStorage.getItem('developer_impersonating') !== null));
      sessionStorage.setItem('nora_user_profile', JSON.stringify(profileData));
    }
    
    // Atualizar empresa quando dados frescos chegam
    if (companyData) {
      setCompany(companyData);
      sessionStorage.setItem('nora_company_data', JSON.stringify(companyData));

      // Lógica de Assinatura
      const isTrial = companyData.plan === 'Periodo Teste';
      const expiryDateStr = isTrial ? companyData.trialEndsAt : companyData.planExpiresAt;

      if (expiryDateStr) {
        try {
          const expiryDate = parseISO(expiryDateStr);
          const now = new Date();
          if (isPast(expiryDate)) {
            setSubscriptionExpired(true);
            setSubscriptionWarningDays(null);
          } else {
            setSubscriptionExpired(false);
            const daysUntilExpiry = differenceInDaysCeil(expiryDate, now);
            if (daysUntilExpiry <= 7) setSubscriptionWarningDays(daysUntilExpiry);
            else setSubscriptionWarningDays(null);
          }
        } catch (e) {
          setSubscriptionExpired(true);
        }
      } else {
        setSubscriptionExpired(profileData?.role !== 'developer');
      }
    }

    // Determinar quando parar de carregar:
    // - Sem usuário: parar imediatamente
    // - Com usuário: esperar perfil e empresa terminarem
    if (!user) {
      setLoading(false);
    } else if (!profileLoading && !companyLoading) {
      setLoading(false);
    }
  }, [authChecked, user, profileData, companyData, profileLoading, companyLoading]);

  const signIn = async (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const sendPasswordReset = (email: string) => {
    return sendPasswordResetEmail(auth, email);
  };

  const updatePassword = async (newPassword: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    await firebaseUpdatePassword(user, newPassword);
    await updateTeamMember(db, user.uid, { forcePasswordChange: false });
    setUserProfile(prev => prev ? { ...prev, forcePasswordChange: false } : null);
  };

  const signOut = () => {
    localStorage.removeItem('developer_impersonating');
    sessionStorage.removeItem('nora_user_profile');
    sessionStorage.removeItem('nora_company_data');
    setImpersonatedCompany(null);
    return firebaseSignOut(auth);
  };

  const stopImpersonating = () => {
    localStorage.removeItem('developer_impersonating');
    sessionStorage.removeItem('nora_user_profile');
    sessionStorage.removeItem('nora_company_data');
    setImpersonatedCompany(null);
    setTimeout(() => window.location.href = '/developer', 500);
  };

  const authValue: AuthContextType = useMemo(() => ({
    user,
    userProfile,
    company,
    loading,
    isDeveloper,
    impersonatedCompany,
    isSubscriptionExpired,
    subscriptionWarningDays,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    stopImpersonating,
    firebase,
    setCompany,
  }), [
    user,
    userProfile,
    company,
    loading,
    isDeveloper,
    impersonatedCompany,
    isSubscriptionExpired,
    subscriptionWarningDays,
    firebase
  ]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
