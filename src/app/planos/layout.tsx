import { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Planos e Preços | NORA - Gestão Inteligente para Serviços',
  description: 'Escolha o plano ideal para sua empresa de segurança e instalações. Do Essencial ao Enterprise, escale sua operação com o NORA.',
  keywords: 'software gestão serviços, erp segurança eletrônica, ordens de serviço digital, controle de comodato, gestão de equipes de campo',
  openGraph: {
    title: 'Planos NORA - Tecnologia para Empresas de Elite',
    description: 'Elimine a desorganização e escale seu faturamento com o NORA.',
    images: ['https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20transparente.png?alt=media&token=2d5b0b94-7dd8-47e2-9d6b-32779ad80b84'],
  },
};

export default function PlanosLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "NORA",
    "operatingSystem": "Web, Android, iOS",
    "applicationCategory": "BusinessApplication",
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "69.90",
      "highPrice": "129.90",
      "priceCurrency": "BRL",
      "offerCount": "3"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "800"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
