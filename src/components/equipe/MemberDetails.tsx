"use client";

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  MapPin as LocationIcon, 
  MapIcon as MapViewIcon, 
  EyeOff, 
  Zap, 
  Navigation as NavIcon, 
  Timer, 
  Clock, 
  Calendar as CalendarIcon, 
  Loader2, 
  Route,
  RefreshCw
} from 'lucide-react';
import { format, parseISO, isBefore, subMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { UserProfile } from '@/lib/data';
import { cn, formatBrasilia } from '@/lib/utils';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';

interface MemberDetailsProps {
    member: UserProfile;
    apiKey: string;
    totalDistance: number | null;
    isSearching: boolean;
    showRoute: boolean;
    onRouteToggle: () => void;
    selectedDate: Date;
    onDateSelect: (d: Date) => void;
    isAdmin: boolean;
}

export default function MemberDetails({ 
    member, 
    apiKey, 
    totalDistance, 
    isSearching, 
    showRoute, 
    onRouteToggle, 
    selectedDate, 
    onDateSelect, 
    isAdmin 
}: MemberDetailsProps) {
    const [address, setAddress] = useState<string | null>(null);
    const [imgState, setImgState] = useState<'street' | 'satellite' | 'roadmap' | 'error'>('street');

    const lastLocation = member.lastLocation;
    if (!lastLocation) return null;

    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=320x160&location=${lastLocation.latitude},${lastLocation.longitude}&fov=90&heading=235&pitch=10&key=${apiKey}`;
    const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lastLocation.latitude},${lastLocation.longitude}&zoom=18&size=320x160&maptype=satellite&key=${apiKey}`;
    const roadmapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lastLocation.latitude},${lastLocation.longitude}&zoom=16&size=320x160&markers=color:red%7C${lastLocation.latitude},${lastLocation.longitude}&key=${apiKey}`;

    useEffect(() => {
        setImgState('street');
        if (typeof window !== 'undefined' && window.google) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat: lastLocation.latitude, lng: lastLocation.longitude } }, (results, status) => {
                if (status === "OK" && results?.[0]) setAddress(results[0].formatted_address);
            });
        }
    }, [member.uid, lastLocation.latitude, lastLocation.longitude]);

    return (
        <div className="flex flex-col gap-4 p-4 bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300 w-full max-w-full overflow-hidden box-border shadow-premium">
            {/* Imagem Preview */}
            <div className="relative w-full h-40 bg-muted/20 rounded-2xl overflow-hidden group border border-border/40">
                {imgState !== 'error' ? (
                    <img 
                        src={imgState === 'street' ? streetViewUrl : (imgState === 'satellite' ? satelliteUrl : roadmapUrl)} 
                        alt="Preview do Local" 
                        loading="lazy"
                        onError={() => {
                            if (imgState === 'street') setImgState('satellite');
                            else if (imgState === 'satellite') setImgState('roadmap');
                            else setImgState('error');
                        }}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full relative group">
                        <Map 
                            defaultCenter={{ lat: lastLocation.latitude, lng: lastLocation.longitude }}
                            defaultZoom={17}
                            gestureHandling={'none'}
                            disableDefaultUI={true}
                            mapId="mini-map-preview"
                            className="w-full h-full"
                        >
                            <AdvancedMarker position={{ lat: lastLocation.latitude, lng: lastLocation.longitude }}>
                                <div className="h-5 w-5 bg-primary border-2 border-white rounded-full shadow-lg" />
                            </AdvancedMarker>
                        </Map>
                        <div className="absolute inset-0 bg-black/10 pointer-events-none group-hover:bg-transparent transition-colors" />
                        <div className="absolute top-3 left-3 bg-black/40 px-2 py-1 rounded-xl backdrop-blur-md border border-white/10">
                            <span className="text-[10px] text-white font-semibold uppercase tracking-widest">MAPA AO VIVO</span>
                        </div>
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${lastLocation.latitude},${lastLocation.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-3 right-3 bg-primary shadow-lg shadow-primary/20 text-white px-3 py-1 rounded-xl text-[10px] font-semibold hover:scale-105 transition-transform uppercase tracking-widest"
                        >
                            Ver Maps ↗
                        </a>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white bg-black/40 px-2 py-1 rounded-xl backdrop-blur-md border border-white/10">
                    {imgState === 'satellite' ? <MapViewIcon className="h-3 w-3 text-primary" /> : (imgState === 'street' ? <LocationIcon className="h-3 w-3 text-primary" /> : (imgState === 'roadmap' ? <LocationIcon className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3" />))}
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {imgState === 'street' ? 'STREET VIEW' : (imgState === 'satellite' ? 'SATÉLITE' : (imgState === 'roadmap' ? 'MAPA' : 'N/A'))}
                    </span>
                </div>
                <button 
                    className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-xl backdrop-blur-md transition-all border border-white/10"
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (imgState === 'street') setImgState('satellite');
                        else if (imgState === 'satellite') setImgState('roadmap');
                        else setImgState('street'); 
                    }}
                    title="Alternar visão"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {/* Endereço */}
            <div className="px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <LocationIcon className="h-4 w-4 text-primary shrink-0" />
                    </div>
                    <p className="text-[11px] text-foreground font-semibold tracking-tight line-clamp-2 leading-relaxed opacity-80 uppercase">
                        {address || "Localizando endereço..."}
                    </p>
                </div>
            </div>

            {/* Grid de Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/40 p-3 rounded-2xl border border-border/40 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        <span className="text-[9px] uppercase font-semibold tracking-widest opacity-40">Velocidade</span>
                    </div>
                    <div className="text-base font-semibold tracking-tighter">{Math.round((lastLocation as any).speed || 0)} <span className="text-[10px] font-medium opacity-20 truncate">KM/H</span></div>
                </div>
                
                <div className="bg-background/40 p-3 rounded-2xl border border-border/40 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Route className="h-3 w-3 text-blue-500" />
                        <span className="text-[9px] uppercase font-semibold tracking-widest opacity-40">Percurso</span>
                    </div>
                    <div className="text-base font-semibold tracking-tighter">{totalDistance?.toFixed(1) || '0.0'} <span className="text-[10px] font-medium opacity-20 truncate">KM</span></div>
                </div>

                <div className="bg-background/40 p-3 rounded-2xl border border-border/40 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Timer className="h-3 w-3 text-purple-500" />
                        <span className="text-[9px] uppercase font-semibold tracking-widest opacity-40">Imobilismo</span>
                    </div>
                    <div className="text-base font-semibold tracking-tighter">0 <span className="text-[10px] font-medium opacity-20 truncate">MIN</span></div>
                </div>

                <div className="bg-background/40 p-3 rounded-2xl border border-border/40 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3 text-green-500" />
                        <span className="text-[9px] uppercase font-semibold tracking-widest opacity-40">Atualização</span>
                    </div>
                    <div className="text-base font-semibold tracking-tighter">
                        {lastLocation.timestamp ? (
                            <span className="text-primary truncate">
                                {new Date().toLocaleDateString('pt-BR') !== formatBrasilia(lastLocation.timestamp, 'dd/MM/yyyy') 
                                ? formatBrasilia(lastLocation.timestamp, 'dd/MM/yyyy').slice(0, 5)
                                : formatBrasilia(lastLocation.timestamp, 'HH:mm')}
                            </span>
                        ) : <span className="opacity-20">--:--</span>}
                    </div>
                </div>
            </div>

            {/* Ações e Histórico */}
            <div className="flex flex-col gap-3 pt-4 border-t border-border/40">
                {isAdmin && (
                    <div className="flex flex-col gap-3 w-full">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-12 rounded-2xl bg-background/40 border-border/40 shadow-premium font-semibold text-[10px] uppercase tracking-widest">
                                    <CalendarIcon className="mr-3 h-4 w-4 text-primary" />
                                    <span>
                                        {formatBrasilia(selectedDate, 'eeee, dd MMMM').charAt(0).toUpperCase() + formatBrasilia(selectedDate, 'eeee, dd MMMM').slice(1)}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-[2.5rem] border-border/40 shadow-massive bg-background/80 backdrop-blur-3xl" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(d) => d && onDateSelect(d)}
                                    disabled={(date) => date > new Date()}
                                    initialFocus
                                    className="rounded-[2.5rem]"
                                />
                            </PopoverContent>
                        </Popover>
                        <Button 
                            variant={showRoute ? "default" : "outline"}
                            className={cn(
                                "h-14 rounded-2xl font-semibold text-[10px] uppercase tracking-widest shadow-premium transition-all active:scale-[0.98]",
                                showRoute ? "bg-primary text-white" : "bg-background/40 border-border/40"
                            )}
                            onClick={(e) => { e.stopPropagation(); onRouteToggle(); }}
                            disabled={isSearching}
                        >
                            {isSearching ? <Loader2 className="mr-3 h-4 w-4 animate-spin" /> : <NavIcon className="mr-3 h-4 w-4" />}
                            {showRoute ? 'Sair do Histórico' : 'Rastrear Trilha Completa'}
                        </Button>
                    </div>
                )}
                <div className="flex justify-between items-center text-[8px] text-muted-foreground px-1 font-semibold uppercase tracking-widest opacity-30">
                    <span>Motor de Execução</span>
                    <span className="truncate">POS: {lastLocation.latitude.toFixed(4)}, {lastLocation.longitude.toFixed(4)}</span>
                </div>
            </div>
        </div>
    );
}
