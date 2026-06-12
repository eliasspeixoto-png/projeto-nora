
"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { Check, ArrowRight, Smartphone, UserSquare, Star, ChevronDown, HelpCircle, ShieldCheck, Zap, Globe, MessageSquare, Settings, X, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { allMenuItems } from "@/lib/permissions";
import ParticlesComponent from "@/components/ui/particles";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const plans = [
  {
    name: "Essencial",
    id: "essencial",
    price: "R$ 69,90",
    pricePeriod: "/mês",
    description: "Ideal para profissionais e pequenas operações que buscam organização.",
    cta: "Começar Essencial",
    color: "emerald",
    features: {
      dashboard: true,
      clientes: true,
      orcamentos: true,
      "ordem-de-servico": true,
      visitas: true,
      "minhas-os": true,
      produtos: true,
      financeiro: true,
      equipe: false,
      comodato: false,
      compras: false,
      estoque: false,
      fornecedores: false,
      funcionarios: true,
      relatorios: false,
      fiscal: false,
      marketing: false,
      veiculos: false,
      settings: true,
      mobile_app: false,
      "portal-cliente": false,
    },
  },
  {
    name: "Profissional",
    id: "profissional",
    price: "R$ 129,90",
    pricePeriod: "/mês",
    description: "Potência máxima para empresas em crescimento com equipes externas.",
    cta: "Escalar Agora",
    isPopular: true,
    color: "primary",
    features: {
      dashboard: true,
      clientes: true,
      orcamentos: true,
      "ordem-de-servico": true,
      visitas: true,
      "minhas-os": true,
      produtos: true,
      financeiro: true,
      equipe: true,
      comodato: true,
      compras: true,
      estoque: true,
      fornecedores: true,
      funcionarios: true,
      relatorios: true,
      fiscal: false,
      marketing: false,
      veiculos: true,
      settings: true,
      mobile_app: true,
      "portal-cliente": true,
    },
  },
  {
    name: "Enterprise",
    id: "enterprise",
    price: "Sob Consulta",
    pricePeriod: "",
    description: "Personalização total, suporte prioritário e ferramentas exclusivas.",
    cta: "Falar com Consultor",
    color: "slate",
    features: Object.keys(allMenuItems.reduce((acc: any, curr) => { acc[curr.page] = true; return acc; }, { settings: true, mobile_app: true, "portal-cliente": true })).reduce((acc: any, curr: string) => { acc[curr] = true; return acc; }, {}),
  },
];

const featureRows = [
    ...allMenuItems
    .filter(item => item.page !== 'developer' && item.page !== 'lixeira' && item.page !== 'cliente' && item.page !== 'settings')
    .sort((a,b) => a.label.localeCompare(b.label)),
    { href: "#", label: "Acesso APP Celular", icon: Smartphone, page: "mobile_app", color: "" },
    { href: "/cliente/dashboard", label: "Portal do Cliente", icon: UserSquare, page: "portal-cliente", color: "" },
    { href: "/settings", label: "Sistema Customizável", icon: Settings, page: "settings", color: "" }
];

const faqs = [
    { question: "O NORA funciona sem internet?", answer: "O NORA é uma plataforma cloud, mas nosso WebApp (PWA) permite que técnicos visualizem informações básicas offline. A sincronização completa ocorre assim que o dispositivo detecta conexão." },
    { question: "Como funciona o período de teste?", answer: "Oferecemos 20 dias de acesso total ao plano Profissional para você testar todas as funcionalidades. Não solicitamos cartão de crédito para o teste." },
    { question: "Posso mudar de plano a qualquer momento?", answer: "Sim. Você pode fazer o upgrade ou downgrade do seu plano diretamente nas configurações da sua conta, sem burocracia." },
    { question: "Meus dados estão seguros?", answer: "Utilizamos infraestrutura de nível bancário com criptografia de ponta a ponta e backups diários automatizados via Google Cloud." },
];

const testimonials = [
    { quote: "Mudou o jogo da nossa empresa. Reduzimos perdas em 30%.", name: "Ricardo Mendes", company: "Alerta Segurança", avatar: "https://picsum.photos/seed/tech1/100/100" },
    { quote: "O portal do cliente é o diferencial que nos faz fechar mais contratos.", name: "Fernanda Lima", company: "InstalaPro", avatar: "https://picsum.photos/seed/tech2/100/100" },
    { quote: "Simples, rápido e eficiente. O melhor ERP para serviços do mercado.", name: "André Santos", company: "Santos Elétrica", avatar: "https://picsum.photos/seed/tech3/100/100" },
];

export default function PricingPage() {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const prevTheme = theme;
    setTheme("light");
    return () => {
      if (prevTheme) setTheme(prevTheme);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/30">
      <ParticlesComponent className="absolute inset-0 -z-10 opacity-30" />
      
      {/* Navbar Premium */}
      <header className="fixed top-0 left-0 right-0 h-20 px-6 md:px-12 flex justify-between items-center z-50 bg-background/60 backdrop-blur-3xl border-b border-border/40">
        <div className="flex items-center gap-4">
            <Link href="/" className="transition-transform hover:scale-105 active:scale-95 duration-300">
              <div className="relative h-14 w-32">
                  <Image 
                    src="https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNORA%203%20transparente.png?alt=media&token=2d5b0b94-7dd8-47e2-9d6b-32779ad80b84" 
                    alt="NORA Logo" 
                    fill 
                    style={{objectFit:'contain'}} 
                    priority
                  />
              </div>
            </Link>
            <Badge variant="outline" className="hidden sm:flex h-6 px-3 rounded-full border-primary/20 bg-primary/5 text-primary font-bold text-[8px] uppercase tracking-[0.2em] animate-pulse">
                v4.0
            </Badge>
        </div>
        <div className="flex items-center gap-4 md:gap-8">
            <nav className="hidden lg:flex items-center gap-6">
                <Link href="#planos" className="text-[10px] font-bold uppercase tracking-[0.2em] hover:text-primary transition-colors">Planos</Link>
                <Link href="#comparativo" className="text-[10px] font-bold uppercase tracking-[0.2em] hover:text-primary transition-colors">Comparativo</Link>
                <Link href="#faq" className="text-[10px] font-bold uppercase tracking-[0.2em] hover:text-primary transition-colors">FAQ</Link>
            </nav>
            <Button asChild variant="outline" className="h-10 rounded-2xl border-primary/20 bg-background/40 hover:bg-primary/5 font-bold text-[10px] uppercase tracking-[0.2em]">
              <Link href="/login">Acesso ao Sistema</Link>
            </Button>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden pt-32 relative">
        {/* Atmosfera Elite - Glowing Orbs de fundo */}
        <div className="absolute top-0 -left-64 w-[600px] h-[600px] bg-primary/5 blur-[160px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 -right-64 w-[500px] h-[500px] bg-emerald-500/5 blur-[140px] rounded-full pointer-events-none" />

        {/* Hero Section SEO Focused */}
        <section className="relative px-6 max-w-7xl mx-auto text-center mb-32 md:mb-48">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, cubicBezier: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-semibold font-headline mb-8 text-4xl md:text-6xl lg:text-7xl leading-[1.1] tracking-tighter bg-gradient-to-br from-foreground via-foreground to-foreground/40 bg-clip-text text-transparent drop-shadow-sm">
                Escale sua empresa de serviços com <br className="hidden md:block" />
                <span className="text-primary italic">gestão de alto nível</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground/70 max-w-3xl mx-auto font-medium leading-relaxed mb-10">
                O único ERP desenhado especificamente para empresas de segurança e instalações que buscam eliminar a desorganização e dominar o mercado.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-16 px-12 text-xs bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/30 rounded-2xl font-bold uppercase tracking-[0.2em] transition-all hover:scale-[1.03] relative overflow-hidden group">
                    <Link href="/signup">
                        <span className="relative z-10">Testar Grátis por 20 Dias</span>
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                    </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-16 px-12 text-xs rounded-2xl font-bold uppercase tracking-[0.2em] border-border/40 hover:bg-muted/50 backdrop-blur-xl">
                    <Link href="https://wa.me/5511999999999">Agendar Demonstração</Link>
                </Button>
            </div>
          </motion.div>
        </section>
        
        {/* Showcase Visual - Profissional */}
        <section id="showcase" className="max-w-7xl mx-auto px-6 mb-48 relative">
          <div className="text-center mb-24 space-y-4">
              <Badge variant="outline" className="h-6 px-4 rounded-full border-primary/20 bg-primary/5 text-primary font-bold text-[9px] uppercase tracking-[0.2em] shadow-sm">Experiência NORA</Badge>
              <h2 className="text-4xl md:text-5xl font-semibold font-headline tracking-tight leading-tight">Potência que você vê, <br />facilidade que você sente</h2>
              <p className="text-muted-foreground/60 max-w-2xl mx-auto text-sm md:text-base">Mergulhe em uma interface desenhada para alta performance e controle total.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              {/* Navegação de Recursos */}
              <div className="lg:col-span-4 space-y-6">
                  {[
                    { id: 'mobile', title: 'Operação de Campo', desc: 'Ordens de serviço digitais com sincronização instantânea.', icon: Smartphone },
                    { id: 'dashboard', title: 'Gestão por Dados', desc: 'Métricas de faturamento e produtividade em tempo real.', icon: TrendingUp },
                    { id: 'quote', title: 'Fechamentos Rápidos', desc: 'Orçamentos automatizados que encantam seus clientes.', icon: Check }
                  ].map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ x: 10 }}
                      className="p-8 rounded-[2.5rem] border border-transparent hover:border-primary/20 hover:bg-white/40 hover:backdrop-blur-2xl transition-all cursor-default group shadow-sm hover:shadow-2xl hover:shadow-primary/10"
                    >
                      <div className="flex items-center gap-4 mb-3">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                             <item.icon className="h-4 w-4" />
                          </div>
                          <h4 className="text-sm font-bold uppercase tracking-wider group-hover:text-primary transition-colors">{item.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">{item.desc}</p>
                    </motion.div>
                  ))}
              </div>

              {/* Área de Mockups com Imagens Reais - ELITE VERSION */}
              <div className="lg:col-span-8 relative min-h-[600px] flex items-center justify-center">
                  
                  {/* Floating labels para sensação de profundidade */}
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -left-20 top-20 z-40 bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white shadow-xl hidden xl:flex items-center gap-2"
                  >
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">Sincronizado</span>
                  </motion.div>

                  <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute right-0 bottom-40 z-40 bg-primary text-white px-4 py-2 rounded-2xl shadow-xl hidden xl:flex items-center gap-2"
                  >
                      <Zap className="h-3 w-3 fill-current" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Alta Performance</span>
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: -5 }}
                    viewport={{ once: true }}
                    className="absolute -left-16 -bottom-10 z-30 w-[260px] h-[550px] bg-slate-950 rounded-[3.5rem] border-[10px] border-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden hidden md:block"
                  >
                    <div className="relative h-full w-full bg-background">
                        <Image 
                          src="/assets/showcase-mobile.png" 
                          alt="NORA Mobile App" 
                          fill 
                          className="object-cover object-left-top"
                          priority
                        />
                    </div>
                    {/* Speaker/Camera cutout simulation */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-50 px-4 flex items-center justify-end">
                        <div className="h-1 w-1 rounded-full bg-blue-500/40" />
                    </div>
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative z-20 w-full max-w-4xl aspect-[16/10] bg-background/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/30 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.3)] overflow-hidden group"
                  >
                      <div className="relative h-full w-full bg-muted/20">
                         <Image 
                            src="/assets/showcase-desktop.png" 
                            alt="NORA Dashboard" 
                            fill 
                            className="object-cover object-left-top transition-transform duration-700 group-hover:scale-[1.02]"
                          />
                          {/* Overlay Gradiente Premium */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-white/5 pointer-events-none" />
                      </div>
                  </motion.div>

                  {/* Mockup Orçamento - Desktop Real - REPOSICIONADO */}
                  <motion.div 
                      initial={{ opacity: 0, x: 60, rotate: 8 }}
                      whileInView={{ opacity: 1, x: 0, rotate: 8 }}
                      viewport={{ once: true }}
                      className="absolute -right-20 top-0 z-30 w-[350px] h-[480px] bg-white rounded-[2.5rem] shadow-[0_48px_96px_-16px_rgba(0,0,0,0.25)] border border-slate-100 overflow-hidden hidden xl:block"
                   >
                     <div className="relative h-full w-full bg-white">
                         <Image 
                           src="/assets/showcase-pdf.png" 
                           alt="Professional Quote PDF" 
                           fill 
                           className="object-cover object-top"
                         />
                     </div>
                   </motion.div>
              </div>
          </div>
        </section>

        {/* Planos - Grid Principal */}
        <section id="planos" className="max-w-7xl mx-auto px-6 mb-32 relative z-10">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-primary font-bold text-[10px] uppercase tracking-[0.4em]">Opções de Escalabilidade</h2>
                <h3 className="text-xl md:text-3xl font-semibold font-headline tracking-tight leading-tight">Escolha seu nível de operação</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan, idx) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                    >
                        <Card className={cn(
                            "flex flex-col h-full border-none bg-background/40 backdrop-blur-3xl rounded-[2.5rem] shadow-premium transition-all duration-500 hover:scale-[1.02] relative overflow-hidden group",
                            plan.isPopular && "ring-2 ring-primary/20 md:scale-105 z-20"
                        )}>
                            {plan.isPopular && (
                                <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-bold uppercase tracking-widest px-6 py-2 rounded-bl-2xl">
                                    Mais Escolhido
                                </div>
                            )}
                            
                            <CardHeader className="pt-12 pb-8 text-center px-8">
                                <CardTitle className="text-xl font-semibold font-headline tracking-tight uppercase opacity-80">{plan.name}</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-2 min-h-[40px] px-4">{plan.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1 px-10">
                                <div className="text-center mb-10">
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-5xl font-semibold tracking-tighter">{plan.price}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">{plan.pricePeriod}</span>
                                    </div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-30 mt-2">
                                        {plan.id === 'enterprise' ? 'Faturamento Personalizado' : 'Pagamento Mensal'}
                                    </p>
                                </div>

                                <ul className="space-y-4 mb-8">
                                    {featureRows.slice(0, 10).map((feature) => {
                                        const isChecked = plan.features[feature.page as keyof typeof plan.features];
                                        return (
                                            <li key={feature.page} className={cn("flex items-center gap-3 text-xs transition-opacity", !isChecked && "opacity-30")}>
                                                <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0", isChecked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                                    {isChecked ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                                </div>
                                                <span className={cn("font-medium", isChecked ? "text-foreground" : "text-muted-foreground")}>{feature.label}</span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <AnimatePresence>
                                    {expandedPlan === plan.id && (
                                        <motion.ul
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 pt-1 mb-8 overflow-hidden"
                                        >
                                            {featureRows.slice(10).map((feature) => {
                                                const isChecked = plan.features[feature.page as keyof typeof plan.features];
                                                return (
                                                    <li key={feature.page} className={cn("flex items-center gap-3 text-xs", !isChecked && "opacity-30")}>
                                                        <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0", isChecked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                                            {isChecked ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                                        </div>
                                                        <span className="font-medium">{feature.label}</span>
                                                    </li>
                                                );
                                            })}
                                        </motion.ul>
                                    )}
                                </AnimatePresence>

                                <Button 
                                    variant="ghost" 
                                    className="w-full text-[10px] font-bold uppercase tracking-widest text-primary/60"
                                    onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                                >
                                    {expandedPlan === plan.id ? 'Ver Menos Features' : 'Ver Todas as Features'}
                                    <ChevronDown className={cn("ml-2 h-3 w-3 transition-transform duration-300", expandedPlan === plan.id && "rotate-180")} />
                                </Button>
                            </CardContent>

                            <CardFooter className="p-10">
                                <Button asChild size="lg" className={cn(
                                    "w-full h-14 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all duration-300 shadow-xl",
                                    plan.isPopular ? "bg-primary shadow-primary/20 hover:shadow-primary/40" : "bg-background/40 backdrop-blur-xl border border-border/40 hover:bg-primary hover:text-white"
                                )}>
                                    <Link href={plan.id === 'enterprise' ? 'https://wa.me/5511999999999' : `/signup?plan=${plan.id}`}>
                                        {plan.cta}
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </section>

        {/* Tabela Comparativa Detalhada */}
        <section id="comparativo" className="max-w-5xl mx-auto px-6 mb-32">
            <div className="text-center mb-16">
                <h3 className="text-xl md:text-2xl font-semibold font-headline tracking-tight mb-4 uppercase opacity-80">Comparativo Detalhado</h3>
                <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-[0.2em]">Funcionalidade por funcionalidade</p>
            </div>

            <div className="bg-background/40 backdrop-blur-3xl rounded-[2.5rem] border border-border/40 shadow-premium overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-border/40 h-16">
                            <TableHead className="w-[300px] text-[10px] font-bold uppercase tracking-widest text-primary px-8">Modulo/Feature</TableHead>
                            <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest">Essencial</TableHead>
                            <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-primary">Profissional</TableHead>
                            <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest">Enterprise</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {featureRows.map((row) => (
                            <TableRow key={row.page} className="border-border/40 hover:bg-primary/[0.02] transition-colors">
                                <TableCell className="px-8 flex items-center gap-4 py-6">
                                    <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                                        {row.icon && <row.icon className="h-4 w-4" />}
                                    </div>
                                    <span className="text-[11px] font-bold tracking-tight uppercase opacity-70">{row.label}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                    {plans[0].features[row.page as keyof typeof plans[0]['features']] ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/20 mx-auto" />}
                                </TableCell>
                                <TableCell className="text-center">
                                    {plans[1].features[row.page as keyof typeof plans[1]['features']] ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/20 mx-auto" />}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Check className="h-4 w-4 text-primary mx-auto" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </section>

        {/* FAQ - SEO Friendly */}
        <section id="faq" className="max-w-4xl mx-auto px-6 mb-32">
            <div className="text-center mb-16">
                <h3 className="text-xl md:text-2xl font-semibold font-headline tracking-tight uppercase opacity-80">Perguntas Frequentes</h3>
            </div>
            
            <Accordion type="single" collapsible className="space-y-4">
                {faqs.map((faq, idx) => (
                    <AccordionItem key={idx} value={`item-${idx}`} className="border-none bg-background/40 backdrop-blur-3xl rounded-[2rem] px-8 border border-border/40 shadow-sm overflow-hidden">
                        <AccordionTrigger className="hover:no-underline py-6">
                            <span className="text-xs font-bold uppercase tracking-wider text-left pr-4">{faq.question}</span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-8 text-sm text-muted-foreground leading-relaxed">
                            {faq.answer}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </section>

        {/* CTA Final */}
        <section className="max-w-5xl mx-auto px-6 mb-32">
            <Card className="border-none bg-primary rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-primary/40">
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent pointer-events-none" />
                <div className="relative z-10 space-y-8">
                    <h4 className="text-2xl md:text-4xl font-semibold font-headline text-white tracking-tight leading-tight">
                        A transformação da sua <br className="hidden md:block" /> gestão começa hoje.
                    </h4>
                    <p className="text-white/70 max-w-xl mx-auto font-medium text-sm">
                        Junte-se a centenas de empresas que já otimizaram seus processos com o NORA. 20 dias grátis para você sentir o poder da eficiência.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <Button asChild size="lg" className="h-16 px-12 bg-white text-primary hover:bg-white/90 shadow-xl rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px]">
                            <Link href="/signup">Criar Conta Gratuita</Link>
                        </Button>
                        <div className="flex items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                            <ShieldCheck className="h-4 w-4" /> Sem cartão de crédito
                        </div>
                    </div>
                </div>
            </Card>
        </section>
      </main>

      <footer className="py-20 bg-background/40 backdrop-blur-3xl border-t border-border/40">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-12">
            <div className="relative h-16 w-32 opacity-30 hover:opacity-100 transition-opacity duration-1000 grayscale hover:grayscale-0">
                <Image 
                  src="https://firebasestorage.googleapis.com/v0/b/studio-2629657699-721b1.firebasestorage.app/o/logos%2FNora%20transparente.png?alt=media&token=0c0f67f4-ec08-4174-9b77-f9d5b7fe4b65" 
                  alt="NORA Logo" 
                  fill 
                  style={{objectFit:'contain'}} 
                />
            </div>
            
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40">
                <p>© 2018-2026 NORA</p>
                <Link href="#" className="hover:text-primary">Termos de Uso</Link>
                <Link href="#" className="hover:text-primary">Privacidade</Link>
                <Link href="#" className="hover:text-primary">SLA</Link>
            </div>
            
            <div className="flex items-center gap-4 text-muted-foreground/20">
                <Globe className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Sovereignty in Operation</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
