"use client";

import { useState } from "react";
import { Copy, Loader2, QrCode, Smartphone, RefreshCw, CheckCircle2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

export default function WhatsappConnectionTab() {
    const { toast } = useToast();
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

    // Simulated states for automations
    const [autoQuote, setAutoQuote] = useState(true);
    const [autoOs, setAutoOs] = useState(true);
    const [notifyTech, setNotifyTech] = useState(false);

    const apiData = {
        token: "nora_sk_live_98a7sd98f7as9d8f7sa9df87",
        instanceName: "NORA_MAIN_INSTANCE",
    };

    const fetchStatus = async () => {
        try {
            // Tenta obter o QR Code real do servidor Baileys local (porta 8080) ou da rota API
            let res = await fetch('http://localhost:8080/qr', { cache: 'no-store' });
            if (!res.ok) {
                res = await fetch('/api/whatsapp/qr?companyId=DEFAULT_COMPANY', { cache: 'no-store' });
            }
            const data = await res.json();

            if (data.connected) {
                setIsConnected(true);
                setShowQR(false);
                return;
            } 
            
            if (data.qrCodeBase64) {
                const src = data.qrCodeBase64.startsWith('data:') ? data.qrCodeBase64 : `data:image/png;base64,${data.qrCodeBase64}`;
                setQrCodeUrl(src);
            }
            setShowQR(true);
        } catch (error) {
            console.error('Erro ao consultar status do WhatsApp:', error);
            setShowQR(true);
        }
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await fetchStatus();
            setShowQR(true);
            toast({
                title: "QR Code Gerado",
                description: "Escaneie o código com o WhatsApp no seu celular para conectar.",
            });
        } catch (error) {
            setShowQR(true);
            toast({
                title: "QR Code Gerado",
                description: "Escaneie o código com o WhatsApp no seu celular para conectar.",
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSimulateScan = () => {
        setShowQR(false);
        setIsConnected(true);
        toast({
            title: "Conectado com Sucesso!",
            description: "O WhatsApp foi vinculado e as automações estão ativas.",
        });
    };

    const handleDisconnect = async () => {
        try {
            await fetch('/api/whatsapp/qr?companyId=DEFAULT_COMPANY', { method: 'DELETE' });
            setIsConnected(false);
            setShowQR(false);
            setQrCodeUrl(null);
            toast({
                title: "Desconectado",
                description: "A instância do WhatsApp foi removida.",
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao desconectar" });
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
                        ) : (
                            <Badge className="bg-muted text-muted-foreground border-border/40 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest text-[10px]">
                                Desconectado
                            </Badge>
                        )}
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-100">
                        Vincule um número para envios automáticos
                    </p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Painel Esquerdo - Conexão */}
                    <div className="space-y-6">
                        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[320px] relative overflow-hidden group">
                           
                           {!isConnected && !showQR && (
                                <div className="text-center space-y-4 relative z-10 w-full max-w-xs mx-auto">
                                    <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto shadow-sm border border-border/40 mb-6">
                                        <QrCode className="w-8 h-8 text-muted-foreground opacity-50" />
                                    </div>
                                    <h4 className="font-semibold text-lg">Pronto para conectar</h4>
                                    <p className="text-xs text-muted-foreground font-medium text-balance">
                                        Vincule seu WhatsApp corporativo para enviar orçamentos e O.S. diretamente do sistema sem cliques extras.
                                    </p>
                                    <Button 
                                        onClick={handleConnect} 
                                        disabled={isConnecting}
                                        className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-premium bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                                    >
                                        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                                        Gerar QR Code
                                    </Button>
                                </div>
                            )}

                            {showQR && !isConnected && (
                                <div className="text-center space-y-6 relative z-10 w-full flex flex-col items-center">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/40 inline-block relative cursor-pointer" onClick={handleSimulateScan} title="Clique no QR para simular leitura">
                                        {/* Dynamic or Fallback QR Code */}
                                        <img src={qrCodeUrl || "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SimulaConexaoNora"} alt="QR Code" className="w-48 h-48 opacity-90 object-contain mx-auto" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                                            <span className="bg-background/90 text-primary text-[10px] uppercase font-bold py-1 px-3 rounded-full backdrop-blur-md">Clique para Simular Leitura</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm">Escaneie o QR Code</h4>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">1. Abra o WhatsApp no celular</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">2. Menu {'>'} Aparelhos Conectados</p>
                                    </div>
                                    <Button variant="ghost" onClick={() => setShowQR(false)} className="text-[10px] uppercase font-bold tracking-widest h-8 rounded-full">
                                        Cancelar
                                    </Button>
                                </div>
                            )}

                            {isConnected && (
                                <div className="text-center space-y-6 relative z-10 w-full">
                                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto shadow-sm border border-green-500/20 mb-2 relative">
                                        <div className="absolute inset-0 rounded-full border-2 border-green-500/30 border-t-green-500 animate-spin" />
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-xl text-green-600 dark:text-green-500">Conexão Ativa</h4>
                                        <p className="text-xs font-semibold text-muted-foreground">Instância: <span className="text-foreground">{apiData.instanceName}</span></p>
                                        <p className="text-xs font-semibold text-muted-foreground">Bateria: <span className="text-foreground">98%</span> • Online</p>
                                    </div>
                                    <div className="flex gap-2 justify-center pt-2">
                                        <Button variant="outline" onClick={handleDisconnect} className="h-10 rounded-xl font-bold text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 border-dashed">
                                            Desconectar Sessão
                                        </Button>
                                        <Button variant="secondary" onClick={() => toast({ title: "Sincronizando...", description: "Status verificado com sucesso." })} className="h-10 rounded-xl w-10 p-0">
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Detalhes da API (Apenas para Admin ver) */}
                        <div className="space-y-3">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Detalhes da Integração (API)</Label>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input value={apiData.instanceName} readOnly className="h-10 text-xs font-mono bg-muted/30 border-border/40 focus-visible:ring-0" />
                                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiData.instanceName)} className="h-10 w-10 shrink-0"><Copy className="w-3 h-3" /></Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input value="••••••••••••••••••••••••" readOnly type="password" className="h-10 text-xs font-mono bg-muted/30 border-border/40 focus-visible:ring-0" />
                                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiData.token)} className="h-10 w-10 shrink-0"><Copy className="w-3 h-3" /></Button>
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

