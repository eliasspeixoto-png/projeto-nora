
import type { Camera, Wall, Element, Measurement } from './cftv-types';

export type PagePermission = {
  view?: boolean;
  edit?: boolean;
  delete?: boolean;
};

export type RolePermissions = Record<string, PagePermission>;

export type Product = {
  id: string;
  item: string; // Código Interno
  description: string; // Nome do Produto
  detailedDescription?: string;
  model?: string;
  manufacturer?: string;
  unit: 'UNID' | 'PÇ' | 'PAR' | 'M' | 'M²' | 'M³' | 'KG' | 'L' | 'CX' | 'PCT' | 'RL' | 'KIT' | 'HR' | 'SV';
  materialPrice: number; // Preço de Custo
  sellingPrice: number; // Preço de Venda
  servicePrice?: number; // Preço de Serviço (opcional)
  isPromotion?: boolean;
  promoPrice?: number;
  promoExpiresAt?: string; // ISO String
  segment: 'CERCAS' | 'CÂMERAS' | 'ALARMES' | 'FECHADURAS' | 'SERVIÇOS' | 'OUTROS' | 'CONCERTINA' | 'INDUSTRIAL PESADA' | 'FERRAMENTAL' | 'REDES' | 'PROMOÇÃO'; // Categoria
  status: 'Ativo' | 'Inativo';
  companyId: string;
  imageUrl?: string;
  notes?: string;
  creationDate?: string;
  originProductId?: string;
  originDistributorCompanyId?: string;
  distributor?: string; // Standardized distributor name from import
  DISTRIBUIDOR?: string; // Legacy support for uppercase import field

  // Estoque
  stockLevels?: { [locationId: string]: number }; // Quantidade por local
  stockQuantity?: number; // Total de todos os locais
  minStockQuantity?: number;
  maxStockQuantity?: number;
  stockAlert?: number;
  locationDetail?: string;
  mainSupplierId?: string;

  // Logistica
  weight?: number; // Peso líquido
  grossWeight?: number; // Peso bruto
  height?: number; // cm
  width?: number; // cm
  length?: number; // cm

  // Fiscal
  ncm?: string;
  cest?: string;
  ean?: string; // Código de Barras (GTIN/EAN)
  origin?: string;
  cfop_venda?: string;
  cfop_compra?: string;
  cst_icms?: string;
  aliq_icms?: number;
  cst_pis?: string;
  aliq_pis?: number;
  cst_cofins?: string;
  aliq_cofins?: number;
  cst_ipi?: string;
  aliq_ipi?: number;
  situacao_tributaria?: string;
  codigo_anp?: string;
  gtin_tributavel?: string;
  deletedAt?: string;
};

export type ToolHistory = {
  date: string; // ISO String
  action: string; // Ex: 'Criação', 'Entregue para', 'Devolvido', 'Condição alterada'
  details: string; // Ex: 'John Doe', 'Marcado como Avariado', etc.
  userId: string; // UID of the user who performed the action
  userName: string; // Name of the user
}

export type Tool = {
  id: string;
  companyId: string;
  name: string;
  type: string;
  code?: string;
  status: 'Disponível' | 'Em Uso' | 'Em Manutenção' | 'Descartada' | 'Aguardando Aceite';
  condition: 'OK' | 'Avariada' | 'Extraviada';
  currentHolderId?: string;
  currentHolderName?: string;
  lastUsed?: string; // ISO Date
  notes?: string;
  imageUrl?: string;
  history?: ToolHistory[];
  creationDate?: string;
  deletedAt?: string; // ISO String for soft delete
};


export type StockLocation = {
  id: string;
  companyId: string;
  name: string;
  type: 'warehouse' | 'vehicle';
  address?: string;
  vehicleId?: string; // Se for do tipo 'vehicle'
  isCentral?: boolean;
  creationDate?: string;
};

export type ServiceAddress = {
  id: string;
  name: string; // e.g., "Sede", "Filial Praia"
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  document: string; // CPF/CNPJ
  notes?: string;
  companyId: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  codigo_municipio?: string;
  address?: string; // Mantido para compatibilidade, mas novos dados usarão campos separados
  serviceAddresses?: ServiceAddress[];
  clientCode?: string;
  creatorName?: string;
  isComodato: boolean;
  comodatoStartDate?: string; // Data de início do comodato (ISO)
  paymentDay?: number; // Dia de vencimento do comodato (1-31)
  serviceDescription?: string;
  serviceValue?: number;
  comodatoStatus?: 'Pendente' | 'Ativo' | 'Suspenso' | 'Inadimplente';
  comodatoStatusNotes?: string;
  preventiveMaintenanceFrequency?: number;
  lastPreventiveMaintenanceDate?: string; // ISO string
  status?: 'Ativo' | 'Inativo';
  creationDate?: string;
  deletedAt?: string;
  authUid?: string; // Link to Firebase Auth User ID
  forcePasswordChange?: boolean;
  hasPortalAccess?: boolean;
  latitude?: number;
  longitude?: number;
};



export type NotaFiscal = {
  id: string;
  companyId: string;
  numero: string;
  serie?: string;
  dataEmissao?: string;
  fornecedor?: {
    nome: string;
    cnpj?: string;
  } | string;
  valorTotal?: string;
  itens?: any[];
  arquivoUrl?: string;
  status?: string;
  dataImportacao?: string;
  createdAt?: string;
};

export type NotaFiscalData = Omit<NotaFiscal, "id">;

export type Supplier = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  document?: string; // CPF/CNPJ
  notes?: string;
  companyId: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  creatorName?: string;
  supplierCode?: string;
  status?: 'Ativo' | 'Inativo';
  creationDate?: string;
  deletedAt?: string;
  distributorUid?: string;
};

export type QuoteItem = {
  id: string;
  product: Product;
  quantity: number;
  materialPrice: number;
  servicePrice: number;
  total: number;
  locationId?: string;
  isClientEquipment?: boolean;
  includeService?: boolean;
  includeMaterial?: boolean;
};

export type PostCounts = {
  corner: number;
  passage: number;
  w: number;
  passageSpacing: number;
  wSpacing: number
};

export type FenceQuoteDetails = {
  shape: string;
  dimensions: any;
  segments: number[];
  additionalPosts?: number;
  preventiveVisitsPerYear?: number;
  preventiveVisitCost?: number;
  baseMonitoringValue?: number;
  installationLaborCost?: number;
  postCounts?: PostCounts;
  installationType?: 'chumbada' | 'parafusada';
  rodType?: '28x28' | '23x23' | '30x30';
  voltage?: '127v' | '220v';
  hasSteps?: boolean;
  numberOfSteps?: number;
  highVoltageCableLength?: number;
  parallelWireLength?: number;
  groundingWireLength?: number;
  sirenCableLength?: number;
  usefulLife?: number;
  technicalReserve?: number;
  capitalInterestRate?: number;
  scenario?: 'alarm' | 'cftv' | 'mixed';
}

export type CftvQuoteDetails = {
  cameras: Camera[];
  walls: Wall[];
  elements?: Element[];
  measurements?: Measurement[];
  width?: number;
  height?: number;
  scale?: number;
  backgroundImage?: string;
  manualItems?: QuoteItem[];
}

export type StatusHistory = {
  status: string;
  changedAt: string; // ISO String
  changedBy?: string; // UID of user who changed status
  notes?: string; // To store revision requests or cancellation reasons
};


export type OSNote = {
  id: string;
  type: 'pendencia' | 'defeito' | 'observacao';
  text: string;
  author?: string;
  createdAt: string;
  status?: 'Pendente' | 'Resolvido' | 'Registrado';
};

export type Quote = {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  companyName: string;
  date: string; // ISO String
  items: QuoteItem[];
  total: number;
  discount: number;
  status: 'draft' | 'sent' | 'Aprovado' | 'rejected' | 'revision-pending' | 'Pendente' | 'Atribuída' | 'Em Execução' | 'Finalizado' | 'Agendado' | 'Devolvida' | 'Atrasada';
  companyId: string;
  creatorName?: string; // Nome do usuário que criou o orçamento
  fenceDetails?: FenceQuoteDetails;
  cftvDetails?: CftvQuoteDetails;
  serviceType?: 'Cerca Elétrica' | 'Câmeras' | 'Geral' | 'Comodato' | 'CFTV';
  osType?: 'Manutenção de Comodato Preventiva' | 'Manutenção de Comodato Corretiva' | 'Serviço Avulso';
  installments?: number;
  interestRate?: number;
  notes?: string;
  osNotes?: OSNote[];
  returnReason?: string;
  returnedBy?: string; // Nome do técnico que devolveu a O.S.
  returnedAt?: string; // Data/Hora da devolução (ISO)
  returnLocation?: {
    latitude: number;
    longitude: number;
  };
  assignedAt?: string; // Data/Hora da atribuição ao técnico (ISO)
  isComodato?: boolean;
  comodatoType?: 'Real' | 'Client' | string;
  comodatoMonthlyFee?: number;
  statusHistory?: StatusHistory[];

  // Schedule & Execution fields
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  executionStartDate?: string; // YYYY-MM-DD
  executionStartTime?: string; // HH:mm
  expectedEndDate?: string; // YYYY-MM-DD
  expectedEndTime?: string; // HH:mm
  executionProgress?: string; // Ex: "6 de 16 caminhões instalados"
  scheduleStatus?: 'pending-client-approval' | 'confirmed' | 'reschedule-requested';
  schedulingNotes?: string;
  approvalDate?: string; // ISO String
  originalDate?: string; // YYYY-MM-DD
  originalTime?: string; // HH:mm
  reschedules?: {
    newDate: string;
    newTime: string;
    reason: string;
    timestamp: string; // ISO
  }[];

  // Batch / Child Service Orders (Sub-OS Fracionadas)
  parentQuoteId?: string; // ID do orçamento mestre
  parentQuoteNumber?: string; // Ex: "0145/26" ou "ORC 0145/26"
  unitIdentifier?: string; // Placa, TAG, Chassi, Apto, Bloco, etc.
  isChildOS?: boolean;
  childOSIndex?: number; // Ex: 1, 2, ..., 16
  childOSCount?: number; // Ex: 16

  // Financial Advances
  advancePayments?: {
    id: string;
    amount: number;
    date: string;
    method: string;
    notes?: string;
    receivableId?: string;
    registeredBy?: string;
  }[];

  // Preventive Maintenance fields
  requiresPreventiveMaintenance?: boolean;
  preventiveMaintenanceFrequency?: number; // months
  nextPreventiveMaintenanceDate?: string; // ISO String
  preventiveMaintenanceDone?: boolean;
  preventiveMaintenanceLinkedOsId?: string;

  // Service execution fields
  serviceImages?: string[];
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  completionDate?: string; // ISO String
  completionLocation?: {
    latitude: number;
    longitude: number;
  };
  technicianSignatureUrl?: string;
  clientSignatureUrl?: string;
  nfseId?: string; // Armazena o ID da nota fiscal gerada
  hasStockWarning?: boolean;
  purchasingNotes?: string;
  deletedAt?: string;

  // Snapshot data for contracts
  clientDocument?: string;
  clientStreet?: string;
  clientNumber?: string;
  clientNeighborhood?: string;
  clientCity?: string;
  clientState?: string;
  clientCep?: string;
  installationIncluded?: boolean;
  maintenancePeriod?: number;
  correctiveMaintenanceIncluded?: boolean;
  technicalSupportIncluded?: boolean;
  slaTotalFailure?: string;
  slaPartialFailure?: string;
  slaOtherFailures?: string;
  slaAvailability?: string;
  contractNumber?: string;
  proposalNumber?: string;
  contractDate?: string;
  installationFee?: number;
  contractStatus?: 'ativo' | 'suspenso' | 'encerrado';
  contractUrl?: string;
};

export type Role = 'admin' | 'supervisor' | 'tecnico' | 'surveyor' | 'cliente' | 'comprador' | 'distribuidor' | 'vendedor' | 'developer';

export type Company = {
  id: string;
  name: string;
  tradingName?: string;
  ownerId: string;
  plan: 'Essencial' | 'Profissional' | 'Enterprise' | 'Periodo Teste' | 'distribuidor';
  planPrice?: number;
  planExpiresAt?: string; // ISO String
  planStatus?: 'Ativo' | 'Vencido' | 'Pendente' | 'Cancelado';
  paymentStatus?: 'Pago' | 'Pendente' | 'Atrasado';
  trialEndsAt?: string; // ISO String
  cnpj?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  emailAppPassword?: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  logoFontColor?: string;
  pixKey?: string;
  signatureUrl?: string;
  focusNfeCreationToken?: string;
  focusNfeHomologationToken?: string;
  focusNfeProductionToken?: string;
  focusNfeHomologationUrl?: string;
  focusNfeProductionUrl?: string;
  focusNfeEnvironment?: 'homologacao' | 'producao';
  comodatoContractTemplate?: string;
  permissions?: Record<Role, RolePermissions>;
  creationDate?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  codigo_municipio?: string;
  regime_tributario?: "1" | "2" | "3" | "4";
  item_lista_servico?: string;
  codigo_tributario_municipio?: string;
  codigo_cnae?: string; // Adicionado
  nome_responsavel?: string;
  cpf_responsavel?: string;
  arquivo_certificado_base64?: string;
  senha_certificado?: string;
  aliq_pis?: number;
  habilita_nfe?: boolean;
  habilita_nfse?: boolean;
  latitude?: number;
  longitude?: number;
  defaultCommissionPercentage?: number;
  defaultMonthlyGoal?: number;
  products?: Product[]; // This is a temporary client-side property
}

export type LocationPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string; // ISO String
  source: 'mobile_gps' | 'desktop_browser' | 'ip_geolocation';
}

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  companyId?: string;
  avatarUrl?: string;
  employeeCode?: string; // Código automático NNNN/AA
  reMatricula?: string;  // RE/Matrícula manual
  employmentType?: 'CLT' | 'freelance';
  roles?: (Role)[];
  phone?: string;
  whatsapp?: string;
  document?: string;
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  role: Role;
  vehicleId?: string; // ID do veículo vinculado
  lastLocation?: LocationPoint;
  locationHistory?: LocationPoint[];
  lastLocationUpdated?: string; // ISO String
  deviceType?: 'mobile' | 'desktop';
  isOnline?: boolean;
  lastSeen?: string; // ISO String
  status?: 'Ativo' | 'Inativo';
  deletedAt?: string;
  permissions?: RolePermissions;
  forcePasswordChange?: boolean; // Adicionado para clientes
  clientId?: string; // Adicionado para vincular ao documento do cliente
  creationDate?: string;
  logoUrl?: string;
  nameColor?: string;
  workingHours?: string;
  latitude?: number;
  longitude?: number;
  plan?: 'distribuidor';
  planPrice?: number;
  clickValue?: number;
  commissionPercentage?: number;
  monthlyGoal?: number;
  fcmToken?: string;
  allowWhatsappAccess?: boolean;
  pushSettings?: {
    assignments?: boolean;
    messages?: boolean;
    alerts?: boolean;
  };
};

export type Visit = {
  id: string;
  visitNumber: string;
  companyId: string;
  clientId: string;
  clientName?: string; // For caching
  technicianId: string;
  technicianName?: string; // For caching
  visitDate: string; // YYYY-MM-DD
  time: string; // HH:mm
  address: string;
  description: string;
  status: 'Solicitada' | 'Agendada' | 'Atribuída' | 'Gerar Orçamento' | 'Finalizada' | 'Improdutiva' | 'Reagendar';
  relatedQuoteId?: string;
  relatedOSId?: string;
  notes?: string;
  attachments?: string[]; // URLs para fotos ou documentos
  originalDate?: string;
  originalTime?: string;
  reschedules?: {
    newDate: string;
    newTime: string;
    reason: string;
    timestamp: string;
  }[];
  serviceReport?: string; // Detailed report from the technician
  requiredMaterials?: string; // List of materials noted by the technician
  creatorName?: string; // Nome do usuário que criou a visita
  creationDate: string; // ISO String
  completionDate?: string; // ISO String
  completionLocation?: {
    latitude: number;
    longitude: number;
  };
  statusHistory?: StatusHistory[];
  deletedAt?: string;
};

export type PaymentHistory = {
  date: string; // ISO String
  amount: number;
  method?: string; // 'pix', 'boleto', 'cartao', etc.
};

export type AccountsReceivable = {
  id: string;
  companyId: string;
  quoteId: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  status: 'Pendente' | 'Pago' | 'Parcial';
  dueDate: string; // ISO String
  paymentDate?: string; // ISO String
  originalAmount?: number;
  paymentHistory?: PaymentHistory[];
  creationDate?: string;
  isAdvancePayment?: boolean;
  parentQuoteNumber?: string;
  unitIdentifier?: string;
  notes?: string;
  method?: string;
  deletedAt?: string;
};

export type ComodatoAsset = {
  id: string;
  companyId: string;
  model: string;
  serial: string;
  description?: string;
  manufacturer?: string;
  firmware?: string;
  status: 'active' | 'maintenance' | 'returned';
  photoUrl?: string;
  osId?: string; // Link to the installation/service order
  clientId?: string; // Denormalized for easier querying
  installationDate?: string; // ISO String
  monthlyFee?: number;
  notes?: string;
  creationDate?: string;
  deletedAt?: string;
}

export type MaintenanceLog = {
  id: string;
  companyId: string;
  assetId: string;
  type: 'preventiva' | 'corretiva';
  date: string; // ISO String
  description: string;
  technicianId: string;
  slaHours?: number; // For corrective maintenance
  partsUsed?: { productId: string, quantity: number }[];
  photos?: string[];
}

export type PurchaseOrderItem = {
  productId: string;
  productCode: string;
  productDescription: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  itemStatus?: 'Confirmado' | 'Sem Estoque' | 'Substituído';
  distributorNotes?: string;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  companyId: string;
  supplierId: string;
  supplierName: string;
  distributorUid?: string;
  distributorCompanyId?: string; // Added to link to distributor's company
  assignedSalespersonId?: string; // Added for salesperson assignment
  assignedSalespersonName?: string; // Added for salesperson assignment
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'Rascunho' | 'Pedido' | 'Recebido' | 'Cancelado' | 'Em preparação' | 'Pronto para Retirada' | 'Pendente de Aprovação do Comprador' | 'Enviado' | 'Revisão Aprovada';
  statusHistory?: StatusHistory[];
  creationDate: string; // ISO String
  orderDate?: string; // ISO String
  deliveryDate?: string; // YYYY-MM-DD
  deliveryOption?: 'retirada' | 'entrega';
  deliveryAddressType?: 'company' | 'other';
  deliveryStreet?: string;
  deliveryNumber?: string;
  deliveryNeighborhood?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryCep?: string;
  deliveryReference?: string;
  receivedDate?: string; // ISO String
  creatorName: string;
  responsibleName?: string; // Nome do responsável/aprovador
  notes?: string;
  destinationLocationId?: string;
  companyName: string;
  deletedAt?: string;
};

export type Vehicle = {
  id: string;
  companyId: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  technicianIds?: string[];
  technicianNames?: string[];
  isShared: boolean;
  notes?: string;
  creationDate?: string;
  deletedAt?: string;
};


export type Communication = {
  id: string;
  companyId: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'comodato' | 'non-comodato';
  type: 'comunicado' | 'promocao';
  sentAt: string; // ISO String
  sentBy: string;
  imageUrl?: string;
  expiresAt?: string; // YYYY-MM-DD
};

export type Note = {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string; // ISO String
};


export type OSReturn = {
  id?: string;
  osId: string;
  osNumber: string;
  technicianId: string;
  technicianName: string;
  returnedAt: string; // ISO String
  reason: string;
  location?: { latitude: number; longitude: number };
  companyId: string;
}

export type LeadHistoryEntry = {
  text: string;
  createdAt: string; // ISO String
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  companyId: string;
  createdAt: string; // ISO String
  status: 'Novo Lead' | 'Em Contato' | 'Finalizado' | 'Conversão';
  source: string; // Ex: 'Site ESP-TEC'
  propertyType?: string;
  propertyDetails?: any;
  tratativa?: string;
  history?: LeadHistoryEntry[];
  deletedAt?: string;
};

export type Promotion = {
  id: string;
  productId?: string;
  distributorId: string;
  distributorName: string;
  productName: string;
  description: string;
  manufacturer?: string;
  specifications?: string;
  imageUrl?: string;
  promoPrice: number;
  originalPrice?: number;
  expiresAt?: string; // ISO String
  createdAt: string; // ISO String
  status?: 'active' | 'inactive';
};

export type DistributorClick = {
  id: string;
  distributorId: string;
  timestamp: string; // ISO String
  clickedByCompanyId: string;
  clickedByCompanyName: string;
};

export type QuoteData = Omit<Quote, 'id' | 'quoteNumber' | 'date'>;
export type VisitData = Omit<Visit, 'id' | 'visitNumber' | 'creationDate'>;
export type UserProfileData = Omit<UserProfile, "uid">;
export type SupplierData = Omit<Supplier, 'id'>;
export type HistoryItem = (Quote & { type: 'os', deletedAt?: string })
  | (Visit & { type: 'visit', deletedAt?: string })
  | (Client & { type: 'client', deletedAt?: string })
  | (Product & { type: 'product', deletedAt?: string })
  | (Supplier & { type: 'supplier', deletedAt?: string })
  | (PurchaseOrder & { type: 'purchase', deletedAt?: string })
  | (Tool & { type: 'tool', deletedAt?: string })
  | (UserProfile & { type: 'user', deletedAt?: string })
  | (OSReturn & { type: 'osReturn', deletedAt?: string })
  | (Promotion & { type: 'promotion', deletedAt?: string })
  | (Lead & { type: 'lead', deletedAt?: string });
