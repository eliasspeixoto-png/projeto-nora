"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/firebase/auth/use-user";
import { getQuotesOnce } from "@/lib/firebase/firestore";
import { Quote } from "@/lib/data";
import PreventiveMaintenanceAlerts from "@/components/dashboard/PreventiveMaintenanceAlerts";

export default function AllPreventiveMaintenancesPage() {
  const { userProfile, firebase } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!userProfile?.companyId || !firebase.db) {
        setLoading(false);
        return;
      }
      const data = await getQuotesOnce(firebase.db, userProfile.companyId, {
        uid: userProfile.uid,
        role: userProfile.role,
        displayName: userProfile.displayName,
      });
      setQuotes(data || []);
      setLoading(false);
    }
    load();
  }, [userProfile?.companyId, firebase.db]);

  if (loading) {
    return <div className="flex h-full items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Todas as Manutenções Preventivas Agendadas</h1>
      <PreventiveMaintenanceAlerts quotes={quotes} showAll={true} />
    </div>
  );
}
