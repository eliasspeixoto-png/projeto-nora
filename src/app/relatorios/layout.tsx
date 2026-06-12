"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { allMenuItems } from "@/lib/permissions";

const tabs = [
    { href: "/relatorios/historico", label: "Histórico Geral", page: "relatorios" },
    { href: "/relatorios/rentabilidade-comodato", label: "Rentabilidade Comodato", page: "comodato" },
    { href: "/relatorios/resultados", label: "Resultados", page: "relatorios" },
    { href: "/relatorios/conversao", label: "Conversão de Vendas", page: "relatorios" },
    { href: "/relatorios/desempenho", label: "Desempenho Vendas", page: "relatorios" },
    { href: "/relatorios/desempenho-tecnicos", label: "Desempenho Técnicos", page: "equipe" },
    { href: "/relatorios/analise-clientes", label: "Ranking de clientes", page: "clientes" },
    { href: "/relatorios/extrato-cliente", label: "Extrato do Cliente", page: "clientes" },
];

const pageColorMap = allMenuItems.reduce((acc, item) => {
    acc[item.page] = item.color;
    return acc;
}, {} as Record<string, string>);

export default function RelatoriosLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const totalTabs = tabs.length;
  
    return (
        <div className="flex flex-col w-full h-full min-w-0">
            <div className="sticky top-0 z-30 w-full px-4 py-1.5 bg-background/60 backdrop-blur-xl border-b border-border/40">
                <div className="flex items-center gap-4 overflow-x-auto premium-scrollbar py-1 px-1">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href;
                        const color = pageColorMap[tab.page] || 'hsl(var(--primary))';
                        
                        return (
                            <Link
                                key={tab.label}
                                href={tab.href}
                                className={cn(
                                    "relative px-4 py-1.5 rounded-full text-[13px] font-semibold tracking-tight transition-all duration-300 whitespace-nowrap active:scale-95 group",
                                    isActive ? "bg-primary/20 shadow-lg shadow-primary/10 scale-105" : "text-muted-foreground/60 hover:bg-primary/5 hover:text-primary"
                                )}
                                style={{ color: isActive ? color : undefined } as React.CSSProperties}
                            >
                                {tab.label}
                                {isActive && (
                                    <div 
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse" 
                                        style={{ backgroundColor: color }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full min-w-0 bg-transparent">
                <div className="max-w-[1600px] mx-auto w-full">
                    {children}
                </div>
            </div>
        </div>
    );
}
