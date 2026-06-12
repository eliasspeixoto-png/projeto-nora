
"use client";
import { redirect } from 'next/navigation';

// Redirect to the inventory page by default
export default function FerramentasPage() {
    redirect('/ferramentas/inventario');
}
