"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getAccountReceivable, getQuote, getClient, getCompany } from "@/lib/firebase/firestore";
import { useAuth } from "@/firebase/auth/use-user";
import type { AccountsReceivable, Quote, Client, Company } from "@/lib/data";
import { Loader2 } from "lucide-react";
import ReceiptContent from "@/app/financeiro/recibo/[id]/ReceiptContent";

export default function PublicReceiptViewPage() {
  const params = useParams();
  const receivableId = (params as any)?.id as string;
  const { firebase } = useAuth();
  
  const [receivable, setReceivable] = useState<AccountsReceivable | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receivableId || !firebase) {
      setError("ID do recibo não fornecido.");
      setIsLoading(false);
      return;
    }

    const { db } = firebase;

    const fetchReceiptData = async () => {
      try {
        const fetchedReceivable = await getAccountReceivable(db, receivableId);
        if (!fetchedReceivable) throw new Error("Recibo não encontrado.");
        
        const fetchedQuote = await getQuote(db, fetchedReceivable.quoteId);
        if (!fetchedQuote) throw new Error("Orçamento associado não encontrado.");

        const [fetchedClient, fetchedCompany] = await Promise.all([
          getClient(db, fetchedReceivable.clientId),
          getCompany(db, fetchedReceivable.companyId)
        ]);
        if (!fetchedClient || !fetchedCompany) throw new Error("Dados do cliente ou empresa não encontrados.");
        
        setReceivable(fetchedReceivable);
        setQuote(fetchedQuote);
        setClient(fetchedClient);
        setCompany(fetchedCompany);

      } catch (err: any) {
        setError(err.message || "Não foi possível carregar os dados do recibo.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceiptData();
  }, [receivableId, firebase]);
  
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !receivable || !quote || !client || !company) {
    return <div className="flex h-screen w-full items-center justify-center text-destructive">{error || "Recibo não encontrado."}</div>;
  }

  return (
    <main className="p-4 md:p-8 bg-muted">
       <ReceiptContent
            company={company}
            client={client}
            quote={quote}
            receivable={receivable}
       />
    </main>
  );
}
