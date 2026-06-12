
"use client";

import { EditGeneralQuoteComponent } from "@/app/orcamentos/editar/[id]/EditGeneralQuote";

export const dynamic = 'force-dynamic';

export default function EditServiceOrderPage() {
  return <EditGeneralQuoteComponent isModal={false} />;
}
