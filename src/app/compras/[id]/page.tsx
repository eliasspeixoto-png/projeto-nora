
"use client";

import PurchaseOrderForm from "@/components/compras/PurchaseOrderForm";

export const dynamic = 'force-dynamic';

export default function EditPurchaseOrderPage() {
  return <PurchaseOrderForm mode="buyer" />;
}
