
import { ReactNode, Suspense } from "react";
import '@/app/globals.css';
import { ClientToaster } from "@/components/ui/client-toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { Loader2 } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
        <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-background to-transparent p-4 sm:p-8 relative overflow-hidden">
            {/* Elementos decorativos de fundo */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            
            <div className="relative z-10 w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-1000">
                <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>}>
                    {children}
                </Suspense>
            </div>
        </div>
        <ClientToaster />
    </FirebaseClientProvider>
  );
}
