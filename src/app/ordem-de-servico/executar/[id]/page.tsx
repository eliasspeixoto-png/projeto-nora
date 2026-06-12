
"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import { getQuote, getClient } from "@/lib/firebase/firestore";
import type { Quote, Client } from "@/lib/data";
import { Loader2 } from "lucide-react";
import OsExecutionClient from '../OsExecutionClient';
import { useAuth } from "@/firebase/auth/use-user";

export const dynamic = 'force-dynamic';

export default function OsExecutionPage() {
  const params = useParams();
  const osId = (params as any)?.id as string;
  const { firebase, loading: authLoading } = useAuth();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aguarda a autenticação e a inicialização do firebase.db
    if (authLoading || !firebase?.db) {
      // Continua mostrando o loader se o firebase não estiver pronto
      setIsLoading(true);
      return;
    }

    if (!osId) {
      setError("ID da Ordem de Serviço não encontrado.");
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      // A verificação de firebase.db já foi feita, mas é uma boa prática
      if (!firebase.db) return;

      try {
        setIsLoading(true);
        const quoteData = await getQuote(firebase.db, osId);
        if (!quoteData) {
          setError("Ordem de Serviço não encontrada.");
          setIsLoading(false);
          return;
        }

        const clientData = await getClient(firebase.db, quoteData.clientId);
        if (!clientData) {
          setError("Cliente não encontrado.");
          setIsLoading(false);
          return;
        }

        setQuote(quoteData);
        setClient(clientData);
      } catch (err: any) {
        console.error("Erro ao buscar dados da O.S.:", err);
        setError(err.message || "Falha ao carregar dados.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [osId, authLoading, firebase]);

  if (isLoading || authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Carregando dados da O.S....</p>
      </div>
    );
  }
  
  if (error) {
     return (
      <div className="flex h-screen w-full items-center justify-center text-destructive">
        <p>Erro: {error}</p>
      </div>
     )
  }

  if (!quote || !client) {
    // Pode acontecer brevemente ou se houver um erro não capturado.
    return null;
  }

  return <OsExecutionClient initialQuote={quote} initialClient={client} />;
}
