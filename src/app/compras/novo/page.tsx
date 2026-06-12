

"use client";

import PurchaseOrderForm from "@/components/compras/PurchaseOrderForm";

export const dynamic = 'force-dynamic';

export default function NewPurchaseOrderPage() {
  return <PurchaseOrderForm mode="buyer"/>;
}

