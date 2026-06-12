"use client";
import React, { ReactNode, useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    Settings,
    LogOut,
    ChevronDown,
    Bot,
    Repeat,
    Crown,
    Copy,
    Check,
    Smartphone,
    Mail as MailIcon,
    Upload,
    AlertTriangle,
    X,
    CreditCard,
    FileText,
    Download,
    ArrowLeft,
    Trash2,
} from "lucide-react";
import { useAuth } from '@/firebase/auth/use-user';
import { getAccessibleMenuItems, canAccessPage, MenuItem } from "@/lib/permissions";
import { UserProfile } from "@/lib/data";
import { getTeamMembers, updateCompany } from "@/lib/firebase/firestore";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubContent,
    useSidebar,
    SidebarTrigger,
    SidebarMenuBadge,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuPortal,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import dynamic from "next/dynamic";
const NoraAssistant = dynamic(() => import("@/components/NoraAssistant"), { 
    ssr: false,
    loading: () => null
});
import { format, isFuture, formatDistanceToNow, isPast, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function AppNavContent({ onLinkClick }: { onLinkClick?: () => void }) {
    const pathname = usePathname();
    const { isDeveloper, userProfile, company } = useAuth();
    const { unseenTasksCount } = useSidebar();

    if (!userProfile) return null; // Wait for user profile

    const finalMenuItems = useMemo(() => 
        getAccessibleMenuItems(userProfile?.role, company, isDeveloper),
    [userProfile?.role, company, isDeveloper]);

    const bestMatch = useMemo(() => {
        return [...finalMenuItems]
            .filter((m: MenuItem) => !m.subItems) // Considera apenas itens sem sub-itens para cálculo de active simples
            .sort((a, b) => (b.href?.length || 0) - (a.href?.length || 0))
            .find(m => pathname?.startsWith(m.href));
    }, [finalMenuItems, pathname]);

    return (
        <SidebarMenu className="-space-y-[5px] px-2">
            {finalMenuItems.map(({ href, label, icon: Icon, color, page, subItems }: MenuItem) => {
                const isSubMenuActive = subItems?.some((sub: any) => pathname?.startsWith(sub.href)) ?? false;
                const isActive = (!subItems && bestMatch?.href === href) || (subItems && isSubMenuActive);
                const showBadge = page === 'minhas-os' && unseenTasksCount > 0;

                return (
                    <SidebarMenuItem key={label}>
                        {subItems && subItems.length > 0 ? (
                            <SidebarMenuSub open={isSubMenuActive}>
                                <SidebarMenuSubButton
                                    tooltip={label}
                                    className={cn(
                                        "h-9 px-[2px] transition-all duration-500 hover:bg-primary/5 rounded-[10px] group active:scale-95 ml-0",
                                        isSubMenuActive && "!bg-primary/20 backdrop-blur-md shadow-sm border-l-2 border-primary font-bold"
                                    )}
                                    style={{
                                        color: isSubMenuActive ? 'hsl(var(--muted-foreground) / 0.9)' : `hsl(var(--menu-estoque) / 0.45)`,
                                    }}
                                >
                                    <Icon 
                                        className={cn("h-4 w-4 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6", isSubMenuActive && "animate-pulse")} 
                                        style={{ color: isSubMenuActive ? 'inherit' : `hsl(var(--menu-estoque) / 0.45)` }} 
                                    />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{label}</span>
                                </SidebarMenuSubButton>
                                <SidebarMenuSubContent className="ml-[10px] pl-2 -space-y-[3px] my-1">
                                    {subItems.map((subItem: any) => (
                                        <SidebarMenuItem key={subItem.label}>
                                            <Link 
                                                href={subItem.href} 
                                                className={cn(
                                                    "flex items-center gap-2 w-full h-8 px-[2px] rounded-[7px] text-[11px] font-bold uppercase tracking-widest transition-all hover:bg-primary/5 hover:translate-x-1 group/sub",
                                                    pathname?.startsWith(subItem.href) ? "!bg-primary/20 text-primary font-bold shadow-sm" : "text-muted-foreground/60"
                                                )}
                                                onClick={onLinkClick} 
                                            >
                                                <subItem.icon className={cn("h-3.5 w-3.5 opacity-40 transition-all group-hover/sub:opacity-100", pathname?.startsWith(subItem.href) && "opacity-100")} />
                                                <span>{subItem.label}</span>
                                            </Link>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenuSubContent>
                            </SidebarMenuSub>
                        ) : (
                            <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={label}
                                onClick={onLinkClick}
                                className={cn(
                                    "h-9 px-[2px] transition-all duration-500 hover:bg-primary/5 group active:scale-95 rounded-[10px] ml-0",
                                    isActive && "!bg-primary/20 backdrop-blur-md shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)] border-l-2 border-primary font-bold"
                                )}
                                style={{
                                    color: isActive ? 'hsl(var(--muted-foreground))' : `hsl(var(--menu-estoque) / 0.45)`,
                                }}
                            >
                                <Link href={href} className="flex items-center gap-3">
                                    <Icon 
                                        className={cn("h-4 w-4 transition-all duration-700 group-hover:scale-110 group-hover:rotate-12", isActive && "animate-pulse")} 
                                        style={{ color: isActive ? 'inherit' : `hsl(var(--menu-estoque) / 0.45)` }} 
                                    />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{label}</span>
                                    {showBadge && (
                                        <SidebarMenuBadge className="bg-rose-500/90 text-white font-bold scale-75 rounded-full shadow-lg">
                                            {unseenTasksCount}
                                        </SidebarMenuBadge>
                                    )}
                                </Link>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}

function CompanyLogo({ distributorMember }: { distributorMember?: UserProfile | null }) {
    const { company, userProfile } = useAuth();
    const defaultLogo = "https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20transparente.png?alt=media&token=2d5b0b94-7dd8-47e2-9d6b-32779ad80b84";

    const isDistributor = userProfile?.role === 'distribuidor';
    const isSalesperson = userProfile?.role === 'vendedor';

    const logoUrl = isDistributor 
        ? userProfile?.logoUrl 
        : (isSalesperson && distributorMember?.logoUrl) 
            ? distributorMember.logoUrl 
            : company?.logoUrl;

    const logoAlt = isDistributor 
        ? userProfile?.displayName 
        : (isSalesperson && distributorMember?.displayName)
            ? distributorMember.displayName
            : company?.name;

    return (
        <SidebarHeader className="h-[100px] lg:h-[120px] flex items-center justify-center p-8 bg-background/40 backdrop-blur-xl border-b border-border/40 shadow-sm sticky top-0 z-10">
            <div className="w-full h-full max-w-[220px] flex items-center justify-center pointer-events-none select-none overflow-hidden drop-shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <img
                    src={logoUrl || defaultLogo}
                    alt={logoAlt || "Logotipo da Empresa"}
                    className="max-h-full max-w-full object-contain transition-all duration-700 hover:scale-[1.05] hover:brightness-110"
                />
            </div>
        </SidebarHeader>
    );
}

const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return (name.substring(0, 2) || "U").toUpperCase();
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const { user, userProfile, signOut, isDeveloper, company, firebase, setCompany, isSubscriptionExpired, subscriptionWarningDays, stopImpersonating, impersonatedCompany } = useAuth();
    const router = useRouter();
    const { setOpenMobile } = useSidebar();
    const [isAssistantOpen, setAssistantOpen] = useState(false);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);
    const [dialogStep, setDialogStep] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | null>(null);
    const [isRenewalDialogOpen, setRenewalDialogOpen] = useState(false);
    const [isSubscriptionAlertOpen, setSubscriptionAlertOpen] = React.useState(true);
    const { canInstall, installPrompt } = usePWAInstall();
    const [isInstalled, setIsInstalled] = useState(false);

    const [distributorMember, setDistributorMember] = useState<UserProfile | null>(null);
    const isSalesperson = userProfile?.role === 'vendedor';

    useEffect(() => {
        if (isSalesperson && userProfile?.companyId && firebase.db) {
            const fetchDistributor = async () => {
                const unsub = getTeamMembers(firebase.db, userProfile.companyId!, (res) => {
                    const dist = res.find(m => m.role === 'distribuidor');
                    if (dist) setDistributorMember(dist);
                }, () => {});
                return unsub;
            };
            const unsubPromise = fetchDistributor();
            return () => {
                unsubPromise.then(unsub => unsub && unsub());
            }
        }
    }, [isSalesperson, userProfile?.companyId, firebase.db]);

    const hasSettingsAccess = userProfile && ['admin', 'supervisor', 'distribuidor'].includes(userProfile.role);
    const hasTrashAccess = userProfile && canAccessPage(userProfile.role, 'lixeira', company);

    const headerText = userProfile?.role === 'distribuidor' 
        ? userProfile?.displayName 
        : (isSalesperson && distributorMember?.displayName)
            ? distributorMember.displayName
            : company?.name || 'Plataforma';

    const headerColor = userProfile?.role === 'distribuidor' 
        ? userProfile?.nameColor 
        : (isSalesperson && distributorMember?.nameColor)
            ? distributorMember.nameColor
            : company?.logoFontColor;


    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);
        }
    }, []);

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    const handleLinkClick = () => {
        setOpenMobile(false);
    };

    const handlePlanChange = async (plan: 'Essencial' | 'Profissional' | 'Enterprise') => {
        if (!isDeveloper || !company) return;

        let planPrice = 0;
        if (plan === 'Essencial') planPrice = 69.90;
        if (plan === 'Profissional') planPrice = 189.90;

        try {
            await updateCompany(firebase.db, company.id, { plan, planPrice });
            setCompany(prev => prev ? { ...prev, plan, planPrice } : null);
            toast({
                title: "Plano Alterado!",
                description: `O plano da empresa foi alterado para ${plan}.`,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao alterar plano",
                description: error.message,
            });
        }
    };

    const openRenewalDialog = () => {
        setDialogStep(1);
        setPaymentMethod(null);
        setRenewalDialogOpen(true);
    }

    const generatePixCode = () => {
        if (!company?.planPrice) return '';

        const pixKey = "079999875081"; // Celular
        const merchantName = "ESP TEC INSTALACOES".substring(0, 25);
        const merchantCity = "SAO PAULO".substring(0, 15);
        const amount = company.planPrice.toFixed(2);
        const txid = "***";

        const payloadFormatIndicator = "000201";
        const pointOfInitiationMethod = "010212"; // Static QR Code
        const cnpjNumeros = company.cnpj ? company.cnpj.replace(/\D/g, '') : "30375032000132";
        const merchantAccountInfo = `26${("0014br.gov.bcb.pix01" + cnpjNumeros.length.toString().padStart(2, '0') + cnpjNumeros).length.toString().padStart(2, '0')}0014br.gov.bcb.pix01${cnpjNumeros.length.toString().padStart(2, '0')}${cnpjNumeros}`;

        const merchantCategoryCode = "52040000";
        const transactionCurrency = "5303986";
        const transactionAmount = `54${String(amount).length.toString().padStart(2, '0')}${amount}`;
        const countryCode = "5802BR";
        const merchantNameField = `59${String(merchantName).padStart(2, '0')}${merchantName}`;
        const merchantCityField = `60${String(merchantCity).padStart(2, '0')}${merchantCity}`;
        const additionalDataField = `62070503${txid}`;

        const payloadWithoutCRC = `${payloadFormatIndicator}${pointOfInitiationMethod}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${merchantNameField}${merchantCityField}${additionalDataField}6304`;

        let crc = 0xFFFF;
        for (let i = 0; i < payloadWithoutCRC.length; i++) {
            crc ^= (payloadWithoutCRC.charCodeAt(i) << 8);
            for (let j = 0; j < 8; j++) {
                crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
            }
        }
        crc &= 0xFFFF;

        const crcString = crc.toString(16).toUpperCase().padStart(4, '0');

        const finalPayload = payloadWithoutCRC + crcString;

        const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(finalPayload)}`;
        return qrCodeUrl;
    }

    const handleCopyPixKey = () => {
        const pixKeyToCopy = "079999875081";
        navigator.clipboard.writeText(pixKeyToCopy).then(() => {
            setIsCopied(true);
            toast({ title: "Chave PIX copiada!" });
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleUpdateCompanyStatus = async (field: 'planStatus' | 'paymentStatus', value: string) => {
        if (!isDeveloper || !company) return;
        try {
            await updateCompany(firebase.db, company.id, { [field]: value });
            setCompany(prev => prev ? { ...prev, [field]: value } : null);
            toast({ title: "Status Atualizado!", description: `O status de ${field === 'planStatus' ? 'plano' : 'pagamento'} foi atualizado para ${value}.` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Erro ao atualizar status", description: error.message });
        }
    };


    const userDisplayName = userProfile?.displayName || user?.displayName || 'Usuário';
    const userInitials = getInitials(userProfile?.displayName);

    const isTrialActive = company?.plan === 'Periodo Teste';
    const expiryDateStr = isTrialActive ? company?.trialEndsAt : company?.planExpiresAt;

    const renderSubscriptionAlert = () => {
        if (!isSubscriptionAlertOpen || subscriptionWarningDays === null || isSubscriptionExpired) {
            return null;
        }

        let message, linkText;

        if (isTrialActive) {
            message = subscriptionWarningDays <= 0
                ? "Seu período de teste termina hoje."
                : `Seu período de teste termina em ${subscriptionWarningDays} dia${subscriptionWarningDays > 1 ? 's' : ''}.`;
            linkText = "Escolha um plano";
        } else {
            message = subscriptionWarningDays <= 0
                ? "Sua assinatura expira hoje."
                : `Sua assinatura expira em ${subscriptionWarningDays} dia${subscriptionWarningDays > 1 ? 's' : ''}.`;
            linkText = "Renove agora";
        }

        return (
            <div className="bg-yellow-500 text-black p-2 text-sm relative flex items-center justify-center pt-safe">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <p>
                        {message}
                        <Button variant="link" className="p-0 h-auto font-semibold underline text-black ml-1" onClick={openRenewalDialog}>
                            {linkText}
                        </Button>
                        {' '}para não perder o acesso.
                    </p>
                </div>
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-black hover:bg-black/10" onClick={() => setSubscriptionAlertOpen(false)}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    const renderSubscriptionDialog = (isOpen: boolean, setOpen: (open: boolean) => void, title: string, description: string) => {
        if (!isOpen) return null;

        const pixQrUrl = generatePixCode();

        return (
            <Dialog open={isOpen} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className={isSubscriptionExpired ? "text-destructive" : ""}>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    {dialogStep === 1 && (
                        <DialogFooter className="sm:justify-center pt-4">
                            <Button onClick={() => setDialogStep(2)}>Renovar Assinatura</Button>
                        </DialogFooter>
                    )}
                    {dialogStep === 2 && (
                        <div className="pt-4 space-y-4">
                            {!paymentMethod ? (
                                <>
                                    <h3 className="font-semibold text-center">Escolha como pagar</h3>
                                    <Button className="w-full" onClick={() => setPaymentMethod('pix')}>Pagar com PIX</Button>
                                    <Button className="w-full" variant="outline" asChild>
                                        <a href={`https://wa.me/5579999875081?text=${encodeURIComponent("Olá, gostaria de solicitar o boleto para renovação da minha assinatura.")}`} target="_blank" rel="noopener noreferrer">
                                            Solicitar Boleto
                                        </a>
                                    </Button>
                                </>
                            ) : paymentMethod === 'pix' ? (
                                <div className="space-y-4">
                                    {pixQrUrl && (
                                        <div className="flex justify-center">
                                            <Image src={pixQrUrl} alt="QR Code PIX" width={200} height={200} />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Chave PIX (Celular)</Label>
                                        <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/50">
                                            <p className="font-semibold text-sm break-all">079999875081</p>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCopyPixKey}>
                                                {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Esp Tec instalacoes</p>
                                        <p className="text-xs text-muted-foreground">Após o pagamento, envie o comprovante para nosso financeiro.</p>
                                    </div>
                                    <Button className="w-full" asChild>
                                        <a href={`https://wa.me/5579999875081?text=${encodeURIComponent("Olá, estou enviando o comprovante de pagamento da minha assinatura.")}`} target="_blank" rel="noopener noreferrer">
                                            <Upload className="mr-2 h-4 w-4" /> Enviar Comprovante
                                        </a>
                                    </Button>
                                </div>
                            ) : null}
                            <div className="text-center pt-2">
                                <Button variant="link" size="sm" onClick={() => paymentMethod ? setPaymentMethod(null) : setDialogStep(1)}>Voltar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <>
            <Sidebar className="no-print !bg-background/40 backdrop-blur-3xl border-r border-border/40 transition-all duration-500 shadow-md">
                <CompanyLogo distributorMember={distributorMember} />
                <SidebarContent className="no-scrollbar">
                    <AppNavContent onLinkClick={handleLinkClick} />
                </SidebarContent>
                <SidebarFooter className="pb-safe px-4 pt-4 border-t border-border/40 -space-y-[6px]">
                    {hasTrashAccess && (
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip="Lixeira"
                                    onClick={handleLinkClick}
                                    className="hover:bg-rose-500/10 hover:translate-x-1 transition-all h-9 rounded-[10px] px-[2px]"
                                >
                                    <Link href="/lixeira" className="text-muted-foreground/60 hover:text-rose-500 flex items-center gap-3">
                                        <Trash2 className="h-4 w-4" />
                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Lixeira</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    )}
                    {hasSettingsAccess && (
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton 
                                    asChild 
                                    tooltip={userProfile?.role === 'distribuidor' ? 'Minha Conta' : 'Customizações'}
                                    onClick={handleLinkClick}
                                    className="hover:bg-primary/10 hover:translate-x-1 transition-all h-9 rounded-[10px] px-[2px]"
                                >
                                    <Link href="/settings" className="text-muted-foreground/60 hover:text-primary flex items-center gap-3">
                                        <Settings className="h-4 w-4" />
                                        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{userProfile?.role === 'distribuidor' ? 'Minha Conta' : 'Customizações'}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    )}
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton 
                                onClick={handleSignOut}
                                className="hover:bg-rose-500/10 hover:text-rose-500 hover:translate-x-1 transition-all h-9 rounded-[10px] px-[2px]"
                            >
                                <LogOut className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Sair do Sistema</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>

            <div className="flex-1 flex flex-col w-full min-w-0 overflow-x-hidden ml-0">
                {isSubscriptionExpired ? (
                    <div className="bg-red-600 text-white p-2 text-sm relative flex items-center justify-center pt-safe">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <p>
                                Seu acesso expirou.
                                <Button variant="link" className="p-0 h-auto font-semibold underline text-white ml-1" onClick={openRenewalDialog}>
                                    Renove agora
                                </Button>
                                para continuar utilizando o sistema.
                            </p>
                        </div>
                    </div>
                ) : renderSubscriptionAlert()}
                {renderSubscriptionDialog(isRenewalDialogOpen, setRenewalDialogOpen, "Renovar Assinatura", "Selecione um método de pagamento para continuar.")}
                <header className="flex h-12 sm:h-14 items-center justify-between border-b md:border-l border-border/40 md:ml-[-1px] bg-background/40 px-3 sm:px-4 backdrop-blur-3xl lg:px-8 no-print sticky top-0 z-30 pt-safe overflow-hidden transition-all duration-500 shadow-sm">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <SidebarTrigger className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground/60 hover:text-primary transition-colors" />
                    </div>
                    <div className="flex flex-1 justify-center pointer-events-none min-w-0 px-2 group">
                        <h1 className="text-[10px] xs:text-[11px] sm:text-xs md:text-sm font-semibold tracking-[0.4em] transition-all duration-700 truncate text-center" style={{ color: headerColor || 'hsl(var(--muted-foreground))' }}>
                            {headerText}
                        </h1>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        {isDeveloper && impersonatedCompany && (
                            <Button size="sm" onClick={stopImpersonating} variant="outline" className="border-primary text-primary hidden md:flex h-8 text-xs">
                                <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                                Voltar para Painel Dev
                            </Button>
                        )}
                        {!isInstalled && !impersonatedCompany && canInstall && (
                            <Button variant="outline" size="sm" onClick={installPrompt} className="hidden lg:flex h-8 text-xs">
                                <Download className="mr-2 h-3.5 w-3.5" />
                                Instalar App
                            </Button>
                        )}
                        <ModeToggle />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="hidden lg:flex items-center gap-2 h-8 text-xs">
                                    <Crown className="h-3.5 w-3.5" />
                                    <span>Meu Plano</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel>Detalhes da Assinatura</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div className="p-2 text-sm space-y-1">
                                    <p><strong>Plano:</strong> {company?.plan || 'N/A'}</p>
                                    {company?.plan !== 'Periodo Teste' && (
                                        <p><strong>Valor:</strong> {company?.planPrice !== undefined ? `R$ ${company.planPrice.toFixed(2)}/mês` : 'N/A'}</p>
                                    )}
                                    {isTrialActive && expiryDateStr && (
                                        <p className="text-green-600 font-semibold">
                                            <strong>Período de Teste termina em {formatDistanceToNow(parseISO(expiryDateStr), { locale: ptBR })}</strong>
                                        </p>
                                    )}
                                    <p><strong>Próximo vencimento:</strong> {expiryDateStr ? format(parseISO(expiryDateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'N/A'}</p>
                                </div>
                                <DropdownMenuSeparator />
                                {isDeveloper ? (
                                    <>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <Repeat className="mr-2 h-4 w-4" />
                                                <span>Alterar Plano (Dev)</span>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuItem onClick={() => handlePlanChange('Essencial')}>Essencial</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePlanChange('Profissional')}>Profissional</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePlanChange('Enterprise')}>Enterprise</DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <FileText className="mr-2 h-4 w-4" />
                                                <span>Alterar Status Plano (Dev)</span>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('planStatus', 'Ativo')}>Ativo</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('planStatus', 'Pendente')}>Pendente</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('planStatus', 'Vencido')}>Vencido</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('planStatus', 'Cancelado')} className="text-destructive">Cancelado</DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <CreditCard className="mr-2 h-4 w-4" />
                                                <span>Alterar Status Pag. (Dev)</span>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('paymentStatus', 'Pago')}>Pago</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('paymentStatus', 'Pendente')}>Pendente</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateCompanyStatus('paymentStatus', 'Atrasado')} className="text-destructive">Atrasado</DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                    </>
                                ) : (
                                    <DropdownMenuItem asChild>
                                        <a href="mailto:contato@nora.com.br?subject=Solicitação de Mudança de Plano" className="cursor-pointer">
                                            <Repeat className="mr-2 h-4 w-4" />
                                            Solicitar Mudança de Plano
                                        </a>
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={userProfile?.avatarUrl} alt={userDisplayName} />
                                        <AvatarFallback>{userInitials}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{userProfile?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleSignOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Sair</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative md:border-l border-border/40 md:ml-[-1px]">
                    {children}
                </main>
            </div>

            <NoraAssistant isOpen={isAssistantOpen} setOpen={setAssistantOpen} />

            {!isAssistantOpen && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className="fixed bottom-4 right-4 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-50 print:hidden"
                            onClick={() => setAssistantOpen(true)}
                        >
                            <Bot className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                        <p>Converse com a IA para criar, editar e tirar dúvidas sobre seu app.</p>
                    </TooltipContent>
                </Tooltip>
            )}
        </>
    );
}
