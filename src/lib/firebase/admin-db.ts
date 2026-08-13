import { firestore } from './admin';
import { isPast, parseISO, startOfMonth } from "date-fns";
import { getBrasiliaDate, getTodayBrasiliaISO, normalizeString } from "@/lib/utils";

const PRODUCTS_COLLECTION = "products";
const CLIENTS_COLLECTION = "clients";
const SUPPLIERS_COLLECTION = "suppliers";
const QUOTES_COLLECTION = "quotes";
const COMPANIES_COLLECTION = "companies";
const USERS_COLLECTION = "users";
const VISITS_COLLECTION = "visits";
const ACCOUNTS_RECEIVABLE_COLLECTION = "accountsReceivable";
const COMODATO_ASSETS_COLLECTION = "comodatoAssets";
const PURCHASE_ORDERS_COLLECTION = "purchaseOrders";
const VEHICLES_COLLECTION = "vehicles";
const STOCK_LOCATIONS_COLLECTION = "stockLocations";
const TOOLS_COLLECTION = "tools";
const COMMUNICATIONS_COLLECTION = "communications";
const NOTES_COLLECTION = "notes";
const PROMOTIONS_COLLECTION = "promotions";
const DISTRIBUTOR_CLICKS_COLLECTION = "distributorClicks";

const COLLECTION_MAP: Record<string, string> = {
    'clientes': CLIENTS_COLLECTION,
    'cliente': CLIENTS_COLLECTION,
    'produtos': PRODUCTS_COLLECTION,
    'produto': PRODUCTS_COLLECTION,
    'orcamentos': QUOTES_COLLECTION,
    'orcamento': QUOTES_COLLECTION,
    'ordens_servico': QUOTES_COLLECTION,
    'ordem_servico': QUOTES_COLLECTION,
    'os': QUOTES_COLLECTION,
    'visitas': VISITS_COLLECTION,
    'visita': VISITS_COLLECTION,
    'funcionarios': USERS_COLLECTION,
    'funcionario': USERS_COLLECTION,
    'colaboradores': USERS_COLLECTION,
    'fornecedores': SUPPLIERS_COLLECTION,
    'fornecedor': SUPPLIERS_COLLECTION,
    'veiculos': VEHICLES_COLLECTION,
    'veiculo': VEHICLES_COLLECTION,
    'compras': PURCHASE_ORDERS_COLLECTION,
    'pedidos': PURCHASE_ORDERS_COLLECTION,
    'ferramentas': TOOLS_COLLECTION,
    'ferramenta': TOOLS_COLLECTION,
    'tarefas': QUOTES_COLLECTION,
    'financeiro': ACCOUNTS_RECEIVABLE_COLLECTION,
    'contas_receber': ACCOUNTS_RECEIVABLE_COLLECTION,
    'receber': ACCOUNTS_RECEIVABLE_COLLECTION
};

/**
 * ADMIN FUNCTIONS (Bypass Security Rules)
 */

export const getCollectionStatsAdmin = async (companyId: string, collectionName: string) => {
    const collNormalized = collectionName.toLowerCase().trim();
    const targetColl = COLLECTION_MAP[collNormalized] || collNormalized;
    
    let query = firestore.collection(targetColl).where("companyId", "==", companyId);
    
    if (targetColl === QUOTES_COLLECTION) {
        if (collNormalized.includes('os') || collNormalized.includes('servico') || collNormalized.includes('tarefas')) {
            query = query.where("status", "not-in", ["draft", "sent", "rejected"]);
        } else {
            query = query.where("status", "in", ["draft", "sent", "rejected", "Aprovado", "revision-pending"]);
        }
    }

    let snap = await query.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);

    if (docs.length === 0) {
        const fallbackSnap = await firestore.collection(targetColl).get();
        docs = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);
    }

    if (targetColl === USERS_COLLECTION) {
        docs = docs.filter(d => d.role !== 'cliente' && d.userType !== 'cliente');
    }

    return { count: docs.length };
};

export const getFinancialSummaryAdmin = async (companyId: string) => {
    const today = getBrasiliaDate();
    const startOfThisMonth = startOfMonth(today);

    // Receivables
    const snapReceivables = await firestore.collection(ACCOUNTS_RECEIVABLE_COLLECTION)
        .where("companyId", "==", companyId)
        .get();
    const receivables = snapReceivables.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((r: any) => !r.deletedAt);

    // Sales Approved this month
    const snapApproved = await firestore.collection(QUOTES_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "==", "Aprovado")
        .get();
    const approvedThisMonth = snapApproved.docs.filter(d => {
        const data = d.data() as any;
        return !data.deletedAt && parseISO(data.date) >= startOfThisMonth;
    });

    // Comodato Revenue (from active clients)
    const snapClients = await firestore.collection(CLIENTS_COLLECTION)
        .where("companyId", "==", companyId)
        .get();
    
    const comodatoRevenue = snapClients.docs
        .map(d => d.data() as any)
        .filter(d => !d.deletedAt)
        .reduce((sum: number, data: any) => {
            const val = typeof data.serviceValue === 'string'
                ? parseFloat(data.serviceValue.replace(',', '.'))
                : (data.serviceValue || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

    return {
        total_vencido_a_receber: receivables.filter((r: any) => r.status !== 'Pago' && isPast(parseISO(r.dueDate))).reduce((sum: number, r: any) => sum + r.amount, 0),
        total_a_vencer_a_receber: receivables.filter((r: any) => r.status !== 'Pago' && !isPast(parseISO(r.dueDate))).reduce((sum: number, r: any) => sum + r.amount, 0),
        recebido_no_mes: receivables.filter((r: any) => r.status === 'Pago' && r.paymentDate && parseISO(r.paymentDate) >= startOfThisMonth).reduce((sum: number, r: any) => sum + r.amount, 0),
        qtd_contas_a_receber_pendentes: receivables.filter((r: any) => r.status !== 'Pago').length,
        vendas_aprovadas_mes: approvedThisMonth.length,
        valor_aprovado_mes: approvedThisMonth.reduce((sum: number, q: any) => sum + (q.data().total || 0), 0),
        faturamento_comodato_mensal: comodatoRevenue,
        qtd_contratos_comodato: snapClients.docs.filter(d => !d.data().deletedAt).length
    };
};

export const getCriticalStockAdmin = async (companyId: string) => {
    const snap = await firestore.collection(PRODUCTS_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "==", "Ativo")
        .get();
    
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((p: any) => !p.deletedAt);
    return products
        .filter((p: any) => (p.stockQuantity || 0) <= (p.minStockQuantity || 0))
        .map((p: any) => ({
            nome: p.description,
            codigo: p.item,
            estoque: p.stockQuantity,
            minimo: p.minStockQuantity
        }));
};

export const getPendingTasksAdmin = async (companyId: string) => {
    const snap = await firestore.collection(QUOTES_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "in", ["Pendente", "Atribuída", "Em Execução", "Agendado"])
        .get();
    
    return snap.docs
        .map(d => d.data() as any)
        .filter(d => !d.deletedAt)
        .map(data => ({
            numero: (data.quoteNumber || '').replace('ORC', 'OS'),
            cliente: data.clientName,
            status: data.status,
            data: data.scheduledDate || data.date
        }));
};

export const getTodayVisitsAdmin = async (companyId: string) => {
    const todayStr = getTodayBrasiliaISO();
    const snap = await firestore.collection(VISITS_COLLECTION)
        .where("companyId", "==", companyId)
        .where("visitDate", "==", todayStr)
        .get();
    
    return snap.docs
        .map(d => d.data() as any)
        .filter(d => !d.deletedAt)
        .map(data => ({
            numero: data.visitNumber,
            cliente: data.clientName,
            hora: data.time,
            tecnico: data.technicianName,
            status: data.status
        }));
};

export const getOnlineTeamAdmin = async (companyId: string) => {
    const snap = await firestore.collection(USERS_COLLECTION)
        .where("companyId", "==", companyId)
        .where("isOnline", "==", true)
        .get();
    
    return snap.docs
        .map(d => d.data() as any)
        .filter(d => !d.deletedAt)
        .map(data => ({
            nome: data.displayName,
            cargo: data.role,
            ultima_atualizacao: data.lastLocationUpdated ? data.lastLocationUpdated : 'Recém logado'
        }));
};

export const getDetailedListAdmin = async (companyId: string, collectionName: string, statusFilter?: string, technicianId?: string, clientId?: string) => {
    const collNormalized = collectionName.toLowerCase().trim();
    const targetColl = COLLECTION_MAP[collNormalized] || collNormalized;
    
    let query = firestore.collection(targetColl).where("companyId", "==", companyId);
    
    if (statusFilter) query = query.where("status", "==", statusFilter);

    // Filtro de Técnico
    if (technicianId) {
        if (targetColl === VISITS_COLLECTION) query = query.where("technicianId", "==", technicianId);
        if (targetColl === QUOTES_COLLECTION) query = query.where("assignedTechnicianId", "==", technicianId);
    }

    // Filtro de Cliente
    if (clientId) {
        if (targetColl === CLIENTS_COLLECTION) query = query.where("__name__", "==", clientId);
        else query = query.where("clientId", "==", clientId);
    }
    
    let snap = await query.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);

    if (docs.length === 0) {
        const fallbackSnap = await firestore.collection(targetColl).get();
        docs = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);
        if (statusFilter) {
            docs = docs.filter(d => d.status?.toLowerCase() === statusFilter.toLowerCase());
        }
    }

    if (targetColl === USERS_COLLECTION) {
        docs = docs.filter(d => d.role !== 'cliente' && d.userType !== 'cliente');
    }

    return docs.map(d => {
        // Simplified return for the AI to handle tokens better
        if (targetColl === CLIENTS_COLLECTION) return { nome: d.name, codigo: d.clientCode, fone: d.phone };
        if (targetColl === PRODUCTS_COLLECTION) return { nome: d.description || d.name, codigo: d.item, estoque: d.stockQuantity };
        if (targetColl === QUOTES_COLLECTION) return { numero: d.quoteNumber, cliente: d.clientName, total: d.total, status: d.status, tecnico: d.assignedTechnicianName };
        if (targetColl === VISITS_COLLECTION) return { numero: d.visitNumber, cliente: d.clientName, status: d.status, data: d.visitDate, tecnico: d.technicianName };
        if (targetColl === ACCOUNTS_RECEIVABLE_COLLECTION) return { cliente: d.clientName, valor: d.amount, vencimento: d.dueDate, status: d.status, os: d.quoteNumber };
        if (targetColl === USERS_COLLECTION) return { nome: d.displayName || d.name, cargo: d.role, email: d.email, fone: d.phone };
        return d;
    });
};

export const searchClientByCodeOrNameAdmin = async (companyId: string, term: string) => {
    const termNormalized = normalizeString(term);
    
    const snap = await firestore.collection(CLIENTS_COLLECTION)
        .where("companyId", "==", companyId)
        .get();
    
    const client = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.deletedAt)
        .find(c => 
            normalizeString(c.name).includes(termNormalized) || 
            c.clientCode === term || 
            c.id === term ||
            (c.document && normalizeString(c.document).includes(termNormalized))
        );
        
    return client || { error: 'Cliente não encontrado' };
};

export const getPurchaseSummaryAdmin = async (companyId: string) => {
    const snap = await firestore.collection(PURCHASE_ORDERS_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "==", "Recebido")
        .get();
    
    const data = snap.docs.map(d => d.data() as any).filter(o => !o.deletedAt);
    const today = getBrasiliaDate();
    const startOfThisMonth = startOfMonth(today);

    return {
        total_compras_mes: data.filter(o => parseISO(o.creationDate) >= startOfThisMonth).reduce((sum, o) => sum + o.totalAmount, 0),
        total_compras_geral: data.reduce((sum, o) => sum + o.totalAmount, 0),
        qtd_pedidos_recebidos: data.length
    };
};
export const searchVisitByCodeAdmin = async (companyId: string, code: string, technicianId?: string, clientId?: string) => {
    const term = code.trim().toUpperCase();
    const numberPart = term.match(/\d+/)?.[0];

    let query = firestore.collection(VISITS_COLLECTION).where("companyId", "==", companyId);
    if (technicianId) query = query.where("technicianId", "==", technicianId);
    if (clientId) query = query.where("clientId", "==", clientId);
    
    const snap = await query.get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);
    
    // Tenta exato primeiro
    let visit = docs.find(d => 
        d.visitNumber === term || 
        d.visitNumber === term.replace('VS-', '') ||
        d.visitNumber === term.replace('VS-', 'VS')
    );
    
    // Se não achou, tenta por número parcial
    if (!visit && numberPart) {
        visit = docs.find(d => d.visitNumber.includes(numberPart));
    }
    
    if (!visit) return { error: `Visita ${code} não encontrada` };

    return { 
        ...visit,
        necessidade: visit.description,
        relato_tecnico: visit.serviceReport,
        materiais_propostos: visit.requiredMaterials
    };
};

export const searchQuoteByCodeAdmin = async (companyId: string, code: string, technicianId?: string, clientId?: string) => {
    const term = code.trim().toUpperCase();
    const normalizedCode = term.replace('OS-', 'ORC-');
    const numberPart = term.match(/\d+/)?.[0];
    
    let query = firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId);
    if (technicianId) query = query.where("assignedTechnicianId", "==", technicianId);
    if (clientId) query = query.where("clientId", "==", clientId);

    const snap = await query.get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);
    
    // Tenta exato (ORC ou OS)
    let quote = docs.find(d => 
        d.quoteNumber === term || 
        d.quoteNumber === normalizedCode ||
        d.quoteNumber === term.replace('OS-', 'ORC-') ||
        d.quoteNumber === term.replace('ORC-', 'OS-')
    );
    
    // Se não achou, tenta por número parcial (extraindo apenas os dígitos)
    if (!quote && numberPart) {
        quote = docs.find(d => d.quoteNumber.includes(numberPart));
    }
    
    if (!quote) return { error: `Registro ${code} não encontrado` };
    
    // Limpa itens para ser mais leve e relevante para a IA
    const cleanItems = (quote.items || []).map((i: any) => ({
        nome: i.product?.description || i.description,
        qtd: i.quantity,
        preco: i.materialPrice,
        servico: i.servicePrice,
        total: i.total
    }));

    return { 
        ...quote,
        items: cleanItems 
    };
};

export const getClientHistoryAdmin = async (companyId: string, clientName: string, technicianId?: string, clientId?: string) => {
    const termNormalized = normalizeString(clientName);
    
    let queryQuotes = firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId);
    let queryVisits = firestore.collection(VISITS_COLLECTION).where("companyId", "==", companyId);
    let queryFinance = firestore.collection(ACCOUNTS_RECEIVABLE_COLLECTION).where("companyId", "==", companyId);

    // Filtro de Técnico
    if (technicianId) {
        queryQuotes = queryQuotes.where("assignedTechnicianId", "==", technicianId);
        queryVisits = queryVisits.where("technicianId", "==", technicianId);
    }

    // Filtro de Cliente
    if (clientId) {
        queryQuotes = queryQuotes.where("clientId", "==", clientId);
        queryVisits = queryVisits.where("clientId", "==", clientId);
        queryFinance = queryFinance.where("clientId", "==", clientId);
    }

    // Fetch in parallel for speed
    const [snapQuotes, snapVisits, snapFinance] = await Promise.all([
        queryQuotes.get(),
        queryVisits.get(),
        queryFinance.get()
    ]);

    const quotes = snapQuotes.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.deletedAt && normalizeString(d.clientName || '').includes(termNormalized))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 15)
        .map(d => ({
            tipo: (d.quoteNumber || '').includes('ORC') ? 'Orçamento' : 'Ordem de Serviço',
            numero: d.quoteNumber,
            data: d.date,
            total: d.total,
            status: d.status,
            tecnico: d.assignedTechnicianName,
            itens: (d.items || []).map((i: any) => `${i.quantity}x ${i.product?.description || i.description}`).join(', ')
        }));

    const visits = snapVisits.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.deletedAt && normalizeString(d.clientName || '').includes(termNormalized))
        .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''))
        .slice(0, 15)
        .map(d => ({
            numero: d.visitNumber,
            data: d.visitDate,
            hora: d.time,
            tecnico: d.technicianName,
            status: d.status,
            necessidade: d.description,
            relato_tecnico: d.serviceReport,
            materiais_propostos: d.requiredMaterials
        }));

    const finance = snapFinance.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.deletedAt && normalizeString(d.clientName || '').includes(termNormalized))
        .map(d => ({
            descricao: d.description,
            valor: d.amount,
            vencimento: d.dueDate,
            status: d.status,
            os: d.quoteNumber
        }))
        .filter(f => !technicianId || quotes.some(q => q.numero === f.os)); // Somente financeiro das MINHAS OSs se for técnico

    return {
        cliente: clientName,
        ordens_servico_e_orcamentos: quotes,
        visitas_tecnicas: visits,
        financeiro_contas_a_receber: finance
    };
};

export const getClientMaterialsAdmin = async (companyId: string, clientName: string, technicianId?: string, clientId?: string) => {
    const termNormalized = normalizeString(clientName);
    let query = firestore.collection(QUOTES_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "==", "Finalizado");
    
    if (technicianId) query = query.where("assignedTechnicianId", "==", technicianId);
    if (clientId) query = query.where("clientId", "==", clientId);

    const snap = await query.get();
        
    const quotes = snap.docs
        .map(d => d.data() as any)
        .filter(d => !d.deletedAt && normalizeString(d.clientName || '').includes(termNormalized));
        
    const materialsMap = new Map<string, { nome: string, qtd: number }>();
    
    quotes.forEach(q => {
        (q.items || []).forEach((i: any) => {
            const nome = i.product?.description || i.description;
            if (nome) {
                const current = materialsMap.get(nome) || { nome, qtd: 0 };
                materialsMap.set(nome, { nome, qtd: current.qtd + (i.quantity || 0) });
            }
        });
    });
    
    return Array.from(materialsMap.values());
};

/**
 * MUTATIONS (CREATE/UPDATE/DELETE)
 */

export const createClientAdmin = async (companyId: string, data: any) => {
    const snap = await firestore.collection(CLIENTS_COLLECTION).where("companyId", "==", companyId).get();
    
    // Antiduplicidade: Verificar Nome, Telefone ou Documento
    const nameNormalized = normalizeString(data.name || "");
    const documentClean = (data.document || "").replace(/\D/g, "");
    const phoneClean = (data.phone || "").replace(/\D/g, "");

    const duplicate = snap.docs.find(d => {
        const dData = d.data();
        const dName = normalizeString(dData.name || "");
        const dDoc = (dData.document || "").replace(/\D/g, "");
        const dPhone = (dData.phone || "").replace(/\D/g, "");

        return (nameNormalized && dName === nameNormalized) || 
               (documentClean && dDoc === documentClean) ||
               (phoneClean && dPhone === phoneClean);
    });

    if (duplicate) {
        const dData = duplicate.data();
        throw new Error(`CLIENTE_DUPLICADO: Já existe um cadastro para "${dData.name}" com o código ${dData.clientCode}.`);
    }

    // Extraímos os números e encontramos o maior CLI-XXXX
    const numbers = snap.docs.map(d => {
        const match = (d.data().clientCode || "").match(/CLI-(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
    const nextNumber = Math.max(0, ...numbers) + 1;
    const clientCode = `CLI-${nextNumber.toString().padStart(4, '0')}`;
    
    const docRef = await firestore.collection(CLIENTS_COLLECTION).add({
        ...data,
        status: 'Ativo',
        companyId,
        clientCode,
        creationDate: getBrasiliaDate().toISOString()
    });
    return { id: docRef.id, clientCode };
};

export const createQuoteAdmin = async (companyId: string, data: any) => {
    const year = getBrasiliaDate().getFullYear().toString().slice(-2);
    const isComodato = data.isComodato || data.serviceType === 'Comodato' || !!data.comodatoType;
    const prefix = isComodato ? 'PRO' : 'ORC';
    
    const snap = await firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId).get();
    
    // Filtramos em memória pelo prefixo e pelo ano atual
    const samePrefixNumbers = snap.docs
        .map(d => d.data().quoteNumber as string)
        .filter(num => num && num.startsWith(`${prefix}-`) && num.endsWith(`/${year}`))
        .map(num => {
            const match = num.match(/-(\d+)\//);
            return match ? parseInt(match[1]) : 0;
        });

    const nextNumber = Math.max(0, ...samePrefixNumbers) + 1;
    const quoteNumber = `${prefix}-${nextNumber.toString().padStart(4, '0')}/${year}`;

    const docRef = await firestore.collection(QUOTES_COLLECTION).add({
        ...data,
        companyId,
        quoteNumber,
        date: getBrasiliaDate().toISOString(),
        status: data.status || 'Pendente'
    });
    return { id: docRef.id, quoteNumber };
};

export const createVisitAdmin = async (companyId: string, data: any) => {
    const year = getBrasiliaDate().getFullYear().toString().slice(-2);
    const snap = await firestore.collection(VISITS_COLLECTION).where("companyId", "==", companyId).get();
    
    // Extraímos os números e encontramos o maior VIS-XXXX/YY
    const numbers = snap.docs
        .map(d => d.data().visitNumber as string)
        .filter(num => num && num.startsWith("VIS-") && num.endsWith(`/${year}`))
        .map(num => {
            const match = num.match(/-(\d+)\//);
            return match ? parseInt(match[1]) : 0;
        });

    const nextNumber = Math.max(0, ...numbers) + 1;
    const visitNumber = `VIS-${nextNumber.toString().padStart(4, '0')}/${year}`;

    const docRef = await firestore.collection(VISITS_COLLECTION).add({
        ...data,
        companyId,
        visitNumber,
        creationDate: getBrasiliaDate().toISOString(),
        status: data.status || 'Agendado'
    });
    return { id: docRef.id, visitNumber };
};

export const updateRecordAdmin = async (companyId: string, collectionName: string, id: string, data: any) => {
    const collNormalized = collectionName.toLowerCase().trim();
    const targetColl = COLLECTION_MAP[collNormalized] || collNormalized;
    
    const docRef = firestore.collection(targetColl).doc(id);
    const snap = await docRef.get();
    
    if (!snap.exists || snap.data()?.companyId !== companyId) {
        return { error: 'Documento não encontrado ou permissão negada.' };
    }
    
    await docRef.set(data, { merge: true });
    return { success: true, id };
};

export const deleteRecordAdmin = async (companyId: string, collectionName: string, id: string) => {
    const collNormalized = collectionName.toLowerCase().trim();
    const targetColl = COLLECTION_MAP[collNormalized] || collNormalized;
    
    const docRef = firestore.collection(targetColl).doc(id);
    const snap = await docRef.get();
    
    if (!snap.exists || snap.data()?.companyId !== companyId) {
        return { error: 'Documento não encontrado ou permissão negada.' };
    }
    
    await docRef.set({ 
        deletedAt: getBrasiliaDate().toISOString(),
        status: 'Excluído'
    }, { merge: true });
    
    return { success: true, id };
};

export const bulkUpdateClientsAdmin = async (companyId: string, updates: Array<{ term: string, data: any }>) => {
    const batch = firestore.batch();
    const results: any[] = [];
    
    // Buscar todos os clientes da empresa uma vez para busca em memória (mais eficiente se < 1000 clientes)
    const snap = await firestore.collection(CLIENTS_COLLECTION)
        .where("companyId", "==", companyId)
        .get();
    
    const allClients = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => !d.deletedAt);

    for (const update of updates) {
        const termNormalized = normalizeString(update.term);
        const client = allClients.find(c => 
            normalizeString(c.name).includes(termNormalized) || 
            c.clientCode === update.term || 
            c.id === update.term ||
            (c.document && normalizeString(c.document).includes(termNormalized))
        );

        if (client) {
            const docRef = firestore.collection(CLIENTS_COLLECTION).doc(client.id);
            batch.set(docRef, update.data, { merge: true });
            results.push({ term: update.term, status: 'success', name: client.name, id: client.id });
        } else {
            results.push({ term: update.term, status: 'error', error: 'Cliente não localizado' });
        }
    }

    if (results.some(r => r.status === 'success')) {
        await batch.commit();
    }

    return results;
};

export const createProductAdmin = async (companyId: string, data: any) => {
    const { item, description } = data;
    const snap = await firestore.collection(PRODUCTS_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "==", "Ativo")
        .get();
        
    const duplicate = snap.docs.find(d => {
        const dData = d.data();
        return (item && String(dData.item) === String(item)) || 
               (description && dData.description?.toLowerCase() === description.toLowerCase());
    });

    if (duplicate) {
        return { error: `Produto já cadastrado! (Código: ${item} ou Nome: ${description})` };
    }

    const docRef = await firestore.collection(PRODUCTS_COLLECTION).add({
        ...data,
        companyId,
        creationDate: getBrasiliaDate().toISOString(),
        status: data.status || 'Ativo'
    });
    return { id: docRef.id };
};

export const createSupplierAdmin = async (companyId: string, data: any) => {
    const docRef = await firestore.collection(SUPPLIERS_COLLECTION).add({
        ...data,
        companyId,
        creationDate: getBrasiliaDate().toISOString()
    });
    return { id: docRef.id };
};

export const createVehicleAdmin = async (companyId: string, data: any) => {
    const docRef = await firestore.collection(VEHICLES_COLLECTION).add({
        ...data,
        companyId,
        creationDate: getBrasiliaDate().toISOString(),
        status: data.status || 'Ativo'
    });
    return { id: docRef.id };
};

export const createToolAdmin = async (companyId: string, data: any) => {
    const docRef = await firestore.collection(TOOLS_COLLECTION).add({
        ...data,
        companyId,
        creationDate: getBrasiliaDate().toISOString(),
        status: data.status || 'Disponível'
    });
    return { id: docRef.id };
};

export const getProductsAdmin = async (companyId: string) => {
    let snap = await firestore.collection(PRODUCTS_COLLECTION)
        .where("companyId", "==", companyId)
        .where("status", "==", "Ativo")
        .get();

    let prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(p => !p.deletedAt);

    if (prods.length === 0) {
        const fallbackSnap = await firestore.collection(PRODUCTS_COLLECTION).get();
        prods = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(p => !p.deletedAt && p.status !== 'Inativo');
    }

    return prods;
};
