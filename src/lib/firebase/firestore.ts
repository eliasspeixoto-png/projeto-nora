
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
  deleteField,
  Firestore,
  limit,
  orderBy,
  increment,
  and,
} from "firebase/firestore";
import { subDays } from "date-fns";
import { Auth } from "firebase/auth";
import type { 
    Product, Client, Quote, Company, UserProfile, Visit, AccountsReceivable, 
    ComodatoAsset, Supplier, PurchaseOrder, Vehicle, StockLocation, 
    QuoteData, Tool, LocationPoint, Communication, Note, DistributorClick, Promotion, OSReturn, Lead
} from "@/lib/data";
import { addDays, startOfMonth, parseISO, format, isPast } from "date-fns";

// Helper to sanitize data for Firestore (removes undefined values recursively)
export const sanitizeData = (data: any): any => {
    // If not an object or array, or is null, or is a Date/special object, return as-is
    if (!data || typeof data !== 'object') return data;
    
    // Don't sanitize Date objects (they have no enumerable keys but are handled by Firestore)
    if (data instanceof Date || Object.prototype.toString.call(data) === '[object Date]') {
        return data;
    }

    // Handle arrays: sanitize each item
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }
    
    // If it's not a plain object (e.g., a class instance that Firestore might handle), 
    // but we want to be safe, we only sanitize plain objects.
    if (Object.prototype.toString.call(data) !== '[object Object]') {
        return data;
    }

    const sanitized: any = {};
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (value !== undefined) {
            if (value !== null && typeof value === 'object') {
                sanitized[key] = sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }
    });
    return sanitized;
};

import { getBrasiliaDate, getTodayBrasiliaISO } from "@/lib/utils";

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
const LOCATION_HISTORY_COLLECTION = "locationHistory";
const OS_RETURNS_COLLECTION = "osReturns";
const LEADS_COLLECTION = "leads";

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

export const getCollectionStatsOnce = async (db: Firestore, companyId: string, collectionName: string) => {
    const collNormalized = collectionName.toLowerCase().trim();
    const targetColl = COLLECTION_MAP[collNormalized] || collNormalized;
    
    let q = query(collection(db, targetColl), where("companyId", "==", companyId));
    
    if (targetColl === QUOTES_COLLECTION) {
        if (collNormalized.includes('os') || collNormalized.includes('servico') || collNormalized.includes('tarefas')) {
            q = query(q, where("status", "not-in", ["draft", "sent", "rejected"]));
        } else {
            q = query(q, where("status", "in", ["draft", "sent", "rejected", "Aprovado", "revision-pending"]));
        }
    }

    const snap = await getCountFromServer(q);
    return { count: snap.data().count };
};

export const getDetailedListOnce = async (db: Firestore, companyId: string, collectionName: string, statusFilter?: string) => {
    const collNormalized = collectionName.toLowerCase().trim();
    const targetColl = COLLECTION_MAP[collNormalized] || collNormalized;
    
    let q = query(collection(db, targetColl), where("companyId", "==", companyId), limit(200));
    
    if (statusFilter && statusFilter !== 'all') {
        q = query(q, where("status", "==", statusFilter));
    }

    const snap = await getDocs(q);
    return snap.docs
        .map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                nome: d.name || d.displayName || d.description || d.clientName || d.supplierName || d['DESCRIÇÃO'] || d['DESCRICAO'] || 'N/A',
                status: d.status || d['STATUS'] || 'N/A',
                valor: d.total || d.amount || d.totalAmount || d.sellingPrice || d.serviceValue || d['PREÇO DE VENDA'] || d['PRECO DE VENDA'] || 0,
                data: d.date || d.completionDate || d.visitDate || d.creationDate || d.sentAt || d.dueDate || '',
                numero: d.quoteNumber || d.orderNumber || d.visitNumber || d.clientCode || d.item || d['CÓDIGO'] || d['CODIGO'] || '',
                detalhes: d.notes || d.message || d.osType || '',
                deletedAt: d.deletedAt
            };
        })
        .filter(item => !item.deletedAt);
};

export const getFinancialSummaryOnce = async (db: Firestore, companyId: string) => {
    const q = query(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const receivables = snap.docs.map(d => d.data() as AccountsReceivable);
    
    const today = getBrasiliaDate();
    const startOfThisMonth = startOfMonth(today);

    const qApproved = query(
        collection(db, QUOTES_COLLECTION), 
        where("companyId", "==", companyId),
        where("status", "in", ["Aprovado", "Agendado", "Atribuída", "Em Execução", "Finalizado"])
    );
    const snapApproved = await getDocs(qApproved);
    
    const approvedThisMonth = snapApproved.docs.filter(doc => {
        const d = doc.data() as Quote;
        if (d.deletedAt) return false;
        const date = d.approvalDate ? parseISO(d.approvalDate) : (d.date ? parseISO(d.date) : null);
        return date && date >= startOfThisMonth;
    });

    const qClients = query(collection(db, CLIENTS_COLLECTION), where("companyId", "==", companyId), where("isComodato", "==", true));
    const snapClients = await getDocs(qClients);
    const comodatoRevenue = snapClients.docs
        .map(d => d.data())
        .filter(d => !d.deletedAt)
        .reduce((sum, data) => {
            const val = typeof data.serviceValue === 'string'
                ? parseFloat(data.serviceValue.replace(',', '.'))
                : (data.serviceValue || 0);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

    return {
        total_vencido_a_receber: receivables.filter(r => r.status !== 'Pago' && isPast(parseISO(r.dueDate))).reduce((sum, r) => sum + r.amount, 0),
        total_a_vencer_a_receber: receivables.filter(r => r.status !== 'Pago' && !isPast(parseISO(r.dueDate))).reduce((sum, r) => sum + r.amount, 0),
        recebido_no_mes: receivables.filter(r => r.status === 'Pago' && r.paymentDate && parseISO(r.paymentDate) >= startOfThisMonth).reduce((sum, r) => sum + r.amount, 0),
        qtd_contas_a_receber_pendentes: receivables.filter(r => r.status !== 'Pago').length,
        vendas_aprovadas_mes: approvedThisMonth.length,
        valor_aprovado_mes: approvedThisMonth.reduce((sum, q) => sum + (q.data() as Quote).total, 0),
        faturamento_comodato_mensal: comodatoRevenue,
        qtd_contratos_comodato: snapClients.docs.filter(d => !d.data().deletedAt).length
    };
};

export const getPurchaseSummaryOnce = async (db: Firestore, companyId: string) => {
    const q = query(collection(db, PURCHASE_ORDERS_COLLECTION), where("companyId", "==", companyId), where("status", "==", "Recebido"));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => d.data() as PurchaseOrder).filter(o => !o.deletedAt);
    
    const today = getBrasiliaDate();
    const startOfThisMonth = startOfMonth(today);

    return {
        total_compras_mes: data.filter(o => parseISO(o.creationDate) >= startOfThisMonth).reduce((sum, o) => sum + o.totalAmount, 0),
        total_compras_geral: data.reduce((sum, o) => sum + o.totalAmount, 0),
        qtd_pedidos_recebidos: data.length
    };
};

export const getCriticalStockOnce = async (db: Firestore, companyId: string) => {
    const q = query(collection(db, PRODUCTS_COLLECTION), where("companyId", "==", companyId), where("status", "==", "Ativo"));
    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)).filter(p => !p.deletedAt);
    return products
        .filter(p => (p.stockQuantity || 0) <= (p.minStockQuantity || 0))
        .map(p => ({
            nome: p.description,
            codigo: p.item,
            estoque: p.stockQuantity,
            minimo: p.minStockQuantity
        }));
};

export const getPendingTasksOnce = async (db: Firestore, companyId: string) => {
    const q = query(collection(db, QUOTES_COLLECTION), where("companyId", "==", companyId), where("status", "in", ["Pendente", "Atribuída", "Em Execução", "Agendado"]));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => d.data() as Quote)
        .filter(d => !d.deletedAt)
        .map(data => {
            return {
                numero: data.quoteNumber.replace('ORC', 'OS'),
                cliente: data.clientName,
                status: data.status,
                data: data.scheduledDate || data.date
            };
        });
};

export const getTodayVisitsOnce = async (db: Firestore, companyId: string) => {
    const todayStr = getTodayBrasiliaISO();
    const q = query(collection(db, VISITS_COLLECTION), where("companyId", "==", companyId), where("visitDate", "==", todayStr));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => d.data() as Visit)
        .filter(d => !d.deletedAt)
        .map(data => {
            return {
                numero: data.visitNumber,
                cliente: data.clientName,
                hora: data.time,
                tecnico: data.technicianName,
                status: data.status
            };
        });
};

export const getOnlineTeamOnce = async (db: Firestore, companyId: string) => {
    const q = query(collection(db, USERS_COLLECTION), where("companyId", "==", companyId), where("isOnline", "==", true));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile & { uid: string }))
        .filter(d => !d.deletedAt)
        .map(data => {
            return {
                uid: data.uid,
                nome: data.displayName,
                cargo: data.role,
                ultimo_servico: 'Ativo',
                ultima_atualizacao: data.lastLocationUpdated || new Date().toISOString()
            };
        });
};

export const searchClientByCodeOrName = async (db: Firestore, companyId: string, term: string) => {
    const termNormalized = term.toLowerCase().trim();
    const q = query(collection(db, CLIENTS_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Client))
        .filter(c => !c.deletedAt && (
            c.name.toLowerCase().includes(termNormalized) || 
            (c.clientCode && c.clientCode.toLowerCase().includes(termNormalized)) ||
            (c.document && c.document.includes(termNormalized))
        ))
        .map(c => ({
            nome: c.name,
            codigo: c.clientCode,
            telefone: c.phone,
            email: c.email,
            comodato: c.isComodato ? 'Sim' : 'Não',
            endereco: `${c.street || ''}, ${c.number || ''} - ${c.city || ''}`
        }));
};

export const getCompany = async (db: Firestore, id: string): Promise<Company | null> => {
    const snap = await getDoc(doc(db, COMPANIES_COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Company : null;
};

export const updateCompany = async (db: Firestore, id: string, data: Partial<Company>) => {
    await setDoc(doc(db, COMPANIES_COLLECTION, id), data, { merge: true });
};

export const getProducts = (db: Firestore, companyId: string, onUpdate: (data: Product[]) => void, onError: (e: any) => void, filter: string = 'Ativo') => {
    let q = query(collection(db, PRODUCTS_COLLECTION), where("companyId", "==", companyId));
    if (filter !== 'Todos') q = query(q, where("status", "==", filter));
    q = query(q, limit(2000));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Product))
            .filter(p => !p.deletedAt)
        );
    }, onError);
};

export const getProductsOnce = async (db: Firestore, companyId: string, filter: string = 'Ativo'): Promise<Product[]> => {
    let q = query(collection(db, PRODUCTS_COLLECTION), where("companyId", "==", companyId));
    if (filter !== 'Todos') q = query(q, where("status", "==", filter));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Product))
        .filter(p => !p.deletedAt);
};

export const addProduct = async (db: Firestore, data: any) => {
    const { companyId, item, description } = data;
    const existingProducts = await getProductsOnce(db, companyId, 'Todos');
    
    const duplicate = existingProducts.find(p => {
        const itemData = p as any;
        const existingCode = p.item || itemData['CÓDIGO'] || itemData['CODIGO'];
        const existingDesc = (p.description || itemData['DESCRIÇÃO'] || itemData['DESCRICAO'] || '').toLowerCase();
        
        return (item && String(existingCode) === String(item)) || 
               (description && existingDesc === description.toLowerCase());
    });

    if (duplicate) {
        throw new Error(`Produto já cadastrado! (Código: ${item} ou Nome: ${description})`);
    }

    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), { 
        ...data, 
        creationDate: getBrasiliaDate().toISOString() 
    });
    return docRef.id;
};

export const updateProduct = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, PRODUCTS_COLLECTION, id), data, { merge: true });
};

export const deleteProduct = async (db: Firestore, id: string) => {
    await setDoc(doc(db, PRODUCTS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const bulkAddProducts = async (db: Firestore, companyId: string, json: any[], suppliers: Supplier[], locations: StockLocation[]) => {
    const batch = writeBatch(db);
    const now = getBrasiliaDate().toISOString();
    let added = 0;
    let updated = 0;

    const existingProducts = await getProductsOnce(db, companyId, 'Todos');
    const existingByCode = new Map<string, string>();
    const existingByName = new Map<string, string>();

    existingProducts.forEach(p => {
        const itemData = p as any;
        const code = p.item || itemData['CÓDIGO'] || itemData['CODIGO'];
        const desc = (p.description || itemData['DESCRIÇÃO'] || itemData['DESCRICAO'] || '').toLowerCase();
        if (code) existingByCode.set(String(code), p.id);
        if (desc) existingByName.set(desc, p.id);
    });

    const findSupplierId = (name: string) => {
        if (!name) return '';
        const lowerName = name.toLowerCase().trim();
        return suppliers.find(s => s.name.toLowerCase().includes(lowerName))?.id || '';
    };

    const findLocationId = (name: string) => {
        if (!name) return '';
        const lowerName = name.toLowerCase().trim();
        return locations.find(l => l.name.toLowerCase().includes(lowerName))?.id || '';
    };

    for (const rawItem of json) {
        const rawCode = String(rawItem['CÓDIGO'] || rawItem['CODIGO'] || rawItem['item'] || rawItem['Code'] || '');
        const rawDesc = rawItem['DESCRIÇÃO'] || rawItem['DESCRICAO'] || rawItem['description'] || '';
        
        let existingId = (rawCode && existingByCode.get(rawCode)) || existingByName.get(rawDesc.toLowerCase());
        
        const item: any = {
            companyId,
            status: rawItem['STATUS'] || rawItem['status'] || 'Ativo',
            item: rawCode,
            description: rawDesc,
            detailedDescription: rawItem['DESCRIÇÃO DETALHADA'] || rawItem['detailedDescription'] || '',
            model: rawItem['MODELO'] || rawItem['model'] || '',
            manufacturer: rawItem['FABRICANTE'] || rawItem['manufacturer'] || '',
            unit: rawItem['UNIDADE'] || rawItem['unit'] || 'UNID',
            materialPrice: Number(rawItem['PREÇO DE CUSTO'] || rawItem['PRECO DE CUSTO'] || rawItem['materialPrice'] || 0),
            sellingPrice: Number(rawItem['PREÇO DE VENDA'] || rawItem['PRECO DE VENDA'] || rawItem['sellingPrice'] || 0),
            servicePrice: Number(rawItem['PREÇO DE SERVIÇO'] || rawItem['PRECO DE SERVICO'] || rawItem['servicePrice'] || 0),
            segment: rawItem['CATEGORIA'] || rawItem['segment'] || 'OUTROS',
            notes: rawItem['NOTAS'] || rawItem['notes'] || '',
            imageUrl: rawItem['URL IMAGEM'] || rawItem['imageUrl'] || '',
            distributor: rawItem['DISTRIBUIDOR'] || rawItem['distributor'] || '',
            DISTRIBUIDOR: rawItem['DISTRIBUIDOR'] || rawItem['distributor'] || '', 
            mainSupplierId: rawItem['mainSupplierId'] || findSupplierId(rawItem['DISTRIBUIDOR'] || rawItem['distributor']),
            stockQuantity: Number(rawItem['ESTOQUE TOTAL'] || rawItem['stockQuantity'] || 0),
            minStockQuantity: Number(rawItem['ESTOQUE MÍNIMO'] || rawItem['minStockQuantity'] || 0),
            stockLevels: {}
        };

        Object.keys(rawItem).forEach(key => {
            if (key.startsWith('ESTOQUE ')) {
                const locName = key.replace('ESTOQUE ', '');
                const locId = findLocationId(locName);
                if (locId) item.stockLevels[locId] = Number(rawItem[key] || 0);
            }
        });

        if (existingId) {
            batch.update(doc(db, PRODUCTS_COLLECTION, existingId), item);
            updated++;
        } else {
            const newRef = doc(collection(db, PRODUCTS_COLLECTION));
            batch.set(newRef, { ...item, creationDate: now });
            added++;
        }
    }
    await batch.commit();
    return { added, updated, skipped: 0 };
};

export const bulkAddProductsFromDistributor = async (db: Firestore, companyId: string, products: Product[]) => {
    const batch = writeBatch(db);
    let added = 0;
    for (const p of products) {
        const { id, stockQuantity, stockLevels, ...rest } = p;
        const ref = doc(collection(db, PRODUCTS_COLLECTION));
        batch.set(ref, { ...rest, companyId, materialPrice: p.sellingPrice, sellingPrice: parseFloat((p.sellingPrice * 1.4).toFixed(2)), stockQuantity: 0, originProductId: id });
        added++;
    }
    await batch.commit();
    return added;
};

export const bulkUpdateProductPrices = async (db: Firestore, companyId: string, productIds: string[], percentage: number, priceTypes: string[]) => {
    const batch = writeBatch(db);
    for (const id of productIds) {
        const ref = doc(db, PRODUCTS_COLLECTION, id);
        const update: any = {};
        const snap = await getDoc(ref);
        const data = snap.data();
        if (data) {
            priceTypes.forEach(type => {
                const current = data[type] || 0;
                update[type] = parseFloat((current * (1 + percentage / 100)).toFixed(2));
            });
            batch.update(ref, update);
        }
    }
    await batch.commit();
};

export const bulkUpdateClientServiceValues = async (db: Firestore, companyId: string, clientIds: string[], percentage: number) => {
    const batch = writeBatch(db);
    for (const id of clientIds) {
        const ref = doc(db, CLIENTS_COLLECTION, id);
        const snap = await getDoc(ref);
        const data = snap.data();
        if (data && data.serviceValue) {
            const current = typeof data.serviceValue === 'string' ? parseFloat(data.serviceValue) : data.serviceValue;
            const newValue = parseFloat((current * (1 + percentage / 100)).toFixed(2));
            batch.update(ref, { serviceValue: newValue });
        }
    }
    await batch.commit();
};

export const getClients = (db: Firestore, companyId: string, onUpdate: (data: Client[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, CLIENTS_COLLECTION), where("companyId", "==", companyId), limit(300));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Client))
            .filter(c => !c.deletedAt)
        );
    }, onError);
};

export const getClientsOnce = async (db: Firestore, companyId: string): Promise<Client[]> => {
    const q = query(collection(db, CLIENTS_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Client))
        .filter(c => !c.deletedAt);
};

export const addClient = async (db: Firestore, auth: Auth, data: any) => {
    const countSnap = await getCountFromServer(query(collection(db, CLIENTS_COLLECTION), where("companyId", "==", data.companyId)));
    const clientCode = `CLI-${(countSnap.data().count + 1).toString().padStart(4, '0')}`;
    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), { ...data, clientCode, creationDate: getBrasiliaDate().toISOString() });
    return docRef.id;
};

export const getClient = async (db: Firestore, id: string): Promise<Client | null> => {
    const snap = await getDoc(doc(db, CLIENTS_COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Client : null;
};

export const getUserByClientId = async (db: Firestore, clientId: string): Promise<UserProfile | null> => {
    const q = query(collection(db, USERS_COLLECTION), where("clientId", "==", clientId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const doc = snap.docs[0];
        return { uid: doc.id, ...doc.data() } as UserProfile;
    }
    return null;
};

export const updateClient = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, CLIENTS_COLLECTION, id), data, { merge: true });
};

export const deleteClient = async (db: Firestore, id: string) => {
    await setDoc(doc(db, CLIENTS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const getQuotes = (db: Firestore, companyId: string, user: any, onUpdate: (data: Quote[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, QUOTES_COLLECTION), where("companyId", "==", companyId), limit(300));
    return onSnapshot(q, (snap) => {
        let quotes = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Quote))
            .filter(q => !q.deletedAt);
        if (user.role === 'tecnico') quotes = quotes.filter(q => q.assignedTechnicianId === user.uid);
        if (user.role === 'cliente') quotes = quotes.filter(q => q.clientId === user.clientId);
        onUpdate(quotes);
    }, onError);
};

export const getQuotesOnce = async (db: Firestore, companyId: string, user: any, daysLimit: number | null = 60): Promise<Quote[]> => {
    const q = query(collection(db, QUOTES_COLLECTION), where("companyId", "==", companyId), limit(500));
    
    const snap = await getDocs(q);
    let quotes = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quote));

    // Filtragem em memória para evitar erro de índice no Firestore
    if (daysLimit) {
        const thresholdDate = subDays(getBrasiliaDate(), daysLimit).toISOString();
        quotes = quotes.filter(q => {
            // Keep pending tasks regardless of date
            if (['Pendente', 'Atribuída', 'Em Execução', 'Agendado', 'sent', 'revision-pending'].includes(q.status)) return true;
            return q.date && q.date >= thresholdDate;
        });
    }

    quotes = quotes.filter(q => !q.deletedAt);

    if (user.role === 'tecnico') quotes = quotes.filter(q => q.assignedTechnicianId === user.uid);
    if (user.role === 'cliente') quotes = quotes.filter(q => q.clientId === user.clientId);
    return quotes;
};

export const getQuote = async (db: Firestore, id: string): Promise<Quote | null> => {
    const snap = await getDoc(doc(db, QUOTES_COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Quote : null;
};

export const addQuote = async (db: Firestore, auth: Auth, data: QuoteData) => {
    const year = getBrasiliaDate().getFullYear().toString().slice(-2);
    const isComodato = data.isComodato || data.serviceType === 'Comodato' || !!data.comodatoType;
    const prefix = isComodato ? 'PRO' : 'ORC';
    
    // Simplificamos a query para apenas o companyId para evitar necessidade de índices compostos
    const q = query(collection(db, QUOTES_COLLECTION), where("companyId", "==", data.companyId));
    const snap = await getDocs(q);
    
    // Filtramos em memória pelo prefixo e pelo ano atual
    const samePrefixQuotes = snap.docs
        .map(d => d.data().quoteNumber as string)
        .filter(num => num && num.startsWith(`${prefix}-`) && num.endsWith(`/${year}`));

    let nextNumber = 1;
    if (samePrefixQuotes.length > 0) {
        // Extraímos os números e encontramos o maior para este prefixo
        const numbers = samePrefixQuotes.map((num: string) => {
            const match = num.match(/-(\d+)\//);
            return match ? parseInt(match[1]) : 0;
        });
        nextNumber = Math.max(...numbers) + 1;
    }

    const numberStr = nextNumber.toString().padStart(4, '0');
    const quoteNumber = `${prefix}-${numberStr}/${year}`;

    const docRef = await addDoc(collection(db, QUOTES_COLLECTION), {
        ...data,
        quoteNumber,
        date: getBrasiliaDate().toISOString(),
        creatorName: auth.currentUser?.displayName
    });
    return { id: docRef.id, quoteNumber };
};

export const updateQuote = async (db: Firestore, auth: Auth, id: string, data: any) => {
    await setDoc(doc(db, QUOTES_COLLECTION, id), data, { merge: true });
    
    if (data.total !== undefined) {
        let companyId = data.companyId;
        if (!companyId) {
            const quoteSnap = await getDoc(doc(db, QUOTES_COLLECTION, id));
            companyId = quoteSnap.data()?.companyId;
        }
        
        if (companyId) {
            const q = query(
                collection(db, ACCOUNTS_RECEIVABLE_COLLECTION),
                where("companyId", "==", companyId),
                where("quoteId", "==", id)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const batch = writeBatch(db);
                snap.docs.forEach(receivableDoc => {
                    batch.update(receivableDoc.ref, {
                        amount: data.total,
                        originalAmount: data.total
                    });
                });
                await batch.commit();
            }
        }
    }
};

export const decrementStockFromQuote = async (db: Firestore, quote: Quote) => {
    if (!quote.items || quote.items.length === 0) return;
    
    const batch = writeBatch(db);
    let itemsToDecrement = 0;

    for (const item of quote.items) {
        // Ignora serviços. Assume-se que produtos físicos não usam a palavra 'SERVIÇOS' no segmento
        if (item.product.segment === 'SERVIÇOS') continue;
        if (!item.product.id) continue;

        const productRef = doc(db, PRODUCTS_COLLECTION, item.product.id);
        const updates: any = {
            stockQuantity: increment(-item.quantity)
        };

        // Abate também do local principal se tiver sido setado (multi-estoque)
        if (item.locationId) {
            updates[`stockLevels.${item.locationId}`] = increment(-item.quantity);
        }

        batch.update(productRef, updates);
        itemsToDecrement++;
    }

    if (itemsToDecrement > 0) {
        await batch.commit();
    }
};

export const deleteQuote = async (db: Firestore, id: string) => {
    await setDoc(doc(db, QUOTES_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const getVisits = (db: Firestore, companyId: string, user: any, onUpdate: (data: Visit[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, VISITS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        let visits = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Visit))
            .filter(v => !v.deletedAt);
        if (user.role === 'tecnico') visits = visits.filter(v => v.technicianId === user.uid);
        if (user.role === 'cliente') visits = visits.filter(v => v.clientId === user.clientId);
        onUpdate(visits);
    }, onError);
};

export const getVisitsOnce = async (db: Firestore, companyId: string, user: any, daysLimit: number | null = 60): Promise<Visit[]> => {
    const q = query(collection(db, VISITS_COLLECTION), where("companyId", "==", companyId));
    
    const snap = await getDocs(q);
    let visits = snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit));

    // Filtragem em memória para evitar erro de índice no Firestore
    if (daysLimit) {
        const thresholdDate = subDays(getBrasiliaDate(), daysLimit).toISOString();
        visits = visits.filter(v => {
            // Keep pending visits regardless of date
            if (['Solicitada', 'Agendada', 'Atribuída', 'Gerar Orçamento'].includes(v.status)) return true;
            return v.visitDate && v.visitDate >= thresholdDate;
        });
    }

    visits = visits.filter(v => !v.deletedAt);

    if (user.role === 'tecnico') visits = visits.filter(v => v.technicianId === user.uid);
    if (user.role === 'cliente') visits = visits.filter(v => v.clientId === user.clientId);
    return visits;
};

export const addVisit = async (db: Firestore, auth: Auth, data: any) => {
    const countSnap = await getCountFromServer(query(collection(db, VISITS_COLLECTION), where("companyId", "==", data.companyId)));
    const number = (countSnap.data().count + 1).toString().padStart(4, '0');
    const visitNumber = `VIS-${number}/${getBrasiliaDate().getFullYear().toString().slice(-2)}`;
    
    // Garantir campos críticos para evitar erros de 'undefined' no Firestore
    const visitData = {
        serviceReport: '',
        requiredMaterials: '',
        attachments: [],
        ...data,
        visitNumber,
        creationDate: getBrasiliaDate().toISOString(),
        creatorName: auth.currentUser?.displayName || 'Sistema'
    };

    const sanitizedData = sanitizeData(visitData);

    const docRef = await addDoc(collection(db, VISITS_COLLECTION), sanitizedData);
    return docRef.id;
};

export const updateVisit = async (db: Firestore, auth: Auth, id: string, data: any) => {
    await setDoc(doc(db, VISITS_COLLECTION, id), sanitizeData(data), { merge: true });
};


export const deleteVisit = async (db: Firestore, id: string) => {
    await setDoc(doc(db, VISITS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const getAccountsReceivable = (db: Firestore, companyId: string, onUpdate: (data: AccountsReceivable[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountsReceivable)));
    }, onError);
};

export const getAccountsReceivableByClient = (db: Firestore, companyId: string, clientId: string, onUpdate: (data: AccountsReceivable[]) => void, onError: (e: any) => void) => {
    const q = query(
        collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), 
        where("companyId", "==", companyId), 
        where("clientId", "==", clientId)
    );
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountsReceivable)));
    }, onError);
};

export const getAccountsReceivableOnce = async (db: Firestore, companyId: string, daysLimit: number | null = 60): Promise<AccountsReceivable[]> => {
    const q = query(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), where("companyId", "==", companyId));
    
    const snap = await getDocs(q);
    let accounts = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountsReceivable));

    // Filtragem em memória para evitar erro de índice no Firestore
    if (daysLimit) {
        const thresholdDate = subDays(getBrasiliaDate(), daysLimit).toISOString();
        accounts = accounts.filter(ar => (ar.dueDate && ar.dueDate >= thresholdDate) || (ar.creationDate && ar.creationDate >= thresholdDate));
    }

    return accounts;
};

export const getAccountReceivable = async (db: Firestore, id: string): Promise<AccountsReceivable | null> => {
    const snap = await getDoc(doc(db, ACCOUNTS_RECEIVABLE_COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as AccountsReceivable : null;
};

export const updateAccountsReceivable = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, ACCOUNTS_RECEIVABLE_COLLECTION, id), data, { merge: true });
};

export const createReceivable = async (db: Firestore, quoteId: string) => {
    const quote = await getQuote(db, quoteId);
    if (!quote) return;
    
    // Verifica se já existe um recebível para esta O.S.
    const existingQ = query(
        collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), 
        where("companyId", "==", quote.companyId),
        where("quoteId", "==", quoteId)
    );
    const snap = await getDocs(existingQ);
    if (!snap.empty) return; // Evita duplicidade

    await addDoc(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), {
        companyId: quote.companyId,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        clientId: quote.clientId,
        clientName: quote.clientName,
        amount: quote.total,
        originalAmount: quote.total,
        status: 'Pendente',
        dueDate: format(addDays(getBrasiliaDate(), 30), 'yyyy-MM-dd'),
        creationDate: getBrasiliaDate().toISOString(),
    });
};

export const processPartialPayment = async (db: Firestore, id: string, data: any) => {
    const { installments, discount, interestRate, method, customInstallments } = data;
    const ref = doc(db, ACCOUNTS_RECEIVABLE_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = snap.data() as AccountsReceivable;
    const now = getBrasiliaDate();

    if (installments === 1) {
        const finalAmount = current.amount * (1 - (discount || 0) / 100);
        const paymentRecord = {
            amount: current.amount, // Original amount being paid
            date: now.toISOString(),
            method: method || 'Não informado'
        };

        await updateDoc(ref, { 
            status: 'Pago', 
            paymentDate: now.toISOString(), 
            amount: 0, 
            discount: discount || 0, 
            finalAmount,
            method: method || 'Não informado',
            paymentHistory: [...(current.paymentHistory || []), paymentRecord]
        });
    } else {
        const batch = writeBatch(db);
        
        // Se customInstallments forem fornecidos, usa eles. Senão, calcula partes iguais.
        const installmentsList = customInstallments || Array.from({ length: installments }, (_, idx) => {
            const i = idx + 1;
            const totalWithInterest = current.amount * (1 + (interestRate || 0) / 100);
            const val = parseFloat((totalWithInterest / installments).toFixed(2));
            return {
                amount: val,
                dueDate: format(addDays(now, i * 30), 'yyyy-MM-dd')
            };
        });
        
        installmentsList.forEach((inst: any, idx: number) => {
            const i = idx + 1;
            const instRef = doc(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION));
            
            const { 
                paymentDate, 
                paymentHistory, 
                discount: oldDiscount, 
                finalAmount,
                id: oldId,
                ...cleanData 
            } = current as any;

            batch.set(instRef, sanitizeData({
                ...cleanData,
                quoteNumber: `${current.quoteNumber} (${i}/${installmentsList.length})`,
                amount: inst.amount,
                originalAmount: inst.amount,
                dueDate: inst.dueDate,
                status: 'Pendente',
                method: method || 'Não informado',
            }));
        });
        
        batch.delete(ref);
        await batch.commit();
    }
};

export const getRelatedReceivables = (db: Firestore, quoteId: string, onUpdate: (data: AccountsReceivable[]) => void) => {
    const q = query(collection(db, ACCOUNTS_RECEIVABLE_COLLECTION), where("quoteId", "==", quoteId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountsReceivable)));
    });
};

export const deleteAccountsReceivable = async (db: Firestore, id: string) => {
    const ref = doc(db, ACCOUNTS_RECEIVABLE_COLLECTION, id);
    await deleteDoc(ref);
};

export const getComodatoAssets = (db: Firestore, companyId: string, onUpdate: (data: ComodatoAsset[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, COMODATO_ASSETS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as ComodatoAsset))
            .filter(a => !a.deletedAt)
        );
    }, onError);
};

export const getComodatoAssetsByClient = (db: Firestore, companyId: string, clientId: string, onUpdate: (data: ComodatoAsset[]) => void, onError: (e: any) => void) => {
    const q = query(
        collection(db, COMODATO_ASSETS_COLLECTION), 
        where("companyId", "==", companyId), 
        where("clientId", "==", clientId)
    );
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as ComodatoAsset))
            .filter(a => !a.deletedAt)
        );
    }, onError);
};

export const getComodatoAssetsOnce = async (db: Firestore, companyId: string): Promise<ComodatoAsset[]> => {
    const q = query(collection(db, COMODATO_ASSETS_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ComodatoAsset))
        .filter(a => !a.deletedAt);
};

export const addComodatoAsset = async (db: Firestore, data: any) => {
    await addDoc(collection(db, COMODATO_ASSETS_COLLECTION), { ...data, creationDate: getBrasiliaDate().toISOString() });
};

export const bulkAddComodatoAssets = async (db: Firestore, baseData: any, serials: string[]) => {
    const batch = writeBatch(db);
    const now = getBrasiliaDate().toISOString();
    for (const serial of serials) {
        const ref = doc(collection(db, COMODATO_ASSETS_COLLECTION));
        batch.set(ref, { ...baseData, serial, creationDate: now });
    }
    await batch.commit();
    return serials.length;
};

export const updateComodatoAsset = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, COMODATO_ASSETS_COLLECTION, id), data, { merge: true });
};

export const deleteComodatoAsset = async (db: Firestore, id: string) => {
    await setDoc(doc(db, COMODATO_ASSETS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const getTeamMembers = (db: Firestore, companyId: string, onUpdate: (data: UserProfile[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
            .filter(u => !u.deletedAt)
        );
    }, onError);
};

export const getTeamMembersOnce = async (db: Firestore, companyId: string): Promise<UserProfile[]> => {
    const q = query(collection(db, USERS_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => !u.deletedAt);
};

export const updateTeamMember = async (db: Firestore, uid: string, data: any) => {
    await setDoc(doc(db, USERS_COLLECTION, uid), data, { merge: true });
};

export const saveFcmToken = async (db: Firestore, uid: string, token: string) => {
    await setDoc(doc(db, USERS_COLLECTION, uid), { fcmToken: token }, { merge: true });
};

export const deleteTeamMember = async (db: Firestore, uid: string) => {
    await setDoc(doc(db, USERS_COLLECTION, uid), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const inviteTeamMember = async (db: Firestore, auth: Auth, data: any) => {
    const { companyId, userData } = data;
    const userRef = doc(collection(db, USERS_COLLECTION));
    await setDoc(userRef, { ...userData, companyId, status: 'Pendente', forcePasswordChange: true, creationDate: getBrasiliaDate().toISOString() });
};

export const updateTeamMemberLocationHistory = async (db: Firestore, uid: string, companyId: string, point?: LocationPoint, isOnline?: boolean) => {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const update: any = { isOnline: !!isOnline };
    
    if (point) {
        update.lastLocation = point;
        update.lastLocationUpdated = point.timestamp;
        
        // Também salvamos no histórico diário para rastreamento
        const dateKey = point.timestamp.split('T')[0];
        const historyRef = doc(db, LOCATION_HISTORY_COLLECTION, `${uid}_${dateKey}`);
        
        // Atualiza o documento diário adicionando o ponto ao array
        await setDoc(historyRef, { 
            points: arrayUnion(point),
            userId: uid,
            companyId: companyId,
            date: dateKey
        }, { merge: true });
    } else {
        update.lastSeen = getBrasiliaDate().toISOString();
    }
    
    await setDoc(userRef, update, { merge: true });
};

export const getLocationHistory = async (db: Firestore, uid: string, date: string): Promise<LocationPoint[]> => {
    const historyRef = doc(db, LOCATION_HISTORY_COLLECTION, `${uid}_${date}`);
    const snap = await getDoc(historyRef);
    if (snap.exists()) {
        const data = snap.data();
        return data.points || [];
    }
    return [];
};

export const getDistributors = (db: Firestore, onUpdate: (data: UserProfile[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, USERS_COLLECTION), where("role", "==", "distribuidor"));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    }, onError);
};

export const getDistributorsOnce = async (db: Firestore): Promise<UserProfile[]> => {
    const q = query(collection(db, USERS_COLLECTION), where("role", "==", "distribuidor"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
};

export const getDistributorById = async (db: Firestore, id: string): Promise<UserProfile | null> => {
    const snap = await getDoc(doc(db, USERS_COLLECTION, id));
    return snap.exists() ? { uid: snap.id, ...snap.data() } as UserProfile : null;
};

export const addDistributorClick = async (db: Firestore, data: Omit<DistributorClick, 'id'>) => {
    try {
        await addDoc(collection(db, DISTRIBUTOR_CLICKS_COLLECTION), data);
    } catch (error) {
        console.error("Erro de permissão ao registrar clique do distribuidor. Verifique as regras de segurança do Firestore:", error);
    }
};

export const getDistributorClicks = (db: Firestore, distributorId: string, onUpdate: (data: DistributorClick[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, DISTRIBUTOR_CLICKS_COLLECTION), where("distributorId", "==", distributorId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as DistributorClick)));
    }, onError);
};

export const getPurchaseOrders = (db: Firestore, companyId: string, onUpdate: (data: PurchaseOrder[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, PURCHASE_ORDERS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as PurchaseOrder))
            .filter(o => !o.deletedAt)
        );
    }, onError);
};

export const getPurchaseOrdersOnce = async (db: Firestore, companyId: string, daysLimit: number | null = 60): Promise<PurchaseOrder[]> => {
    const q = query(collection(db, PURCHASE_ORDERS_COLLECTION), where("companyId", "==", companyId));
    
    const snap = await getDocs(q);
    let orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));

    // Filtragem em memória para evitar erro de índice no Firestore
    if (daysLimit) {
        const thresholdDate = subDays(getBrasiliaDate(), daysLimit).toISOString();
        orders = orders.filter(o => o.creationDate && o.creationDate >= thresholdDate);
    }

    return orders.filter(o => !o.deletedAt);
};

export const getPurchaseOrdersForDistributor = (db: Firestore, distributorCompanyId: string, onUpdate: (data: PurchaseOrder[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, PURCHASE_ORDERS_COLLECTION), where("distributorCompanyId", "==", distributorCompanyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as PurchaseOrder))
            .filter(o => !o.deletedAt)
        );
    }, onError);
};

export const addPurchaseOrder = async (db: Firestore, data: any) => {
    const countSnap = await getCountFromServer(query(collection(db, PURCHASE_ORDERS_COLLECTION), where("companyId", "==", data.companyId)));
    const number = (countSnap.data().count + 1).toString().padStart(4, '0');
    const orderNumber = `PC-${number}/${getBrasiliaDate().getFullYear().toString().slice(-2)}`;
    const docRef = await addDoc(collection(db, PURCHASE_ORDERS_COLLECTION), {
        ...data,
        orderNumber,
        creationDate: getBrasiliaDate().toISOString()
    });
    return docRef.id;
};

export const getPurchaseOrder = async (db: Firestore, id: string): Promise<PurchaseOrder | null> => {
    const snap = await getDoc(doc(db, PURCHASE_ORDERS_COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } as PurchaseOrder : null;
};

export const updatePurchaseOrder = async (db: Firestore, auth: Auth, id: string, data: any) => {
    await setDoc(doc(db, PURCHASE_ORDERS_COLLECTION, id), data, { merge: true });
};

export const getStockLocations = (db: Firestore, companyId: string, onUpdate: (data: StockLocation[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, STOCK_LOCATIONS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockLocation)));
    }, onError);
};

export const addStockLocation = async (db: Firestore, data: any) => {
    await addDoc(collection(db, STOCK_LOCATIONS_COLLECTION), { ...data, creationDate: getBrasiliaDate().toISOString() });
};

export const updateStockLocation = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, STOCK_LOCATIONS_COLLECTION, id), data, { merge: true });
};

export const deleteStockLocation = async (db: Firestore, id: string) => {
    await deleteDoc(doc(db, STOCK_LOCATIONS_COLLECTION, id));
};

export const updateProductStock = async (db: Firestore, items: any[], locationId: string) => {
    const batch = writeBatch(db);
    for (const item of items) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
            const currentTotal = prodSnap.data()?.stockQuantity || 0;
            const currentLocQty = prodSnap.data()?.stockLevels?.[locationId] || 0;
            batch.update(prodRef, {
                [`stockLevels.${locationId}`]: currentLocQty + item.quantity,
                stockQuantity: currentTotal + item.quantity
            });
        }
    }
    await batch.commit();
};

export const updateProductStockLevels = async (db: Firestore, type: string, productId: string, qty: number, from?: string, to?: string, poNum?: string) => {
    const ref = doc(db, PRODUCTS_COLLECTION, productId);
    const snap = await getDoc(ref);
    const current = snap.data();
    if (!current) return;

    const update: any = {};
    if (type === 'entry' && to) {
        update[`stockLevels.${to}`] = (current.stockLevels?.[to] || 0) + qty;
        update.stockQuantity = (current.stockQuantity || 0) + qty;
    } else if (type === 'exit' && from) {
        update[`stockLevels.${from}`] = (current.stockLevels?.[from] || 0) - qty;
        update.stockQuantity = (current.stockQuantity || 0) - qty;
    } else if (type === 'transfer' && from && to) {
        update[`stockLevels.${from}`] = (current.stockLevels?.[from] || 0) - qty;
        update[`stockLevels.${to}`] = (current.stockLevels?.[to] || 0) + qty;
    }
    await setDoc(ref, update, { merge: true });
};

export const getVehicles = (db: Firestore, companyId: string, onUpdate: (data: Vehicle[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, VEHICLES_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Vehicle))
            .filter(v => !v.deletedAt)
        );
    }, onError);
};

export const getVehiclesOnce = async (db: Firestore, companyId: string): Promise<Vehicle[]> => {
    const q = query(collection(db, VEHICLES_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Vehicle))
        .filter(v => !v.deletedAt);
};

export const addVehicle = async (db: Firestore, data: any) => {
    await addDoc(collection(db, VEHICLES_COLLECTION), { ...data, creationDate: getBrasiliaDate().toISOString() });
};

export const updateVehicle = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, VEHICLES_COLLECTION, id), data, { merge: true });
};

export const deleteVehicle = async (db: Firestore, id: string) => {
    await setDoc(doc(db, VEHICLES_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const getSuppliers = (db: Firestore, companyId: string, onUpdate: (data: Supplier[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, SUPPLIERS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Supplier))
            .filter(s => !s.deletedAt)
        );
    }, onError);
};

export const getSuppliersOnce = async (db: Firestore, companyId: string): Promise<Supplier[]> => {
    const q = query(collection(db, SUPPLIERS_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Supplier))
        .filter(s => !s.deletedAt);
};

export const addSupplier = async (db: Firestore, data: any) => {
    await addDoc(collection(db, SUPPLIERS_COLLECTION), { ...data, creationDate: getBrasiliaDate().toISOString() });
};

export const updateSupplier = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, SUPPLIERS_COLLECTION, id), data, { merge: true });
};

export const deleteSupplier = async (db: Firestore, id: string) => {
    await setDoc(doc(db, SUPPLIERS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const addCommunication = async (db: Firestore, data: any) => {
    await addDoc(collection(db, COMMUNICATIONS_COLLECTION), { ...data, sentAt: getBrasiliaDate().toISOString() });
};

export const getCommunications = (db: Firestore, companyId: string, onUpdate: (data: Communication[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, COMMUNICATIONS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as Communication)));
    }, onError);
};

export const updateCommunication = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, COMMUNICATIONS_COLLECTION, id), data, { merge: true });
};

export const deleteCommunication = async (db: Firestore, id: string) => {
    await deleteDoc(doc(db, COMMUNICATIONS_COLLECTION, id));
};

export const getTools = (db: Firestore, companyId: string, onUpdate: (data: Tool[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, TOOLS_COLLECTION), where("companyId", "==", companyId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Tool))
            .filter(t => !t.deletedAt)
        );
    }, onError);
};

export const addTool = async (db: Firestore, data: any) => {
    await addDoc(collection(db, TOOLS_COLLECTION), { ...data, creationDate: getBrasiliaDate().toISOString() });
};

export const updateTool = async (db: Firestore, id: string, data: any) => {
    await setDoc(doc(db, TOOLS_COLLECTION, id), data, { merge: true });
};

export const deleteTool = async (db: Firestore, id: string) => {
    await setDoc(doc(db, TOOLS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};

export const getNotes = (db: Firestore, companyId: string, userId: string, onUpdate: (data: Note[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, NOTES_COLLECTION), where("companyId", "==", companyId), where("userId", "==", userId));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
    }, onError);
};

export const addNote = async (db: Firestore, data: any) => {
    await addDoc(collection(db, NOTES_COLLECTION), { ...data, createdAt: getBrasiliaDate().toISOString() });
};

export const deleteNote = async (db: Firestore, id: string) => {
    await deleteDoc(doc(db, NOTES_COLLECTION, id));
};

export const getDeletedItems = async (db: Firestore, companyId: string) => {
    const collectionsToSearch = [
        { name: QUOTES_COLLECTION, type: 'os' },
        { name: VISITS_COLLECTION, type: 'visit' },
        { name: CLIENTS_COLLECTION, type: 'client' },
        { name: PRODUCTS_COLLECTION, type: 'product' },
        { name: SUPPLIERS_COLLECTION, type: 'supplier' },
        { name: PURCHASE_ORDERS_COLLECTION, type: 'purchase' },
        { name: TOOLS_COLLECTION, type: 'tool' },
        { name: USERS_COLLECTION, type: 'user' },
        { name: LEADS_COLLECTION, type: 'lead' },
    ];

    const results: any[] = [];

    for (const coll of collectionsToSearch) {
        const q = query(
            collection(db, coll.name),
            where("companyId", "==", companyId)
        );
        const snap = await getDocs(q);
        snap.forEach(doc => {
            const data = doc.data();
            if (data.deletedAt) {
                results.push({
                    ...data,
                    id: doc.id,
                    type: coll.type
                });
            }
        });
    }

    return results;
};

export const restoreDocument = async (db: Firestore, collectionName: string, id: string) => {
    await setDoc(doc(db, collectionName, id), { deletedAt: deleteField() }, { merge: true });
};

export const permanentlyDeleteDocument = async (db: Firestore, collectionName: string, id: string) => {
    await deleteDoc(doc(db, collectionName, id));
};

export const getUserByEmail = async (db: Firestore, email: string): Promise<UserProfile | null> => {
    const q = query(collection(db, USERS_COLLECTION), where("email", "==", email));
    const snap = await getDocs(q);
    return snap.empty ? null : { uid: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile;
};

export const createUserProfile = async (db: Firestore, user: any, companyName: string, cnpj: string, plan: string = 'Periodo Teste', displayName?: string, extraData: any = {}) => {
    const companyRef = await addDoc(collection(db, COMPANIES_COLLECTION), {
        name: companyName,
        cnpj,
        ownerId: user.uid,
        plan,
        creationDate: getBrasiliaDate().toISOString(),
        planStatus: 'Ativo',
        paymentStatus: 'Pago',
        trialEndsAt: addDays(getBrasiliaDate(), 20).toISOString(),
    });

    const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        displayName: displayName || user.displayName || user.email!,
        companyId: companyRef.id,
        role: 'admin',
        status: 'Ativo',
        creationDate: getBrasiliaDate().toISOString(),
        ...extraData
    };

    await setDoc(doc(db, USERS_COLLECTION, user.uid), userProfile);
};

export const addServiceImageToQuote = async (db: Firestore, quoteId: string, urls: string[]) => {
    await setDoc(doc(db, QUOTES_COLLECTION, quoteId), { serviceImages: arrayUnion(...urls) }, { merge: true });
};

export const deleteServiceImageFromQuote = async (db: Firestore, quoteId: string, url: string) => {
    await setDoc(doc(db, QUOTES_COLLECTION, quoteId), { serviceImages: arrayRemove(url) }, { merge: true });
};

export const inviteDistributor = async (db: Firestore, auth: Auth, data: any) => {
    const userRef = doc(collection(db, USERS_COLLECTION));
    await setDoc(userRef, { ...data, role: 'distribuidor', status: 'Ativo', forcePasswordChange: true, creationDate: getBrasiliaDate().toISOString() });
};

export const normalizeAndCapitalize = (str: string) => {
    if (!str) return str;
    const lower = str.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}


export const migrateProductManufacturers = async (db: Firestore, companyId: string) => {
    const q = query(collection(db, PRODUCTS_COLLECTION), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    let count = 0;
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
        const manufacturer = d.data().manufacturer;
        if (manufacturer) {
            batch.update(d.ref, { manufacturer: normalizeAndCapitalize(manufacturer) });
            count++;
        }
    });
    await batch.commit();
    return count;
};

export const getPromotions = (db: Firestore, onUpdate: (data: Promotion[]) => void, onError: (e: any) => void) => {
    const q = query(collection(db, PROMOTIONS_COLLECTION), where("status", "==", "active"));
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promotion)));
    }, onError);
};

export const addPromotion = async (db: Firestore, data: Omit<Promotion, 'id'>) => {
    await addDoc(collection(db, PROMOTIONS_COLLECTION), data);
};

export const updatePromotion = async (db: Firestore, id: string, data: Partial<Promotion>) => {
    await setDoc(doc(db, PROMOTIONS_COLLECTION, id), data, { merge: true });
};

export const deletePromotion = async (db: Firestore, id: string) => {
    await deleteDoc(doc(db, PROMOTIONS_COLLECTION, id));
};

export const seedExpertData = async (db: Firestore, companyId: string) => {
    const batch = writeBatch(db);
    const now = getBrasiliaDate().toISOString();
    const clients = [
        { name: 'Supermercado Bom Preço Ltda', document: '12.345.678/0001-90', email: 'financeiro@bompreco.com.br', phone: '(79) 3214-5600', isComodato: true, city: 'Aracaju', state: 'SE' },
        { name: 'Condomínio Edifício Torres Business', document: '23.456.789/0001-01', email: 'sindico@torresbusiness.com', phone: '(79) 3223-4500', isComodato: true, city: 'Aracaju', state: 'SE' },
        { name: 'Clínica Saúde Total S/S Ltda', document: '34.567.890/0001-12', email: 'adm@saudetotal.com.br', phone: '(79) 3217-8900', isComodato: true, city: 'Aracaju', state: 'SE' }
    ];
    for (const c of clients) {
        const ref = doc(collection(db, CLIENTS_COLLECTION));
        batch.set(ref, { ...c, companyId, creationDate: now, status: 'Ativo' });
    }
    await batch.commit();
    return true;
};

export const addOSReturn = async (db: Firestore, returnData: OSReturn) => {
    return await addDoc(collection(db, OS_RETURNS_COLLECTION), {
        ...returnData,
        returnedAt: returnData.returnedAt || new Date().toISOString()
    });
};

export const getOSReturns = async (db: Firestore, osId: string) => {
    const q = query(
        collection(db, OS_RETURNS_COLLECTION), 
        where("osId", "==", osId),
        orderBy("returnedAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OSReturn[];
};

export const getLeadsOnce = async (db: Firestore, companyId: string) => {
    const q = query(
        collection(db, LEADS_COLLECTION),
        where("companyId", "==", companyId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Lead))
        .filter(l => !l.deletedAt);
};

export const getLeads = (db: Firestore, companyId: string, onUpdate: (data: Lead[]) => void, onError: (e: any) => void) => {
    const q = query(
        collection(db, LEADS_COLLECTION),
        where("companyId", "==", companyId)
    );
    return onSnapshot(q, (snap) => {
        onUpdate(snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Lead))
            .filter(l => !l.deletedAt)
        );
    }, onError);
};

export const updateLead = async (db: Firestore, id: string, data: Partial<Lead>) => {
    await setDoc(doc(db, LEADS_COLLECTION, id), data, { merge: true });
};

export const deleteLead = async (db: Firestore, id: string) => {
    await setDoc(doc(db, LEADS_COLLECTION, id), { deletedAt: getBrasiliaDate().toISOString() }, { merge: true });
};
