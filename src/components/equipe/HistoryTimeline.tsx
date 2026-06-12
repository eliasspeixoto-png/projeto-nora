"use client";

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  MapPin, 
  Activity, 
  TrendingUp,
  Map as MapViewIcon,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { UserProfile } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatBrasilia } from '@/lib/utils';

interface HistoryTimelineProps {
  member: UserProfile;
  history: any[];
  onBack: () => void;
  onPointClick?: (point: {lat: number, lng: number}) => void;
  isLoading?: boolean;
}

// Componente para exibir o endereço geocodificado de um ponto
const GeocodedAddress = ({ lat, lng }: { lat: number, lng: number }) => {
    const [address, setAddress] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.google || !window.google.maps) return;
        
        const geocoder = new window.google.maps.Geocoder();
        setLoading(true);
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results?.[0]) {
                setAddress(results[0].formatted_address);
            } else {
                setAddress(`[${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
            }
            setLoading(false);
        });
    }, [lat, lng]);

    if (loading) return <span className="animate-pulse opacity-50 italic">Buscando endereço...</span>;
    return <span>{address || `[${lat.toFixed(4)}, ${lng.toFixed(4)}]`}</span>;
};

export default function HistoryTimeline({ member, history, onBack, onPointClick, isLoading }: HistoryTimelineProps) {
  // Process data for the chart
  const chartData = useMemo(() => {
    return history.map((point) => ({
      time: formatBrasilia(point.timestamp, 'HH:mm'),
      speed: Math.round(point.speed || 0),
      timestamp: new Date(point.timestamp).getTime()
    }));
  }, [history]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background/40 backdrop-blur-3xl p-8 text-center rounded-[2.5rem]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-6 opacity-40" />
        <h3 className="text-sm font-semibold uppercase tracking-widest opacity-60">Sincronizando Histórico</h3>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-30 mt-2">Recuperando registros da nuvem...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-3xl rounded-[2.5rem] border border-border/40 shadow-premium overflow-hidden">
      {/* Header */}
      <header className="p-8 pb-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl hover:bg-primary/5 font-semibold text-[10px] uppercase tracking-widest text-primary/60">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista
        </Button>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-background shadow-lg">
            <AvatarImage src={member.avatarUrl} alt={member.displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
              {member.displayName?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold uppercase text-xs tracking-tight">{member.displayName}</h3>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-40">
              Linha do Tempo • {history.length} Registros
            </p>
          </div>
        </div>
      </header>

      {/* Points List */}
      <ScrollArea className="flex-1 px-6">
        <div className="space-y-4 relative ml-3 border-l-2 border-border/40 pt-4 pb-12">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
              <AlertCircle className="h-10 w-10 mb-2" />
              <p className="text-[10px] font-semibold uppercase tracking-widest">Nenhum registro encontrado</p>
            </div>
          ) : (
            history.map((point, index) => (
              <div 
                key={index} 
                className="relative pl-8 cursor-pointer group animate-in fade-in slide-in-from-left-4 duration-500"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => onPointClick?.({ lat: point.latitude, lng: point.longitude })}
              >
                {/* Timeline Node */}
                <div className={cn(
                    "absolute left-[-7px] top-4 h-3 w-3 rounded-full border-2 border-background z-10 transition-all group-hover:scale-125 group-active:scale-95",
                    index === 0 ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]" : 
                    index === history.length - 1 ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" : "bg-primary shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                )} />
                
                <div className="bg-background/20 hover:bg-primary/5 transition-all p-4 rounded-2xl border border-border/40 group-hover:border-primary/20 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-tight">
                      {formatBrasilia(point.timestamp, 'HH:mm:ss')}
                    </span>
                    <div className="flex items-center gap-2">
                         {point.speed > 0 && (
                            <span className="text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold uppercase tracking-widest">
                                {Math.round(point.speed)} KM/H
                            </span>
                         )}
                         <a 
                            href={`https://www.google.com/maps?q&layer=c&cbll=${point.latitude},${point.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-primary/20 rounded-xl transition-all text-primary/40 hover:text-primary"
                            title="Street View"
                            onClick={(e) => e.stopPropagation()}
                         >
                            <MapViewIcon className="h-4 w-4" />
                         </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                        <MapPin className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase opacity-40 leading-relaxed group-hover:opacity-80 transition-opacity">
                        <GeocodedAddress lat={point.latitude} lng={point.longitude} />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Activity Graph */}
      {history.length > 0 && (
        <div className="p-8 pt-6 bg-background/20 border-t border-border/40 space-y-6">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                    <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Métrica de Atividade</span>
                    <h4 className="text-xs font-semibold uppercase">Desempenho de Velocidade</h4>
                </div>
             </div>
          </div>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSpeedTimeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--primary))" opacity={0.05} />
                <XAxis 
                  dataKey="time" 
                  fontSize={8} 
                  tickLine={false} 
                  axisLine={false}
                  interval="preserveStartEnd"
                  stroke="currentColor"
                  opacity={0.3}
                />
                <Tooltip 
                  contentStyle={{ 
                    fontSize: '10px', 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.05)', 
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                  }}
                  itemStyle={{ color: 'hsl(var(--primary))', fontWeight: '600', textTransform: 'uppercase' }}
                  labelStyle={{ fontWeight: '600', opacity: '0.4', marginBottom: '4px' }}
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorSpeedTimeline)" 
                  strokeWidth={2}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
