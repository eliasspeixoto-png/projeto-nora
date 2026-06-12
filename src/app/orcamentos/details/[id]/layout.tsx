import { ReactNode } from "react";

// A função generateMetadata foi removida para corrigir um erro de build em produção.
// A busca de dados no lado do servidor durante o build estava causando a falha.
// A página de visualização continuará funcionando, mas o título será genérico.

export default function QuoteViewLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>;
}
