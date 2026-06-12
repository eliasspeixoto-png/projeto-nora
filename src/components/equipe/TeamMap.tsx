'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, InfoWindow } from '@vis.gl/react-google-maps';
import type { UserProfile } from '@/lib/data';
import { useAuth } from '@/firebase/auth/use-user';
import { getCompany, getLocationHistory } from '@/lib/firebase/firestore';
import { Building, User, Car, Loader2, Users, Eye, EyeOff, Route, Globe, MapIcon as MapViewIcon, MapPin as LocationIcon, Clock, Zap, Timer, Navigation as NavIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn, formatBrasilia, formatDisplayName } from '@/lib/utils';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore, subMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { defaultAvatar } from '@/lib/avatars';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';

const ensureISO = (date: any): string => {
    if (!date) return "";
    if (typeof date === 'string') return date;
    if (date && typeof date.toDate === 'function') {
      return date.toDate().toISOString();
    }
    return String(date);
};

const RouteHistoryPath = ({ points, onPointSelect }: { points: any[], onPointSelect?: (point: any) => void }) => {
    if (typeof window === 'undefined') return null;
    const map = useMap();
    
    useEffect(() => {
        if (typeof window === 'undefined' || !map || points.length < 1) return;
        if (!window.google) return;

        const coords = points.map(p => ({ lat: p.latitude, lng: p.longitude }));

        // Path (Polyline) - Yellow as requested
        const path = coords.length >= 2 ? new window.google.maps.Polyline({
            path: coords,
            geodesic: true,
            strokeColor: '#facc15',
            strokeOpacity: 0.9,
            strokeWeight: 6,
            map: map,
            icons: [{
                icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2, fillOpacity: 1, strokeWeight: 2 },
                offset: '100%',
                repeat: '120px'
            }]
        }) : null;

        // Visual markers for Start and End positions
        const startMarker = new window.google.maps.Marker({
            position: coords[0],
            map: map,
            title: "Ponto Inicial",
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#22c55e',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 8
            }
        });

        startMarker.addListener('click', () => onPointSelect?.(points[0]));

        // Last position with a Star icon as seen in reference
        const endMarker = coords.length >= 2 ? new window.google.maps.Marker({
            position: coords[coords.length - 1],
            map: map,
            title: "Última Posição",
            zIndex: 100,
            icon: {
                path: 'M 125,5 155,90 245,90 175,145 200,230 125,180 50,230 75,145 5,90 95,90 z',
                fillColor: '#facc15',
                fillOpacity: 1,
                strokeColor: '#000000',
                strokeWeight: 1,
                scale: 0.1,
                anchor: new window.google.maps.Point(125, 125)
            }
        }) : null;

        if (endMarker) {
            endMarker.addListener('click', () => onPointSelect?.(points[points.length - 1]));
        }

        const bounds = new window.google.maps.LatLngBounds();
        coords.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, 50);

        // Trail dots (Breadcrumbs) - Small red circles
        const trailDots = points.filter((_, i) => i > 0 && i < points.length - 1 && i % 4 === 0).map(p => {
             const marker = new window.google.maps.Marker({
                position: { lat: p.latitude, lng: p.longitude },
                map: map,
                clickable: true,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: '#ef4444',
                    fillOpacity: 0.8,
                    strokeColor: '#ffffff',
                    strokeWeight: 1,
                    scale: 4 // Slightly larger to be clickable
                }
             });

             marker.addListener('click', () => onPointSelect?.(p));
             return marker;
        });

        // Max zoom cap
        const listener = map.addListener('idle', () => {
            if (map.getZoom()! > 18) {
                map.setZoom(18);
            }
            window.google.maps.event.removeListener(listener);
        });

        return () => {
            if (path) path.setMap(null);
            startMarker.setMap(null);
            if (endMarker) endMarker.setMap(null);
            trailDots.forEach(d => d.setMap(null));
            window.google.maps.event.removeListener(listener);
        };
    }, [map, points, onPointSelect]);

    return null;
};

const baseClasses = "w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg border-2";

const MarkerIcon = ({ member, showName }: { member: UserProfile, showName: boolean }) => {
    const { displayName, isOnline, avatarUrl } = member;
    


    return (
      <div className="flex flex-col items-center">
        <div className={cn(baseClasses, "p-0 overflow-hidden", "w-9 h-9", isOnline ? "border-green-500 animate-pulse-green" : "border-white")}>
          <Image
            src={avatarUrl || defaultAvatar}
            alt="Member Icon"
            width={36}
            height={36}
            className="rounded-full"
          />
        </div>
        {showName && (
            <div className="mt-1 px-2 py-0.5 bg-background border border-border rounded-md text-[10px] font-medium shadow-sm whitespace-nowrap text-foreground">
              {formatDisplayName(displayName)}
            </div>
        )}
      </div>
    );
};


const ClusterIcon = ({ count }: { count: number }) => (
    <div className="flex flex-col items-center">
        <div className={cn(baseClasses, "bg-blue-500 border-white")}>
            <Users className="h-5 w-5" />
        </div>
        <div className="mt-1 px-2 py-0.5 bg-background/80 rounded-full text-xs font-semibold shadow">
            {count}
        </div>
    </div>
);

const CompanyMarkerIcon = () => (
    <div className={cn(baseClasses, 'bg-green-500', 'border-white')}>
        <Building className="h-5 w-5" />
    </div>
);

const MapManager = ({ teamMembers, companyLocation, selectedMember, focusedPoint, focusTrigger }: { 
    teamMembers: UserProfile[], 
    companyLocation: { lat: number, lng: number } | null, 
    selectedMember: UserProfile | null,
    focusedPoint: { lat: number, lng: number } | null,
    focusTrigger?: number
}) => {
    const map = useMap();

    useEffect(() => {
        if (!map || !window.google) return;
        
        if (focusedPoint) {
            map.panTo(focusedPoint);
            map.setZoom(19); // Zoom mais próximo para pontos específicos
            return;
        }

        if (selectedMember?.lastLocation) {
            map.panTo({ lat: selectedMember.lastLocation.latitude, lng: selectedMember.lastLocation.longitude });
            map.setZoom(17);
        }
    }, [map, selectedMember, focusedPoint, focusTrigger]);

    useEffect(() => {
        if (!map || typeof window === 'undefined' || !window.google || selectedMember) return;
        const membersWithLocation = teamMembers.filter(m => m.lastLocation);
        if (membersWithLocation.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            membersWithLocation.forEach(member => {
                bounds.extend(new window.google.maps.LatLng(member.lastLocation!.latitude, member.lastLocation!.longitude));
            });
            if (companyLocation) bounds.extend(new window.google.maps.LatLng(companyLocation.lat, companyLocation.lng));
            map.fitBounds(bounds, 100);
        } else if (companyLocation) {
            map.setCenter(companyLocation);
            map.setZoom(14);
        }
    }, [map, teamMembers, companyLocation, selectedMember]);

    return null;
};

export default function TeamMap({ 
    focusedMember, 
    focusedPoint,
    teamMembers, 
    focusTrigger,
    routeHistory = [],
    isHistoryMode = false,
    selectedDate = new Date(),
    onDateChange,
    onSearchHistory,
    isSearchingHistory = false,
    onDistanceChange
}: { 
    focusedMember: UserProfile | null, 
    focusedPoint?: {lat: number, lng: number} | null,
    teamMembers: UserProfile[], 
    focusTrigger?: number,
    routeHistory?: any[],
    isHistoryMode?: boolean,
    selectedDate?: Date,
    onDateChange?: (date: Date) => void,
    onSearchHistory?: (member: UserProfile, date: Date) => void,
    isSearchingHistory?: boolean,
    onDistanceChange?: (distance: number | null) => void
}) {
  if (typeof window === 'undefined') return null;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { firebase, company, userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'developer';
  const { toast } = useToast();
  const [companyLocation, setCompanyLocation] = useState<{ lat: number, lng: number } | null>(null);
  const defaultCenter = { lat: -10.9472, lng: -37.0731 };

  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(true);
  const [isClusteringEnabled, setIsClusteringEnabled] = useState(true);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite'>('roadmap');
  
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [selectedHistoryPoint, setSelectedHistoryPoint] = useState<any | null>(null);

  useEffect(() => {
    if (onDistanceChange) onDistanceChange(totalDistance);
  }, [totalDistance, onDistanceChange]);

  useEffect(() => {
    if (routeHistory && routeHistory.length > 0) {
        const path = routeHistory.map((p: any) => ({ lat: p.latitude, lng: p.longitude }));
        setSelectedHistoryPoint(null); // Reset when history changes
        
        if (window.google && window.google.maps.geometry) {
            let total = 0;
            for (let i = 0; i < path.length - 1; i++) {
                total += window.google.maps.geometry.spherical.computeDistanceBetween(
                    new window.google.maps.LatLng(path[i]), 
                    new window.google.maps.LatLng(path[i+1])
                );
            }
            setTotalDistance(total / 1000);
        }
    } else {
        setTotalDistance(null);
    }
  }, [routeHistory]);

  useEffect(() => {
    if (company && apiKey) {
        const address = `${company.street}, ${company.number || ''}, ${company.city}, ${company.state}`;
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'OK') setCompanyLocation(data.results[0].geometry.location);
            });
    }
  }, [company, apiKey]);
  
  useEffect(() => {
    if (focusedMember) setSelectedMember(focusedMember);
  }, [focusedMember, focusTrigger]);

  useEffect(() => {
    if (selectedMember) {
        const updated = teamMembers.find(m => m.uid === selectedMember.uid);
        if (updated) setSelectedMember(updated);
    }
  }, [teamMembers]);


  const memberClusters = useMemo(() => {
    const clusters: { [key: string]: UserProfile[] } = {};
    teamMembers.filter(m => m.lastLocation).forEach(member => {
        const key = `${member.lastLocation!.latitude.toFixed(4)},${member.lastLocation!.longitude.toFixed(4)}`;
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(member);
    });
    return Object.values(clusters);
  }, [teamMembers]);

  const renderMarkers = () => {
    const members = teamMembers.filter(m => m.lastLocation);
    if (!isClusteringEnabled) {
      return members.map(m => (
        <AdvancedMarker key={m.uid} position={{ lat: m.lastLocation!.latitude, lng: m.lastLocation!.longitude }} onClick={() => setSelectedMember(m)}>
            <MarkerIcon member={m} showName={showNames}/>
        </AdvancedMarker>
      ));
    }
    return memberClusters.map((cluster) => {
        const pos = { lat: cluster[0].lastLocation!.latitude, lng: cluster[0].lastLocation!.longitude };
        const key = `${pos.lat},${pos.lng}`;
        if (cluster.length > 1) {
            const expanded = expandedCluster === key;
            return (
                <React.Fragment key={key}>
                    {!expanded ? (
                        <AdvancedMarker position={pos} onClick={() => setExpandedCluster(key)}><ClusterIcon count={cluster.length} /></AdvancedMarker>
                    ) : (
                        cluster.map((m, i) => (
                            <AdvancedMarker key={m.uid} position={{ lat: pos.lat + Math.cos(i) * 0.0002, lng: pos.lng + Math.sin(i) * 0.0002 }} onClick={() => setSelectedMember(m)}>
                                <MarkerIcon member={m} showName={true} />
                            </AdvancedMarker>
                        ))
                    )}
                </React.Fragment>
            );
        }
        return <AdvancedMarker key={cluster[0].uid} position={pos} onClick={() => setSelectedMember(cluster[0])}><MarkerIcon member={cluster[0]} showName={showNames}/></AdvancedMarker>;
    });
  };

  return (
      <div className="w-full h-full relative bg-muted overflow-hidden">
         <Map defaultCenter={defaultCenter} defaultZoom={12} gestureHandling={'greedy'} disableDefaultUI={true} mapId="xcot-team-map" mapTypeId={mapTypeId} onClick={() => setSelectedMember(null)}>
             {companyLocation && <AdvancedMarker position={companyLocation}><CompanyMarkerIcon /></AdvancedMarker>}
             {isHistoryMode && routeHistory.length > 0 && <RouteHistoryPath points={routeHistory} onPointSelect={setSelectedHistoryPoint} />}
             {renderMarkers()}
             {selectedHistoryPoint && (
                <InfoWindow 
                    position={{ lat: selectedHistoryPoint.latitude, lng: selectedHistoryPoint.longitude }} 
                    onCloseClick={() => setSelectedHistoryPoint(null)}
                    headerDisabled={true}
                >
                    <div className="p-1 space-y-2 min-w-[200px] text-slate-900 relative">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-1 -right-1 h-6 w-6 text-slate-400 hover:text-slate-600 z-10"
                            onClick={() => setSelectedHistoryPoint(null)}
                        >
                            <span className="text-lg">×</span>
                        </Button>

                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 pr-6">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-sky-600" />
                                <span className="font-semibold text-sm">
                                    {selectedHistoryPoint.timestamp ? formatBrasilia(ensureISO(selectedHistoryPoint.timestamp), 'HH:mm:ss') : '--:--:--'}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700">
                                {selectedHistoryPoint.timestamp ? formatBrasilia(ensureISO(selectedHistoryPoint.timestamp), 'dd/MM/yyyy') : '--/--/----'}
                            </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex flex-col">
                                <span className="text-slate-500">Velocidade</span>
                                <span className="font-semibold text-slate-900">{Math.round(selectedHistoryPoint.speed || 0)} km/h</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-500">Precisão</span>
                                <span className="font-semibold text-slate-900">{selectedHistoryPoint.accuracy?.toFixed(1) || '0'}m</span>
                            </div>
                        </div>

                        <Button 
                            className="w-full text-xs h-8" 
                            variant="secondary"
                            onClick={() => window.open(`https://www.google.com/maps?q&layer=c&cbll=${selectedHistoryPoint.latitude},${selectedHistoryPoint.longitude}`, '_blank')}
                        >
                            <MapViewIcon className="mr-2 h-3 w-3" />
                            Ver Street View
                        </Button>
                    </div>
                </InfoWindow>
             )}
             {focusedPoint && (
                <AdvancedMarker position={focusedPoint} zIndex={1000}>
                    <div className="relative flex items-center justify-center">
                        <div className="absolute h-8 w-8 bg-primary/40 rounded-full animate-ping" />
                        <div className="relative h-4 w-4 bg-primary border-2 border-white rounded-full shadow-lg" />
                    </div>
                </AdvancedMarker>
             )}
             <MapManager teamMembers={teamMembers} companyLocation={companyLocation} selectedMember={selectedMember} focusedPoint={focusedPoint || null} focusTrigger={focusTrigger} />
          </Map>
 

          <div className="absolute bottom-4 left-4 z-10 flex gap-2">
            <Button variant={showNames ? "default" : "outline"} size="icon" onClick={() => setShowNames(!showNames)} className="bg-background/80 shadow-md h-9 w-9"><Eye className="h-4 w-4" /></Button>
            <Button variant={isClusteringEnabled ? "default" : "outline"} size="icon" onClick={() => setIsClusteringEnabled(!isClusteringEnabled)} className="bg-background/80 shadow-md h-9 w-9"><Users className="h-4 w-4" /></Button>
            <Button variant={mapTypeId === 'roadmap' ? 'default' : 'outline'} size="icon" onClick={() => setMapTypeId('roadmap')} className="bg-background/80 shadow-md h-9 w-9"><MapViewIcon className="h-4 w-4" /></Button>
            <Button variant={mapTypeId === 'satellite' ? 'default' : 'outline'} size="icon" onClick={() => setMapTypeId('satellite')} className="bg-background/80 shadow-md h-9 w-9"><Globe className="h-4 w-4" /></Button>
         </div>
    </div>
  );
}
