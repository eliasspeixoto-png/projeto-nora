import type { Role, Company, RolePermissions, PagePermission } from './data';
import {
  LayoutDashboard,
  Users,
  Lock,
  Banknote,
  Truck,
  UserCircle,
  ClipboardList,
  HardHat,
  Package,
  Construction,
  FileBarChart,
  FileText,
  ShoppingCart,
  Car,
  Warehouse,
  Wrench,
  Map,
  Users2,
  Megaphone,
  Trash2,
  Smartphone,
  UserSquare,
  Settings,
  TrendingUp,
  ShoppingBag,
  Mail,
  Sparkles,
} from "lucide-react";

export interface MenuItem {
  href: string;
  label: string;
  icon: any;
  page: string;
  color: string;
  subItems?: { href: string; label: string; icon?: any }[];
}

export const allMenuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, page: "dashboard", color: "hsl(var(--menu-estoque))" },
  { href: "/clientes", label: "Clientes", icon: Users, page: "clientes", color: "hsl(var(--menu-estoque))" },
  { href: "/comodato", label: "Comodato", icon: Lock, page: "comodato", color: "hsl(var(--menu-estoque))" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, page: "compras", color: "hsl(var(--menu-estoque))" },
  { href: "/distribuidor", label: "Distribuidores", icon: ShoppingBag, page: "distribuidores", color: "hsl(var(--menu-estoque))" },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck, page: "fornecedores", color: "hsl(var(--menu-estoque))" },
  { href: "/distribuidor/pedidos", label: "Pedidos Recebidos", icon: ShoppingCart, page: "pedidos", color: "hsl(var(--menu-estoque))" },
  { href: "/distribuidor/cliques", label: "Histórico de Cliques", icon: TrendingUp, page: "cliques", color: "hsl(var(--menu-estoque))" },
  { href: "/equipe", label: "Mapa Equipe", icon: Map, page: "equipe", color: "hsl(var(--menu-estoque))" },
  { href: "/estoque", label: "Estoque", icon: Warehouse, page: "estoque", color: "hsl(var(--menu-estoque))" },
  { href: "/ferramentas", label: "Ferramentas", icon: Wrench, page: "ferramentas", color: "hsl(var(--menu-estoque))" },
  { href: "/financeiro", label: "Financeiro", icon: Banknote, page: "financeiro", color: "hsl(var(--menu-estoque))" },
  { href: "/fiscal", label: "Nota Fiscal de Serviço", icon: FileText, page: "fiscal", color: "hsl(var(--menu-estoque))" },
  { href: "/notas-fiscais", label: "Notas de Entrada", icon: FileText, page: "notas-fiscais", color: "hsl(var(--menu-estoque))" },
  { href: "/funcionarios", label: "Funcionários", icon: Users2, page: "funcionarios", color: "hsl(var(--menu-estoque))" },
  { href: "/lixeira", label: "Lixeira", icon: Trash2, page: "lixeira", color: "hsl(var(--destructive))" },
  { href: "/marketing", label: "Marketing", icon: Megaphone, page: "marketing", color: "hsl(var(--menu-estoque))" },
  { href: "/marketing/leads", label: "Leads do Site", icon: Sparkles, page: "leads", color: "hsl(var(--primary))" },
  { href: "/minhas-os", label: "Minhas Tarefas", icon: UserCircle, page: "minhas-os", color: "hsl(var(--menu-estoque))" },
  { href: "/orcamentos", label: "Orçamentos", icon: ClipboardList, page: "orcamentos", color: "hsl(var(--menu-estoque))" },
  { href: "/ordem-de-servico", label: "O.S.", icon: HardHat, page: "ordem-de-servico", color: "hsl(var(--menu-estoque))" },
  { href: "/produtos", label: "Produtos", icon: Package, page: "produtos", color: "hsl(var(--menu-estoque))" },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, page: "relatorios", color: "hsl(var(--menu-estoque))" },
  { href: "/veiculos", label: "Veículos", icon: Car, page: "veiculos", color: "hsl(var(--menu-estoque))" },
  { href: "/visitas", label: "Agendar Visita", icon: Construction, page: "visitas", color: "hsl(var(--menu-estoque))" },
  { href: "/settings", label: "Customizações", icon: Settings, page: "settings", color: "hsl(var(--primary))" },
  { href: "/cliente/dashboard", label: "Portal do Cliente", icon: UserSquare, page: "cliente", color: "hsl(var(--menu-estoque))" }
];

const allPages = allMenuItems.map(item => item.page);
allPages.push('settings');
allPages.push('cameras');

const createFullAccess = (): RolePermissions => {
  return allPages.reduce((acc, page) => {
    acc[page] = { view: true, edit: true, delete: true };
    return acc;
  }, {} as RolePermissions);
}

export const planPermissions: Record<Company['plan'], string[]> = {
  'Periodo Teste': allPages,
  Essencial: [
    'dashboard', 'clientes', 'orcamentos', 'ordem-de-servico', 'visitas', 'minhas-os', 'produtos', 'financeiro', 'settings', 'funcionarios', 'cliente', 'lixeira', 'leads'
  ],
  Profissional: allPages.filter(p => p !== 'fiscal' && p !== 'marketing'),
  Enterprise: allPages,
  distribuidor: ['dashboard', 'pedidos', 'produtos', 'cliques', 'settings', 'funcionarios', 'lixeira'],
};

export const defaultPermissions: Record<Role, RolePermissions> = {
  admin: createFullAccess(),
  supervisor: createFullAccess(),
  tecnico: {
    dashboard: { view: true, edit: false, delete: false },
    'minhas-os': { view: true, edit: true, delete: false },
    ferramentas: { view: true, edit: true, delete: false },
    visitas: { view: true, edit: true, delete: false },
    estoque: { view: true, edit: true, delete: false },
  },
  surveyor: {
    'visitas': { view: true, edit: true, delete: true },
    'orcamentos': { view: true, edit: true, delete: false },
  },
  comprador: {
    dashboard: { view: true, edit: false, delete: false },
    compras: { view: true, edit: true, delete: true },
    produtos: { view: true, edit: true, delete: false },
    estoque: { view: true, edit: true, delete: false },
  },
  distribuidor: {
    dashboard: { view: true, edit: false, delete: false },
    produtos: { view: true, edit: true, delete: true },
    cliques: { view: true, edit: false, delete: false },
    settings: { view: true, edit: true, delete: false },
    pedidos: { view: true, edit: false, delete: false },
    funcionarios: { view: true, edit: true, delete: true },
    lixeira: { view: true, edit: true, delete: true },
  },
  vendedor: {
    dashboard: { view: true, edit: true, delete: true },
    pedidos: { view: true, edit: true, delete: true },
    settings: { view: true, edit: true, delete: false },
  },
  cliente: {
    'cliente': { view: true, edit: false, delete: false },
  },
  developer: createFullAccess(),
};

export const roleLabels: Record<Role, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  tecnico: 'Técnico',
  surveyor: 'Vistoriador',
  comprador: 'Comprador',
  cliente: 'Cliente',
  distribuidor: 'Distribuidor',
  vendedor: 'Vendedor',
  developer: 'Desenvolvedor',
};

export function canAccessPage(role: Role, pageKey: string, company?: Company | null): boolean {
  if (pageKey === 'cliques' && role !== 'distribuidor') return false;
  if (pageKey === 'pedidos' && role !== 'vendedor' && role !== 'distribuidor') return false;
  if (pageKey === 'cliente' && role !== 'cliente') return false;
  if (role === 'tecnico' && (pageKey === 'ordem-de-servico' || pageKey === 'orcamentos')) return false;
  if (pageKey === 'leads') {
    const isEspTec = company?.name?.toLowerCase().includes('esp') || company?.name?.toLowerCase().includes('tec');
    const isAuthorizedRole = ['admin', 'supervisor'].includes(role);
    return !!isEspTec && isAuthorizedRole;
  }
  const userPlan = company?.plan || 'Essencial';
  const allowedPagesForPlan = planPermissions[userPlan] || [];
  if (!allowedPagesForPlan.includes(pageKey)) return false;
  const companyPermissions = company?.permissions;
  const defaultPagePerms = defaultPermissions[role]?.[pageKey] || {};
  const companyPagePerms = companyPermissions?.[role]?.[pageKey] || {};
  const mergedPagePerms: PagePermission = { ...defaultPagePerms, ...companyPagePerms };
  return mergedPagePerms?.view === true;
}

export function canPerformAction(role: Role, page: string, action: 'view' | 'edit' | 'delete', companyPermissions?: Record<Role, RolePermissions> | null): boolean {
  if (!role) return false;
  const defaultPagePerms = defaultPermissions[role]?.[page] || {};
  const companyPagePerms = companyPermissions?.[role]?.[page] || {};
  const mergedPerms: PagePermission = { ...defaultPagePerms, ...companyPagePerms };
  return mergedPerms[action] === true;
}

export function getAccessibleMenuItems(role: Role, company: Company | null, isDeveloper: boolean): MenuItem[] {
  if (isDeveloper) return allMenuItems.filter(item =>
    item.page !== 'settings' &&
    item.page !== 'lixeira' &&
    (item.page !== 'cliques' || role === 'distribuidor') &&
    (item.page !== 'pedidos' || role === 'vendedor' || role === 'distribuidor') &&
    (item.page !== 'cliente' || role === 'cliente')
  ).sort((a, b) => a.label.localeCompare(b.label));
  if (!company && role !== 'distribuidor') return [];
  const accessibleItems = allMenuItems.filter(item => {
    if (item.page === 'lixeira' || item.page === 'settings') return false;
    return canAccessPage(role, item.page, company);
  });
  const dashboardItem = accessibleItems.find(item => item.page === 'dashboard');
  const remainingItems = accessibleItems.filter(item => item.page !== 'dashboard');
  const sortedRemaining = [...remainingItems].sort((a, b) => a.label.localeCompare(b.label));
  return dashboardItem ? [dashboardItem, ...sortedRemaining] : [...sortedRemaining];
}
