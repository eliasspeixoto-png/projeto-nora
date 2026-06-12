"use client";

import DeveloperDashboard from "@/components/dashboard/DeveloperDashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";

/**
 * Developer Page
 * This is a clean wrapper around the DeveloperDashboard component.
 * Access is restricted via the component itself and Firestore security rules.
 */
export default function DeveloperPage() {
    return (
        <ProtectedRoute requireAuth>
            <div className="p-4 md:p-8">
                <DeveloperDashboard />
            </div>
        </ProtectedRoute>
    );
}
