"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Loader2, QrCode, Smartphone, RefreshCw, CheckCircle2, Server, AlertCircle, PowerOff, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function WhatsappConnectionTab() {
    const { toast } = useToast();
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
    const [showQR, setShowQR] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    // Configurações de automação
    const [autoQuote, setAutoQuote] = useState(true);
    const [autoOs, setAutoOs] = useState(true);
    const [notifyTech, setNotifyTech] = useState(false);

    const apiData = {
        token: "nora_sk_live_98a7sd98f7as9d8f7sa9df87",
        instanceName: "NORA_MAIN_INSTANCE",
    };

    const fetchStatus = useCallback(async () => {
    try {
        // Base URL para o serviço WhatsApp (Cloud Run ou localhost)
        const baseUrl = process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || 'http://localhost:8080';
        // Tenta obter status do endpoint /qr do serviço WhatsApp
        let res: Response | null = null;
        try {
            res = await fetch(`${baseUrl}/qr`, { cache: 'no-store' });
        } catch (err) {
            // Fallback para rota da API interna do Next.js
            res = await fetch('/api/whatsapp/qr?companyId=DEFAULT_COMPANY', { cache: 'no-store' });
        }


            if (!res || !res.ok) {
                setIsServerOnline(false);
                setIsConnected(false);
                setQrCodeUrl(null);
                return;
            }

            const data = await res.json();
            setIsServerOnline(true);

            if (data.connected) {
                setIsConnected(true);
                setShowQR(false);
                setConnectedPhone(data.phone || null);
                setQrCodeUrl(null);
                return;
            }

            setIsConnected(false);
            if (data.qrCodeBase64) {
                const src = data.qrCodeBase64.startsWith('data:') 
                    ? data.qrCodeBase64 
                    : `data:image/png;base64,${data.qrCodeBase64}`;
                setQrCodeUrl(src);
            } else {
                setQrCodeUrl(null);
            }
        } catch (error) {
            console.error('Erro ao verificar status do WhatsApp:', error);
            setIsServerOnline(false);
            setIsConnected(false);
            setQrCodeUrl(null);
        }
    }, []);

    // Polling a cada 3.5 segundos para atualizar o QR Code e status de conexão
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3500);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await fetchStatus();
            setShowQR(true);
            toast({
                title: "Atualizando QR Code",
                description: "Escaneie o código real exibido na tela com o WhatsApp do seu celular.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro ao conectar",
                description: "Não foi possível comunicar com o servidor de WhatsApp.",
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnectOrReset = async () => {
        setIsResetting(true);
        try {
            // Tenta resetar localmente ou via API
            try {
                await fetch('http://localhost:8080/reset', { method: 'POST' });
            } catch (e) {
                await fetch('/api/whatsapp/qr?companyId=DEFAULT_COMPANY', { method: 'DELETE' });
            }

            setIsConnected(false);
            setShowQR(false);
            setQrCodeUrl(null);
            setConnectedPhone(null);

            toast({
                title: "Sessão Resetada",
                description: "A conexão antiga foi removida. Um novo QR Code pode ser gerado.",
            });
            setTimeout(fetchStatus, 1500);
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao desconectar" });
        } finally {
            setIsResetting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copiado para a área de transferência!" });
    };

    return (
        <div className="flex-1 mt-4 outline-none">
            <div className="h-full bg-background/40 backdrop-blur-3xl rounded-[2rem] border border-border/40 shadow-premium overflow-hidden flex flex-col p-8 gap-8">
                
                <header className="space-y-1">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold uppercase tracking-tighter opacity-80 flex items-center gap-2">
                            <Smartphone className="h-6 w-6 text-green-500" />
                            Conexão WhatsApp
                        </h3>
                        {isConnected ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px]">
                                <CheckCircle2 className="w-3 h-3 mr-1.5 inline" /> Conectado
                            </Badge>
                        ) : isServerOnline === false ? (
                            <Badge variant="destructive" className="px-4 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px]">
                                <PowerOff className="w-3 h-3 mr-1.5 inline" /> Servidor Offline
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px]">
                                Aguardando QR Code
                            </Badge>
                        )}
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-100">
                        Vincule um número para respostas da IA NORA e envios automáticos
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Painel Esquerdo - Conexão */}
                    <div className="space-y-6">
                        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden group">
                           
                           {/* ESTADO 1: SERVIDOR OFFLINE */}
                           {isServerOnline === false && (
                                <div className="text-center space-y-4 relative z-10 w-full max-w-sm mx-auto">
                                    <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto shadow-sm border border-destructive/20 mb-2">
                                        <AlertCircle className="w-8 h-8" />
                                    </div>
                                    <h4 className="font-bold text-base text-destructive">Servidor do WhatsApp Desconectado</h4>
                                    <p className="text-xs text-muted-foreground font-medium">
                                        O serviço do WhatsApp (`start-whatsapp.js`) não está rodando no computador.
                                    </p>
                                    <div className="bg-muted/60 p-3 rounded-2xl border border-border/50 font-mono text-xs flex items-center justify-between text-left">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Terminal className="w-4 h-4 text-primary shrink-0" />
                                            <span className="truncate select-all">npm run whatsapp</span>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard('npm run whatsapp')}>
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                                        Execute o comando acima no terminal para iniciar o serviço
                                    </p>
                                    <Button 
                                        variant="outline" 
                                        onClick={fetchStatus}
                                        className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-widest"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 mr-2" /> Verificar Novamente
                                    </Button>
                                </div>
                            )}

                           {/* ESTADO 2: ONLINE MAS NÃO CONECTADO (MOSTRAR QR CODE REAL OU BOTÃO GERAR) */}
                           {isServerOnline && !isConnected && !showQR && (
                                <div className="text-center space-y-4 relative z-10 w-full max-w-xs mx-auto">
                                    <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto shadow-sm border border-border/40 mb-6">
                                        <QrCode className="w-8 h-8 text-primary opacity-80" />
                                    </div>
                                    <h4 className="font-semibold text-lg">Pronto para conectar</h4>
                                    <p className="text-xs text-muted-foreground font-medium text-balance">
                                        Vincule seu WhatsApp corporativo para a NORA responder clientes por texto e notas de voz automaticamente.
                                    </p>
                                    <Button 
                                        onClick={handleConnect} 
                                        disabled={isConnecting}
                                        className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-premium bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                                    >
                                        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                                        Exibir QR Code
                                    </Button>
                                </div>
                            )}

                            {/* ESTADO 3: EXIBINDO QR CODE REAL */}
                            {isServerOnline && !isConnected && showQR && (
                                <div className="text-center space-y-5 relative z-10 w-full flex flex-col items-center">
                                    {qrCodeUrl ? (
                                        <div className="bg-white p-4 rounded-2xl shadow-md border border-border/40 inline-block relative">
                                            <img 
                                                src={qrCodeUrl} 
                                                alt="QR Code WhatsApp Baileys Real" 
                                                className="w-52 h-52 object-contain mx-auto" 
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-52 h-52 bg-muted/40 rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center p-4">
                                            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                                            <span className="text-xs text-muted-foreground font-semibold">Gerando QR Code oficial...</span>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm">Escaneie com seu Celular</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">1. Abra o WhatsApp no smartphone</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">2. Menu &gt; Aparelhos Conectados &gt; Conectar um Aparelho</p>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => setShowQR(false)} className="text-[10px] uppercase font-bold tracking-widest h-8 rounded-full">
                                            Ocultar
                                        </Button>
                                        <Button variant="outline" onClick={handleDisconnectOrReset} disabled={isResetting} className="text-[10px] uppercase font-bold tracking-widest h-8 rounded-full text-destructive">
                                            {isResetting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                            Gerar Novo QR Code
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ESTADO 4: CONECTADO COM SUCESSO */}
                            {isServerOnline && isConnected && (
                                <div className="text-center space-y-6 relative z-10 w-full">
                                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto shadow-sm border border-green-500/20 mb-2 relative">
                                        <div className="absolute inset-0 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" />
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-xl text-green-600 dark:text-green-500">Conexão WhatsApp Ativa!</h4>
                                        {connectedPhone && (
                                            <p className="text-xs font-semibold text-muted-foreground">Número Vinculado: <span className="text-foreground font-mono font-bold">+{connectedPhone}</span></p>
                                        )}
                                        <p className="text-xs font-semibold text-muted-foreground">Instância: <span className="text-foreground font-mono">NORA_LOCAL_BAILEYS</span></p>
                                        <p className="text-[11px] font-semibold text-green-600 dark:text-green-400">⚡ NORA AI respondendo mensagens e notas de voz em tempo real</p>
                                    </div>
                                    <div className="flex gap-2 justify-center pt-2">
                                        <Button 
                                            variant="outline" 
                                            onClick={handleDisconnectOrReset} 
                                            disabled={isResetting}
                                            className="h-10 rounded-xl font-bold text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 border-dashed"
                                        >
                                            {isResetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Desconectar Sessão
                                        </Button>
                                        <Button variant="secondary" onClick={fetchStatus} className="h-10 rounded-xl w-10 p-0" title="Verificar status">
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Detalhes da API (Apenas para Admin ver) */}
                        <div className="space-y-3">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Detalhes da Integração (API Local)</Label>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input value="http://localhost:8080/qr" readOnly className="h-10 text-xs font-mono bg-muted/30 border-border/40 focus-visible:ring-0" />
                                    <Button variant="outline" size="icon" onClick={() => copyToClipboard('http://localhost:8080/qr')} className="h-10 w-10 shrink-0"><Copy className="w-3 h-3" /></Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input value={apiData.instanceName} readOnly className="h-10 text-xs font-mono bg-muted/30 border-border/40 focus-visible:ring-0" />
                                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiData.instanceName)} className="h-10 w-10 shrink-0"><Copy className="w-3 h-3" /></Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator className="hidden lg:block absolute left-1/2 top-10 bottom-10 w-px bg-border/40" />

                    {/* Painel Direito - Configurações */}
                    <div className="space-y-8 pl-0 lg:pl-8">
                        <div>
                            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                                <Server className="w-4 h-4 text-primary" /> Regras de Envio
                            </h4>
                            <div className="space-y-4">
                                <div className="flex flex-row items-center justify-between rounded-2xl border border-border/40 p-5 bg-background/50 hover:bg-background transition-colors min-w-0">
                                    <div className="space-y-1.5 min-w-0 mr-4">
                                        <Label className="text-sm font-bold truncate block">Enviar Orçamentos ao Gerar</Label>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold max-w-[280px] break-words">
                                            Dispara a proposta gerada em PDF direto para o WhatsApp do cliente.
                                        </p>
                                    </div>
                                    <Switch checked={autoQuote} onCheckedChange={setAutoQuote} className="shrink-0" disabled={!isConnected} />
                                </div>

                                <div className="flex flex-row items-center justify-between rounded-2xl border border-border/40 p-5 bg-background/50 hover:bg-background transition-colors min-w-0">
                                    <div className="space-y-1.5 min-w-0 mr-4">
                                        <Label className="text-sm font-bold truncate block">Notificação de O.S. (Cliente)</Label>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold max-w-[280px] break-words">
                                            Avisa o cliente quando uma Ordem de Serviço foi concluída.
                                        </p>
                                    </div>
                                    <Switch checked={autoOs} onCheckedChange={setAutoOs} className="shrink-0" disabled={!isConnected} />
                                </div>

                                <div className="flex flex-row items-center justify-between rounded-2xl border border-border/40 p-5 bg-background/50 hover:bg-background transition-colors min-w-0">
                                    <div className="space-y-1.5 min-w-0 mr-4">
                                        <Label className="text-sm font-bold truncate block">Alerta Interno (Técnicos)</Label>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold max-w-[280px] break-words">
                                            Avisa o técnico no WhatsApp quando ele recebe uma nova atribuição.
                                        </p>
                                    </div>
                                    <Switch checked={notifyTech} onCheckedChange={setNotifyTech} className="shrink-0" disabled={!isConnected} />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}


