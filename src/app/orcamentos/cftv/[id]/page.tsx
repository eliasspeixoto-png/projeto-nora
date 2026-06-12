"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getQuote } from "@/lib/firebase/firestore";
import type { Quote } from "@/lib/data";
import type { FloorPlan } from "@/lib/cftv-types";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/firebase/auth/use-user";
import FloorPlanCanvas from "@/components/orcamentos/cameras/FloorPlanCanvas";
import { Button } from "@/components/ui/button";

export default function CftvViewPage() {
  const params = useParams();
  const router = useRouter();
  const { firebase } = useAuth();
  const quoteId = (params as any)?.id as string;
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!quoteId || !firebase?.db) return;

    const fetchQuoteData = async () => {
      setIsLoading(true);
      const fetchedQuote = await getQuote(firebase.db, quoteId);
      if (fetchedQuote && fetchedQuote.cftvDetails) {
          setQuote(fetchedQuote);
      } else {
          router.push('/orcamentos');
      }
      setIsLoading(false);
    };

    fetchQuoteData();
  }, [quoteId, firebase, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Carregando planta baixa...</p>
      </div>
    );
  }

  if (!quote || !quote.cftvDetails) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-destructive flex-col gap-4">
        <p>Dados da planta baixa não encontrados para este orçamento.</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const floorPlanFromQuote: FloorPlan = {
      id: quote.id,
      name: `Planta - ${quote.quoteNumber}`,
      cameras: quote.cftvDetails.cameras || [],
      walls: quote.cftvDetails.walls || [],
      elements: quote.cftvDetails.elements || [],
      measurements: quote.cftvDetails.measurements || [],
      width: quote.cftvDetails.width || 100,
      height: quote.cftvDetails.height || 60,
      scale: quote.cftvDetails.scale || 20,
      floors: 1,
      createdAt: new Date(quote.date),
      updatedAt: new Date(quote.date),
      backgroundImage: quote.cftvDetails.backgroundImage,
  };

  return (
    <div className="h-screen w-screen bg-muted flex flex-col">
      <header className="flex-shrink-0 h-14 flex items-center justify-between px-4 border-b bg-background z-10">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
        </Button>
        <h1 className="font-semibold truncate text-xl">Planta Baixa: {quote.quoteNumber}</h1>
        <div className="w-24"></div> {/* Spacer */}
      </header>
      <main className="flex-1 relative">
        <FloorPlanCanvas
            floorPlan={floorPlanFromQuote}
            setFloorPlan={() => {}}
            selectedCamera={null}
            selectedElement={null}
            selectedWall={null}
            drawingMode="select"
            onDrawingModeChange={() => {}}
            onCameraAdd={() => {}}
            onElementAdd={() => {}}
            onCameraSelect={() => {}}
            onElementSelect={() => {}}
            onWallSelect={() => {}}
            onCameraUpdate={() => {}}
            onElementUpdate={() => {}}
            onWallUpdate={() => {}}
            onCameraDelete={() => {}}
            onElementDelete={() => {}}
            onCameraRotate={() => {}}
            onElementRotate={() => {}}
            onWallAdd={() => {}}
            onWallRemove={() => {}}
            onMeasurementAdd={() => {}}
            onMeasurementRemove={() => {}}
            onUndo={() => {}}
            onRedo={() => {}}
            clipboard={null}
            setClipboard={() => {}}
            selectedIds={[]}
            onSelectionChange={() => {}}
            interactive={false}
        />
      </main>
    </div>
  );
}
