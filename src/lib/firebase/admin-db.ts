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
            fone: data.phone,
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

    if (targetColl === USERS_COLLECTION) {
        docs = docs.filter(d => d.role !== 'cliente' && d.userType !== 'cliente');
    }

    return docs.map(d => {
        // Simplified return for the AI to handle tokens better
        if (targetColl === CLIENTS_COLLECTION) return { nome: d.name, codigo: d.clientCode, fone: d.phone };
        if (targetColl === PRODUCTS_COLLECTION) return { nome: d.description || d.name, codigo: d.item, estoque: d.stockQuantity };
        if (targetColl === QUOTES_COLLECTION) return { numero: d.quoteNumber, cliente: d.clientName, total: d.total, status: d.status, tecnico: d.assignedTechnicianName };
        if (targetColl === VISITS_COLLECTION) return { numero: d.visitNumber, cliente: d.clientName, status: d.status, data: d.visitDate, tecnico: d.technicianName };
        if (targetColl === ACCOUNTS_RECEIVABLE_COLLECTION) return { id: d.id, cliente: d.clientName, valor: d.amount, vencimento: d.dueDate, status: d.status, os: d.quoteNumber };
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

export const searchTeamMemberAdmin = async (companyId: string, term: string) => {
    const termNormalized = normalizeString(term);
    
    const snap = await firestore.collection(USERS_COLLECTION)
        .where("companyId", "==", companyId)
        .get();
    
    const user = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => !d.deletedAt && d.role !== 'cliente' && d.userType !== 'cliente')
        .find(u => 
            normalizeString(u.displayName || u.name || '').includes(termNormalized) || 
            u.id === term ||
            (u.email && normalizeString(u.email).includes(termNormalized))
        );
        
    if (!user) return { error: `Funcionário(a) "${term}" não encontrado.` };
    
    // Retorna apenas dados relevantes
    return {
        id: user.id,
        nome: user.displayName || user.name,
        cargo: user.role,
        email: user.email,
        fone: user.phone,
        status: user.isOnline ? 'Online' : 'Offline',
        ultimaVezVisto: user.lastLocationUpdated || 'Desconhecido'
    };
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
    const numberMatch = term.match(/\d+/);
    const numberPart = numberMatch ? numberMatch[0] : null;
    const numberPartNoZeros = numberPart ? parseInt(numberPart, 10).toString() : null;
    
    let query = firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId);
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
    
    // Se não achou, tenta por número parcial tolerando zeros à esquerda
    if (!quote && numberPartNoZeros) {
        quote = docs.find(d => {
            if (!d.quoteNumber) return false;
            return d.quoteNumber.includes(numberPart) || 
                   d.quoteNumber.includes(`-${numberPartNoZeros}/`) ||
                   d.quoteNumber.includes(`-${numberPartNoZeros.padStart(4, '0')}/`);
        });
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

    // Busca automaticamente todas as observações, pendências e defeitos vinculados a esta OS
    const obsSnap = await firestore.collection('observations').where('companyId', '==', companyId).get();
    const cleanNumber = quote.quoteNumber ? quote.quoteNumber.toLowerCase() : '';
    const numPart = cleanNumber.match(/\d+/)?.[0] || '';
    const clientNorm = normalizeString(quote.clientName || '');

    const linkedObservations = obsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(d => {
            if (d.status && d.status !== 'Ativo') return false;
            const tags = (d.tags || []).map((t: string) => t.toLowerCase().trim());
            const textLower = (d.text || '').toLowerCase();
            return tags.includes(cleanNumber) || 
                   (numPart && tags.includes(numPart)) ||
                   tags.some((t: string) => cleanNumber.includes(t) || (numPart && t.includes(numPart))) ||
                   (clientNorm && tags.some((t: string) => clientNorm.includes(t) || t.includes(clientNorm))) ||
                   (cleanNumber && textLower.includes(cleanNumber));
        })
        .map(d => ({
            tipo: d.tags?.includes('pendências') || d.tags?.includes('pendencias') ? 'PENDÊNCIA' : (d.tags?.includes('defeito') ? 'DEFEITO' : 'OBSERVAÇÃO'),
            texto: d.text,
            autor: d.author,
            data: d.createdAt
        }));

    return { 
        ...quote,
        items: cleanItems,
        pendencias_e_observacoes_da_os: linkedObservations
    };
};

export const getClientHistoryAdmin = async (companyId: string, clientName: string, technicianId?: string, clientId?: string) => {
    const termNormalized = normalizeString(clientName);

    // 1. Busca primeiro os IDs dos clientes correspondentes
    const clientsSnap = await firestore.collection(CLIENTS_COLLECTION).where("companyId", "==", companyId).get();
    const matchingClientIds = clientsSnap.docs
        .filter(d => {
            const data = d.data();
            const nameNorm = normalizeString(data.name || '');
            const codeNorm = normalizeString(data.clientCode || '');
            const docClean = (data.document || '').replace(/\D/g, '');
            const termClean = clientName.replace(/\D/g, '');
            return nameNorm.includes(termNormalized) || 
                   codeNorm.includes(termNormalized) || 
                   (termClean.length >= 8 && docClean.includes(termClean)) ||
                   d.id === clientId;
        })
        .map(d => d.id);
    
    let queryQuotes = firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId);
    let queryVisits = firestore.collection(VISITS_COLLECTION).where("companyId", "==", companyId);
    let queryFinance = firestore.collection(ACCOUNTS_RECEIVABLE_COLLECTION).where("companyId", "==", companyId);

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

    const isMatch = (d: any) => {
        if (d.deletedAt) return false;
        if (d.clientId && matchingClientIds.includes(d.clientId)) return true;
        if (normalizeString(d.clientName || '').includes(termNormalized)) return true;
        return false;
    };

    const quotes = snapQuotes.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(isMatch)
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
        .filter(isMatch)
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
        .filter(isMatch)
        .map(d => ({
            id: d.id,
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

export const createTeamMemberAdmin = async (companyId: string, data: any) => {
    const snap = await firestore.collection(USERS_COLLECTION).where("companyId", "==", companyId).get();
    
    // Antiduplicidade: Verificar Nome, Telefone ou Email
    const nameNormalized = normalizeString(data.displayName || data.name || "");
    const phoneClean = (data.phone || "").replace(/\D/g, "");
    const emailClean = (data.email || "").toLowerCase().trim();

    const duplicate = snap.docs.find(d => {
        const dData = d.data();
        const dName = normalizeString(dData.displayName || dData.name || "");
        const dPhone = (dData.phone || "").replace(/\D/g, "");
        const dEmail = (dData.email || "").toLowerCase().trim();

        return (nameNormalized && dName === nameNormalized) || 
               (phoneClean && dPhone === phoneClean) ||
               (emailClean && dEmail === emailClean);
    });

    if (duplicate) {
        const dData = duplicate.data();
        throw new Error(`COLABORADOR_DUPLICADO: Já existe um cadastro para "${dData.displayName || dData.name}".`);
    }

    const docRef = await firestore.collection(USERS_COLLECTION).add({
        companyId,
        role: data.role || 'tecnico',
        displayName: data.displayName || data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        userType: 'freelancer', // default se vier via bot para freelancers
        status: 'Ativo',
        createdAt: getBrasiliaDate().toISOString(),
        isOnline: false
    });
    return { id: docRef.id, displayName: data.displayName || data.name };
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
    
    const oldData = snap.data();
    if (targetColl === QUOTES_COLLECTION && data.status === 'Aprovado' && oldData?.status !== 'Aprovado') {
        const aiSettings = await getCompanyAiSettingsAdmin(companyId);
        if (aiSettings && aiSettings.stock_active) {
            const items = oldData?.items || [];
            for (const item of items) {
                if (item.productId && item.quantity > 0) {
                    const prodRef = firestore.collection(PRODUCTS_COLLECTION).doc(item.productId);
                    const prodSnap = await prodRef.get();
                    if (prodSnap.exists) {
                        const currentStock = prodSnap.data()?.stockQuantity || 0;
                        await prodRef.set({
                            stockQuantity: Math.max(0, currentStock - item.quantity)
                        }, { merge: true });
                    }
                }
            }
        }
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

export const addVehicleNoteAdmin = async (companyId: string, vehicleTerm: string, noteText: string) => {
    const snap = await firestore.collection(VEHICLES_COLLECTION).where("companyId", "==", companyId).get();
    const cleanTerm = vehicleTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const doc = snap.docs.find(d => {
        const data = d.data();
        const plate = (data.plate || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const model = (data.model || '').toLowerCase();
        const brand = (data.brand || '').toLowerCase();
        return plate.includes(cleanTerm) || model.includes(vehicleTerm.toLowerCase()) || cleanTerm.includes(plate);
    });

    if (!doc) {
        throw new Error(`Veículo não encontrado pelo termo "${vehicleTerm}".`);
    }

    const currentNotes = doc.data().notes ? doc.data().notes.trim() + '\n' : '';
    const updatedNotes = currentNotes ? `${currentNotes}${noteText}` : noteText;

    await doc.ref.update({
        notes: updatedNotes
    });

    return {
        success: true,
        vehicleId: doc.id,
        plate: doc.data().plate,
        model: doc.data().model,
        updatedNotes
    };
};

export const getProductsAdmin = async (companyId: string) => {
    const snap = await firestore.collection(PRODUCTS_COLLECTION)
        .where("companyId", "==", companyId)
        .get();

    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => !p.deletedAt && p.status !== 'Inativo');
};

export const addOSNoteAdmin = async (companyId: string, osCodeOrId: string, type: 'pendencia' | 'defeito' | 'observacao', text: string, author: string) => {
    try {
        const term = (osCodeOrId || '').trim().toUpperCase();
        const normalizedCode = term.replace('OS-', 'ORC-');
        const numberMatch = term.match(/\d+/);
        const numberPart = numberMatch ? numberMatch[0] : null;
        const numberPartNoZeros = numberPart ? parseInt(numberPart, 10).toString() : null;

        let snap = await firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId).get();
        
        // Busca por ID exato, código de O.S. ou por Placa / TAG / Identificador de Unidade
        let docMatch = snap.docs.find(d => {
            const data = d.data();
            if (d.id === osCodeOrId) return true;
            if (data.unitIdentifier && data.unitIdentifier.toUpperCase().includes(term)) return true;
            if (!data.quoteNumber) return false;
            const qNum = data.quoteNumber.toUpperCase();
            return qNum === term || 
                   qNum === normalizedCode || 
                   qNum === term.replace('OS-', 'ORC-') || 
                   qNum === term.replace('ORC-', 'OS-');
        });

        if (!docMatch && numberPartNoZeros) {
            docMatch = snap.docs.find(d => {
                const data = d.data();
                if (data.unitIdentifier && data.unitIdentifier.toUpperCase().includes(term)) return true;
                if (!data.quoteNumber) return false;
                return data.quoteNumber.includes(numberPart) ||
                       data.quoteNumber.includes(`-${numberPartNoZeros}/`) ||
                       data.quoteNumber.includes(`-${numberPartNoZeros.padStart(4, '0')}/`);
            });
        }

        if (!docMatch) {
            return { error: `Ordem de Serviço ou Unidade "${osCodeOrId}" não encontrada no sistema.` };
        }

        const newNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type,
            text,
            author: author || 'NORA',
            createdAt: new Date().toISOString(),
            status: type === 'pendencia' || type === 'defeito' ? 'Pendente' : 'Registrado'
        };

        const docRef = docMatch.ref;
        const existingNotes = docMatch.data().osNotes || [];
        await docRef.update({
            osNotes: [...existingNotes, newNote]
        });

        const unitTag = docMatch.data().unitIdentifier ? ` (${docMatch.data().unitIdentifier})` : '';

        return { 
            success: true, 
            message: `${type === 'pendencia' ? 'Pendência' : (type === 'defeito' ? 'Defeito' : 'Observação')} registrada com sucesso diretamente na ${docMatch.data().quoteNumber}${unitTag}!`,
            note: newNote,
            osNumber: docMatch.data().quoteNumber,
            unitIdentifier: docMatch.data().unitIdentifier
        };
    } catch (e: any) {
        return { error: 'Falha ao registrar nota na OS: ' + e.message };
    }
};

export const getBudgetPendingSummaryAdmin = async (companyId: string, budgetCode: string) => {
    try {
        const term = (budgetCode || '').trim().toUpperCase();
        const numberMatch = term.match(/\d+/);
        const numberPart = numberMatch ? numberMatch[0] : null;

        let snap = await firestore.collection(QUOTES_COLLECTION).where("companyId", "==", companyId).get();
        const allQuotes = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(q => !q.deletedAt);

        // Localiza todas as O.S. / Orçamento correspondentes
        const matchedOrders = allQuotes.filter(q => {
            const qNum = (q.quoteNumber || '').toUpperCase();
            const parentNum = (q.parentQuoteNumber || '').toUpperCase();
            const parentId = q.parentQuoteId || '';

            const matchesNum = qNum.includes(term) || (numberPart && qNum.includes(numberPart));
            const matchesParent = parentNum.includes(term) || (numberPart && parentNum.includes(numberPart));
            const matchesParentId = parentId === term;

            return matchesNum || matchesParent || matchesParentId;
        });

        if (matchedOrders.length === 0) {
            return { error: `Nenhum orçamento ou ordem de serviço encontrado para "${budgetCode}".` };
        }

        const parent = matchedOrders.find(q => !q.isChildOS) || matchedOrders[0];
        const childOrders = matchedOrders.filter(q => q.isChildOS || q.id !== parent.id);

        const totalOrders = childOrders.length > 0 ? childOrders.length : 1;
        const targetList = childOrders.length > 0 ? childOrders : [parent];

        const completedOrders = targetList.filter(q => q.status === 'Finalizado');
        const inProgressOrders = targetList.filter(q => ['Em Execução', 'Atribuída', 'Agendado'].includes(q.status));
        const pendingOrders = targetList.filter(q => q.status === 'Pendente');

        const unitsDetail = targetList.map(q => {
            const notesList = (q.osNotes || []).map((n: any) => `[${n.type.toUpperCase()}] ${n.text} (${n.author || 'NORA'})`);
            if (q.notes) notesList.push(`[RELATÓRIO/NOTAS]: ${q.notes}`);

            return {
                osNumber: q.quoteNumber.replace('ORC', 'OS'),
                identificacao: q.unitIdentifier || 'Unidade Principal',
                status: q.status,
                tecnico: q.assignedTechnicianName || 'Não atribuído',
                inicio: q.scheduledDate || 'Não agendado',
                previsaoTermino: q.expectedEndDate || q.scheduledDate || 'Não definida',
                observacoesEPendencias: notesList.length > 0 ? notesList : ['Sem observações']
            };
        });

        return {
            orcamentoNumero: parent.quoteNumber,
            cliente: parent.clientName,
            totalOS: totalOrders,
            concluidas: completedOrders.length,
            emAndamento: inProgressOrders.length,
            pendentes: pendingOrders.length,
            unidades: unitsDetail,
            totalGeral: parent.total,
            resumo: `Orçamento ${parent.quoteNumber}: ${completedOrders.length} de ${totalOrders} O.S. concluídas (${Math.round((completedOrders.length / totalOrders) * 100)}%). ${inProgressOrders.length + pendingOrders.length} ainda em aberto.`
        };
    } catch (e: any) {
        return { error: 'Falha ao buscar resumo de pendências: ' + e.message };
    }
};

export const settleReceivableAdmin = async (companyId: string, options: { clientName?: string; quoteNumber?: string; receivableId?: string; paymentDate?: string }) => {
    try {
        const { clientName, quoteNumber, receivableId, paymentDate } = options;
        const nowISO = paymentDate || getBrasiliaDate().toISOString();

        let snap = await firestore.collection(ACCOUNTS_RECEIVABLE_COLLECTION).where("companyId", "==", companyId).get();
        let docsToSettle = snap.docs.filter(d => !d.data().deletedAt && d.data().status !== 'Pago');

        if (receivableId) {
            docsToSettle = docsToSettle.filter(d => d.id === receivableId);
        } else if (quoteNumber) {
            const cleanQ = quoteNumber.trim().toUpperCase().replace('OS-', '').replace('ORC-', '');
            docsToSettle = docsToSettle.filter(d => {
                const q = (d.data().quoteNumber || '').toUpperCase();
                return q.includes(cleanQ) || q === quoteNumber.trim().toUpperCase();
            });
        } else if (clientName) {
            const termNorm = normalizeString(clientName);
            docsToSettle = docsToSettle.filter(d => normalizeString(d.data().clientName || '').includes(termNorm));
        } else {
            return { error: 'Informe o nome do cliente, número da OS ou ID da conta a receber para dar baixa.' };
        }

        if (docsToSettle.length === 0) {
            return { error: 'Nenhuma conta a receber pendente foi encontrada com os critérios informados.' };
        }

        const batch = firestore.batch();
        const settledList: any[] = [];
        let totalAmount = 0;

        docsToSettle.forEach(doc => {
            const data = doc.data();
            batch.update(doc.ref, {
                status: 'Pago',
                paymentDate: nowISO
            });
            totalAmount += (data.amount || 0);
            settledList.push({
                id: doc.id,
                cliente: data.clientName,
                os: data.quoteNumber,
                valor: data.amount,
                vencimento: data.dueDate
            });
        });

        await batch.commit();

        return {
            success: true,
            message: `${settledList.length} conta(s) a receber marcada(s) como PAGA(S) com sucesso! Total baixado: ${totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
            contas_baixadas: settledList,
            total_baixado: totalAmount
        };
    } catch (e: any) {
        return { error: 'Falha ao dar baixa nas contas a receber: ' + e.message };
    }
};

export const addObservationAdmin = async (companyId: string, tags: string[], text: string, author: string, scope: string = 'local') => {
    try {
        const targetCompanyId = scope === 'global' ? 'GLOBAL' : companyId;
        const docRef = await firestore.collection('observations').add({
            companyId: targetCompanyId,
            tags: tags.map(t => t.toLowerCase().trim()),
            text,
            author,
            createdAt: new Date().toISOString(),
            status: 'Ativo'
        });
        return { success: true, id: docRef.id, message: 'Observação registrada com sucesso.' };
    } catch (e: any) {
        return { error: 'Falha ao registrar observação: ' + e.message };
    }
};

export const searchObservationsAdmin = async (companyId: string, tags: string[]) => {
    try {
        const [snapLocal, snapGlobal] = await Promise.all([
            firestore.collection('observations').where('companyId', '==', companyId).get(),
            firestore.collection('observations').where('companyId', '==', 'GLOBAL').get()
        ]);
        
        const formattedTags = (tags || []).map(t => t.toLowerCase().trim()).filter(Boolean);
        
        const filterDoc = (d: any, source: string) => {
            const data = d.data();
            if (data.status && data.status !== 'Ativo') return null;
            
            const docTags: string[] = (data.tags || []).map((t: string) => t.toLowerCase().trim());
            const textLower = (data.text || '').toLowerCase();
            
            if (formattedTags.length > 0) {
                const matches = formattedTags.some(searchTag => 
                    docTags.some(docTag => docTag.includes(searchTag) || searchTag.includes(docTag)) ||
                    textLower.includes(searchTag)
                );
                if (!matches) return null;
            }
            
            return { id: d.id, ...data, source };
        };
        
        const localDocs = snapLocal.docs.map(d => filterDoc(d, 'local')).filter(Boolean);
        const globalDocs = snapGlobal.docs.map(d => filterDoc(d, 'global')).filter(Boolean);
        
        const allDocs = [...globalDocs, ...localDocs]
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 20);
            
        return allDocs;
    } catch (e: any) {
        return { error: 'Falha ao buscar observações: ' + e.message };
    }
};

export const scheduleMessageAdmin = async (companyId: string, recipientName: string, phone: string, messageText: string, scheduledAt: string, author: string) => {
    try {
        const docRef = await firestore.collection('scheduled_messages').add({
            companyId,
            recipientName,
            phone,
            messageText,
            scheduledAt,
            author,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        return { success: true, id: docRef.id, message: `Mensagem agendada com sucesso para ${scheduledAt}.` };
    } catch (e: any) {
        return { error: 'Falha ao agendar mensagem: ' + e.message };
    }
};

export const createNotaFiscalAdmin = async (companyId: string, notaData: any) => {
    try {
        const docRef = await firestore.collection('notas_fiscais').add({
            companyId,
            ...notaData,
            status: 'Pendente de Conferência',
            dataImportacao: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        });
        return { success: true, id: docRef.id, message: `Nota fiscal registrada com sucesso (ID: ${docRef.id}). Status: Pendente de Conferência.` };
    } catch (e: any) {
        return { error: 'Falha ao registrar nota fiscal: ' + e.message };
    }
};

export const addFotoOSAdmin = async (companyId: string, osId: string, url: string, descricao: string, enviadoPor: string) => {
    try {
        const osRef = firestore.collection(QUOTES_COLLECTION).doc(osId);
        const doc = await osRef.get();
        if (!doc.exists) {
            return { error: `Ordem de Serviço (ou orçamento) ${osId} não encontrada.` };
        }
        
        const osData = doc.data();
        if (osData?.companyId !== companyId) {
            return { error: 'Sem permissão para alterar esta O.S.' };
        }

        const admin = require('firebase-admin');
        const novaFoto = {
            id: firestore.collection('temp').doc().id,
            url,
            descricao: descricao || 'Foto anexada',
            dataUpload: new Date().toISOString(),
            enviadoPor: enviadoPor || 'NORA'
        };

        await osRef.update({
            fotos: admin.firestore.FieldValue.arrayUnion(novaFoto),
            updatedAt: new Date().toISOString()
        });

        return { success: true, message: `Foto anexada com sucesso à O.S. ${osId}.` };
    } catch (e: any) {
        return { error: 'Falha ao anexar foto: ' + e.message };
    }
};

export const getCompanyAdmin = async (companyId: string) => {
    try {
        const doc = await firestore.collection(COMPANIES_COLLECTION).doc(companyId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as any;
    } catch (e) {
        console.error("Error fetching company:", e);
        return null;
    }
};

export const getCompanyAiSettingsAdmin = async (companyId: string) => {
    try {
        const doc = await firestore.collection(COMPANIES_COLLECTION).doc(companyId).get();
        if (!doc.exists) return null;
        const data = doc.data();
        return data?.ai_autonomy || {
            finance_active: false,
            stock_active: false,
            marketing_active: false,
            operational_active: false
        };
    } catch (e) {
        console.error("Error fetching AI settings:", e);
        return null;
    }
};

export const processPaymentReceiptAdmin = async (companyId: string, receiptData: any) => {
    try {
        // Find matching receivable based on value and approx date/payer
        const { value, payerName, date } = receiptData;
        const numValue = parseFloat(value.replace(',', '.'));
        
        const snap = await firestore.collection(ACCOUNTS_RECEIVABLE_COLLECTION)
            .where("companyId", "==", companyId)
            .where("status", "in", ["pending", "overdue"])
            .get();
            
        let matchedDoc = null;
        for (const doc of snap.docs) {
            const data = doc.data();
            // Basic matching logic: check if values match within a small margin
            if (Math.abs(Number(data.value) - numValue) < 0.1) {
                // To be safe, we could also check payer name if available, but for MVP we match value.
                matchedDoc = { id: doc.id, ...data };
                break;
            }
        }

        if (!matchedDoc) {
            return { error: `Não encontrei nenhuma conta a receber pendente no valor de R$ ${value}.` };
        }

        await firestore.collection(ACCOUNTS_RECEIVABLE_COLLECTION).doc(matchedDoc.id).update({
            status: "paid",
            paymentDate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            receiptData: receiptData
        });

        return { success: true, message: `Baixa efetuada na conta (Ref: ${(matchedDoc as any).description || matchedDoc.id}) no valor de R$ ${value}.` };
    } catch (e: any) {
        return { error: 'Falha ao processar comprovante: ' + e.message };
    }
};

export const editQuoteItemsAdmin = async (companyId: string, quoteId: string, newItems: Array<{name: string, quantity: number}>, userDisplayName: string) => {
    try {
        const quoteRef = firestore.collection(QUOTES_COLLECTION).doc(quoteId);
        const quoteSnap = await quoteRef.get();
        if (!quoteSnap.exists || quoteSnap.data()?.companyId !== companyId) {
            return { error: 'Orçamento não encontrado.' };
        }

        const productsSnap = await firestore.collection(PRODUCTS_COLLECTION)
            .where("companyId", "==", companyId)
            .get();
        const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const updatedItems = [];
        let newTotal = 0;

        for (const inputItem of newItems) {
            const nameNorm = normalizeString(inputItem.name);
            const product = allProducts.find(p => normalizeString(p.description).includes(nameNorm));
            
            if (product) {
                const itemTotal = (product.sellingPrice || 0) * inputItem.quantity;
                updatedItems.push({
                    productId: product.id,
                    description: product.description,
                    quantity: inputItem.quantity,
                    materialPrice: product.sellingPrice || 0,
                    servicePrice: 0,
                    total: itemTotal
                });
                newTotal += itemTotal;
            } else {
                return { error: `Produto "${inputItem.name}" não encontrado na tabela oficial. Cadastre o produto primeiro.` };
            }
        }

        await quoteRef.set({
            items: updatedItems,
            total: newTotal,
            updatedAt: getBrasiliaDate().toISOString()
        }, { merge: true });

        return { success: true, message: `Orçamento atualizado com sucesso! Novo total: R$ ${newTotal}`, newTotal };
    } catch (e: any) {
        return { error: 'Erro ao editar itens: ' + e.message };
    }
};
