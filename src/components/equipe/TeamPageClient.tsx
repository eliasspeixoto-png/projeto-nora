
"use client";
// VERSION: 2026-03-24-FIX-03
import React, { useState, useEffect, useCallback, useMemo } from 'react';
console.log('TEAM PAGE CLIENT LOADED - VERSION 4.5.2');
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Search, Plus, User, MapPin, Navigation, RefreshCw, Loader2, Edit, ChevronUp, ChevronDown, Smartphone, Laptop, Package, MoreVertical, Eye, Users, UserPlus
} from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';
import { useSortableData } from '@/hooks/use-sortable-data';
import { updateTeamMember, getTeamMembersOnce, getTeamMembers } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import AddEditMemberDialog from './add-edit-member-dialog';
import { format, parseISO, formatDistance, isBefore, subMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn, formatBrasilia, getBrasiliaDate, formatDisplayName } from '@/lib/utils';
import { APIProvider } from '@vis.gl/react-google-maps';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import HistoryTimeline from '@/components/equipe/HistoryTimeline';
import MemberDetails from '@/components/equipe/MemberDetails';



const ensureISO = (date: any): string => {
  if (!date) return "";
  if (typeof date === 'string') return date;
  if (date && typeof date.toDate === 'function') {
    return date.toDate().toISOString();
  }
  return String(date);
};

const formatLastSeen = (dateInput?: any) => {
  if (!dateInput) return "Nunca";
  try {
    const isoDate = ensureISO(dateInput);
    const date = parseISO(isoDate);
    // Usamos a data de Brasília como referência para o cálculo de "atrás"
    return formatDistance(date, getBrasiliaDate(), { addSuffix: true, locale: ptBR });
  } catch (e) {
    return "Data inválida";
  }
}


function TeamList({ onMemberClick, onRefresh, teamMembers, isLoading, focusedMember, totalDistance, isSearchingHistory, isHistoryMode, onSearchHistory, selectedDate, onDateChange }: { 
    onMemberClick: (member: UserProfile) => void, 
    onRefresh: () => void, 
    teamMembers: UserProfile[], 
    isLoading: boolean, 
    focusedMember: UserProfile | null,
    totalDistance: number | null,
    isSearchingHistory: boolean,
    isHistoryMode: boolean,
    onSearchHistory: (member: UserProfile, date: Date) => void,
    selectedDate: Date,
    onDateChange: (date: Date) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);

  const { items: sortedMembers, requestSort, sortConfig } = useSortableData(teamMembers, { key: 'isOnline', direction: 'desc' });
  const [filteredMembers, setFilteredMembers] = useState<UserProfile[]>([]);
  const { firebase } = useAuth();

  useEffect(() => {
    const searchStr = (searchTerm || '').trim().toLowerCase();
    
    if (!searchStr) {
      setFilteredMembers([...sortedMembers].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
      return;
    }

    const filtered = sortedMembers
      .filter(member =>
        (member.displayName || '').toLowerCase().includes(searchStr) ||
        (member.email || '').toLowerCase().includes(searchStr) ||
        (member.role || '').toLowerCase().includes(searchStr)
      )
      .sort((a, b) => {
        const nameA = (a.displayName || '').toLowerCase();
        const nameB = (b.displayName || '').toLowerCase();
        const emailA = (a.email || '').toLowerCase();
        const emailB = (b.email || '').toLowerCase();
        const roleA = (a.role || '').toLowerCase();
        const roleB = (b.role || '').toLowerCase();

        const aExact = nameA === searchStr || emailA === searchStr || roleA === searchStr;
        const bExact = nameB === searchStr || emailB === searchStr || roleB === searchStr;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = nameA.startsWith(searchStr) || emailA.startsWith(searchStr) || roleA.startsWith(searchStr);
        const bStarts = nameB.startsWith(searchStr) || emailB.startsWith(searchStr) || roleB.startsWith(searchStr);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return (a.displayName || '').localeCompare(b.displayName || '');
      });

    setFilteredMembers(filtered);
  }, [searchTerm, sortedMembers]);

  const handleEditMember = (member: UserProfile) => {
    setEditingMember(member);
    setDialogOpen(true);
  };

  const handleUpdateMember = (uid: string, data: Partial<Omit<UserProfile, 'uid' | 'email'>>) => {
    updateTeamMember(firebase.db, uid, data);
    setDialogOpen(false);
    onRefresh();
  };

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-3xl rounded-r-xl rounded-l-none border border-border/40 shadow-premium overflow-hidden">
      <header className="p-8 pb-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Mapa Equipe
            </h3>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-40">Monitoramento em Tempo Real</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading} className="rounded-xl hover:bg-primary/5">
            <RefreshCw className={cn("h-4 w-4 text-primary/60", isLoading && "animate-spin")} />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 bg-primary/5 p-3 rounded-2xl">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            {teamMembers.length} MEMBROS
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            {teamMembers.filter(m => m.isOnline).length} ONLINE
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20" />
          <Input
            placeholder="BUSCAR COLABORADOR..."
            className="pl-11 h-12 rounded-2xl bg-background/50 border-border/40 font-semibold uppercase text-[10px] tracking-widest placeholder:opacity-30 focus:ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 pt-0 space-y-3">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center opacity-20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center opacity-20 text-center px-8">
              <UserPlus className="h-10 w-10 mb-2" />
              <p className="text-[10px] font-semibold uppercase tracking-widest">Ninguém encontrado</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div key={member.uid} className="space-y-2">
                <div 
                  className={cn(
                    "group relative p-4 rounded-xl border border-border/40 bg-background/20 hover:bg-primary/5 transition-all cursor-pointer",
                    focusedMember?.uid === member.uid && "bg-primary/10 border-primary/20 ring-1 ring-primary/20"
                  )}
                  onClick={() => onMemberClick(member)}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-background shadow-lg">
                        <AvatarImage src={member.avatarUrl} alt={member.displayName} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                          {member.displayName?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                        member.isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-400"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold uppercase text-xs tracking-tight truncate">
                        {formatDisplayName(member.displayName)}
                      </h4>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase opacity-40">
                        {member.role || 'Membro'} • {member.isOnline ? 'Ativo agora' : formatLastSeen((member as any).lastSeen)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/20 text-primary" onClick={() => onMemberClick(member)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/20 text-primary" onClick={() => handleEditMember(member)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/20 text-primary">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-border/40 bg-background/80 backdrop-blur-3xl shadow-premium">
                          <DropdownMenuItem className="rounded-xl font-semibold uppercase text-[10px] tracking-widest"><Navigation className="mr-2 h-3.5 w-3.5" />Localização</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive rounded-xl font-semibold uppercase text-[10px] tracking-widest"><Plus className="mr-2 h-3.5 w-3.5 rotate-45" />Remover</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {focusedMember?.uid === member.uid && (
                  <div className="px-2 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="rounded-xl border border-border/40 bg-background/20 p-4">
                      <MemberDetails 
                        member={member}
                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
                        totalDistance={totalDistance}
                        isSearching={isSearchingHistory}
                        showRoute={isHistoryMode}
                        onRouteToggle={() => onSearchHistory(member, selectedDate)}
                        selectedDate={selectedDate}
                        onDateSelect={onDateChange}
                        isAdmin={true}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <AddEditMemberDialog
        isOpen={isDialogOpen}
        setOpen={setDialogOpen}
        onInviteSuccess={onRefresh}
        onUpdateMember={handleUpdateMember}
        memberToEdit={editingMember}
      />
    </div>
  )
}


export default function TeamPageClient({ children }: { children: React.ReactNode }) {
  const [focusedMember, setFocusedMember] = useState<UserProfile | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const { isMobile } = useIsMobile();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userProfile, company, firebase } = useAuth();
  const { toast } = useToast();

  // History State
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [routeHistory, setRouteHistory] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [totalDistance, setTotalDistance] = useState<number | null>(0);
  const [focusedPoint, setFocusedPoint] = useState<{lat: number, lng: number} | null>(null);

  const handleMemberClick = useCallback((member: UserProfile) => {
    if (focusedMember?.uid === member.uid) {
      setFocusedMember(null);
    } else {
      setFocusedMember(member);
      setFocusTrigger(prev => prev + 1);
      setFocusedPoint(null); // Clear manual point focus when clicking member
      setIsHistoryMode(false);
      setRouteHistory([]);
    }
  }, [focusedMember]);

  const handleSearchHistory = async (member: UserProfile, date: Date) => {
    if (!firebase.db) return;
    setIsSearchingHistory(true);
    try {
        const dateStr = date.toISOString().split('T')[0];
        const token = await firebase.auth.currentUser?.getIdToken();
        const response = await fetch(`/api/equipe/history?uid=${member.uid}&date=${dateStr}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Erro ao carregar histórico');
        
        const data = await response.json();
        const history = data.points || [];
        
        if (history.length === 0) {
            toast({ title: 'Nenhum registro', description: `Não há histórico para esta data.` });
            setRouteHistory([]);
            setTotalDistance(0);
            return;
        }

        // Sort by timestamp
        const sorted = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setRouteHistory(sorted);
        setIsHistoryMode(true);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
        setIsSearchingHistory(false);
    }
  };

  useEffect(() => {
    if (!company?.id || !firebase.db) return;

    setIsLoading(true);
    const unsubscribe = getTeamMembers(firebase.db, company.id, (members) => {
      const membersWithStatus = members.map(member => {
        const fifteenMinutesAgo = subMinutes(new Date(), 15);
        
        const lastLocationTime = (member as any).lastLocationUpdated ? parseISO(ensureISO((member as any).lastLocationUpdated)) : null;
        const lastSeenTime = (member as any).lastSeen ? parseISO(ensureISO((member as any).lastSeen)) : null;
        
        const latestActivity = (lastLocationTime && lastSeenTime) 
          ? (isBefore(lastLocationTime, lastSeenTime) ? lastSeenTime : lastLocationTime)
          : (lastLocationTime || lastSeenTime || new Date(0));

        if (member.isOnline && isBefore(latestActivity, fifteenMinutesAgo)) {
          return { ...member, isOnline: false };
        }
        return member;
      });

      const sortedMembers = membersWithStatus
        .filter(member => member.role !== 'cliente')
        .sort((a, b) => {
          const aOnline = a.isOnline ? 1 : 0;
          const bOnline = b.isOnline ? 1 : 0;
          if (aOnline !== bOnline) return bOnline - aOnline;

          const roleOrder = { 'admin': 0, 'supervisor': 1, 'tecnico': 2, 'surveyor': 3 };
          return (roleOrder[a.role as keyof typeof roleOrder] || 4) -
            (roleOrder[b.role as keyof typeof roleOrder] || 4);
        });

      setTeamMembers(sortedMembers);
      setIsLoading(false);
    }, (error) => {
      console.error('Erro ao buscar equipe real-time:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar equipe', description: error.message });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [company?.id, firebase.db, toast]);

  const loadTeamMembers = useCallback(async () => {
    // Placeholder
  }, []);

  const memoizedTeamMembers = useMemo(() => teamMembers, [teamMembers]);

  const mapProps = {
    focusedMember,
    focusedPoint,
    focusTrigger,
    teamMembers: memoizedTeamMembers,
    routeHistory,
    isHistoryMode,
    selectedDate,
    onDateChange: setSelectedDate,
    onSearchHistory: handleSearchHistory,
    isSearchingHistory,
    onDistanceChange: setTotalDistance
  };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} libraries={['marker', 'geometry', 'places']}>
      {isMobile ? (
        <div className="h-full w-full relative bg-background">
          <div className="h-full w-full">
            {children && React.isValidElement(children) ? (
              React.cloneElement(children as React.ReactElement, { ...mapProps, key: 'team-map-mobile' })
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-background/50 backdrop-blur-md">
                <Loader2 className="animate-spin text-primary/40 h-8 w-8" />
              </div>
            )}
          </div>
          <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 w-[85%] h-16 rounded-[2rem] shadow-premium font-semibold text-xs uppercase tracking-[0.2em] bg-primary hover:scale-[1.02] active:scale-95 transition-all">
                {isSheetOpen ? <ChevronDown className="mr-2 h-5 w-5" /> : <Users className="mr-2 h-5 w-5" />}
                {isSheetOpen ? 'Fechar Monitoramento' : 'Explorar Equipe'}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85%] flex flex-col p-0 border-t-0 bg-transparent">
              <div className="h-full bg-background/80 backdrop-blur-3xl rounded-t-[3rem] border border-border/40 shadow-massive overflow-hidden flex flex-col">
                  <div className="w-12 h-1.5 bg-primary/20 rounded-full mx-auto my-4 shrink-0" />
                  <div className="flex-1 overflow-hidden">
                      {isHistoryMode && focusedMember ? (
                          <HistoryTimeline 
                              member={focusedMember}
                              history={routeHistory}
                              onBack={() => { setIsHistoryMode(false); setFocusedPoint(null); }}
                              onPointClick={(p) => {
                                  setFocusedPoint(p);
                                  setFocusTrigger(prev => prev + 1);
                              }}
                              isLoading={isSearchingHistory}
                          />
                      ) : (
                          <TeamList
                              teamMembers={teamMembers}
                              isLoading={isLoading}
                              focusedMember={focusedMember}
                              totalDistance={totalDistance}
                              isSearchingHistory={isSearchingHistory}
                              isHistoryMode={isHistoryMode}
                              onSearchHistory={handleSearchHistory}
                              selectedDate={selectedDate}
                              onDateChange={setSelectedDate}
                              onRefresh={loadTeamMembers}
                              onMemberClick={(member) => {
                                  handleMemberClick(member);
                                  setSheetOpen(false);
                              }}
                          />
                      )}
                  </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      ) : (
          <div className="h-[calc(100vh-56px)] p-0 bg-background/20 overflow-hidden">
              <div className="grid h-full grid-cols-[380px_1fr] gap-[1px]">
                  <div className="h-full overflow-hidden flex flex-col">
                      {isHistoryMode && focusedMember ? (
                          <div className="h-full bg-background/40 backdrop-blur-3xl rounded-r-xl rounded-l-none border border-border/40 shadow-premium overflow-hidden flex flex-col">
                              <HistoryTimeline 
                                  member={focusedMember}
                                  history={routeHistory}
                                  onBack={() => { setIsHistoryMode(false); setFocusedPoint(null); }}
                                  onPointClick={(p) => {
                                      setFocusedPoint(p);
                                      setFocusTrigger(prev => prev + 1);
                                  }}
                                  isLoading={isSearchingHistory}
                              />
                          </div>
                      ) : (
                          <TeamList
                              teamMembers={teamMembers}
                              isLoading={isLoading}
                              focusedMember={focusedMember}
                              totalDistance={totalDistance}
                              isSearchingHistory={isSearchingHistory}
                              isHistoryMode={isHistoryMode}
                              onSearchHistory={handleSearchHistory}
                              selectedDate={selectedDate}
                              onDateChange={setSelectedDate}
                              onRefresh={loadTeamMembers}
                              onMemberClick={handleMemberClick}
                          />
                      )}
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-massive bg-background/40 backdrop-blur-3xl group">
                      {children && React.isValidElement(children) ? (
                          React.cloneElement(children as React.ReactElement, { ...mapProps, key: 'team-map-desktop' })
                      ) : (
                          <div className="h-full w-full flex items-center justify-center bg-background/50 backdrop-blur-md">
                              <Loader2 className="animate-spin text-primary/40 h-10 w-10" />
                          </div>
                      )}
                      
                      <div className="absolute top-6 left-6 p-4 rounded-2xl bg-background/40 backdrop-blur-3xl border border-border/40 shadow-premium flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary">
                              <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-40">Modo de Visualização</p>
                              <h4 className="text-xs font-semibold uppercase">Monitoramento Satélite</h4>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </APIProvider>
  );
}


