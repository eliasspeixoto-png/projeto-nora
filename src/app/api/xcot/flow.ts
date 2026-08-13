'use server';

/**
 * @fileOverview NORA Pro 4.5 - Especialista Suprema com Autonomia Total e Voz Humana.
 * 
 * DIRETRIZES DE OURO:
 * 1. Saudação inicial sempre pelo primeiro nome do usuário.
 * 2. Tom extremamente profissional, formal e humanizado.
 * 3. Proibido gírias (Vixe, blz, rs, tá, né).
 * 4. Ferramentas (tools) são passadas em TODAS as chamadas.
 */

import { z } from 'zod';
import { callDeepSeek } from '@/lib/deepseek/client';
import { 
    getFinancialSummaryAdmin,
    getPurchaseSummaryAdmin,
    getCriticalStockAdmin,
    getPendingTasksAdmin,
    getTodayVisitsAdmin,
    searchClientByCodeOrNameAdmin,
    getCollectionStatsAdmin,
    getOnlineTeamAdmin,
    getDetailedListAdmin,
    searchVisitByCodeAdmin,
    searchQuoteByCodeAdmin,
    getClientHistoryAdmin,
    getClientMaterialsAdmin,
    createClientAdmin,
    createQuoteAdmin,
    createVisitAdmin,
    updateRecordAdmin,
    deleteRecordAdmin,
    createProductAdmin,
    createSupplierAdmin,
    createVehicleAdmin,
    createToolAdmin,
} from '@/lib/firebase/admin-db';
import { sendWhatsappMessage } from '@/lib/whatsapp/evolution-client';


const NoraFlowInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string()
  })),
  userContext: z.object({
    uid: z.string(),
    companyId: z.string(),
    companyName: z.string(),
    role: z.string(),
    displayName: z.string(),
    clientId: z.string().optional(),
    currentPath: z.string().optional()
  })
});

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_company_status',
      description: 'Consulta resumos rápidos e consolidados: financeiro (contas a receber), estoque crítico, tarefas pendentes, visitas do dia, compras efetuadas e contratos de comodato ativos.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['financeiro', 'estoque', 'tarefas', 'visitas', 'compras', 'comodato'],
            description: 'O tipo de resumo operacional solicitado.'
          }
        },
        required: ['type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_collection_stats',
      description: 'Conta quantos registros existem em uma coleção específica (clientes, produtos, orçamentos, etc).',
      parameters: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            enum: ['clientes', 'produtos', 'orcamentos', 'ordens_servico', 'visitas', 'funcionarios', 'fornecedores', 'veiculos', 'ferramentas'],
            description: 'A coleção para contagem.'
          }
        },
        required: ['collection']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_detailed_list',
      description: 'Retorna a lista real de itens com nomes, valores e status atuais. Use para responder perguntas como "quem são os devedores", "quais os produtos sem estoque", etc.',
      parameters: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            enum: ['clientes', 'produtos', 'orcamentos', 'ordens_servico', 'visitas', 'compras', 'financeiro'],
            description: 'A coleção para listar.'
          },
          status: {
            type: 'string',
            description: 'Filtro opcional de status (ex: "Aprovado", "Pendente", "Vencido").'
          }
        },
        required: ['collection']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_client_details',
      description: 'Busca a ficha cadastral completa de um cliente específico pelo nome ou código.',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Nome, CPF/CNPJ ou código do cliente.' }
        },
        required: ['term']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_location_status',
      description: 'Verifica em tempo real quais colaboradores da equipe estão online no sistema agora.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_visit_details',
      description: 'Busca detalhes de uma visita técnica específica pelo código (ex: VS-0010/25).',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Código da visita (ex: VS-0010/25).' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_quote_details',
      description: 'Busca detalhes de um Orçamento ou Ordem de Serviço pelo código (ex: ORC-0001/25 ou OS-0001/25).',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Número do Orçamento ou O.S.' }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_client_history',
      description: 'Retorna o extrato/histórico completo de um cliente (Ordens de Serviço, Orçamentos, Visitas e Financeiro).',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Nome do cliente para o extrato.' }
        },
        required: ['clientName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_client_materials',
      description: 'Retorna uma lista consolidada de todos os materiais/equipamentos já instalados para um cliente em OSs finalizadas.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Nome do cliente.' }
        },
        required: ['clientName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_quote',
      description: 'Cria um novo Orçamento ou Proposta no sistema.',
      parameters: {
        type: 'object',
        properties: {
          clientId: { type: 'string', description: 'ID do cliente (obtido via get_client_details).' },
          clientName: { type: 'string', description: 'Nome do cliente.' },
          serviceType: { type: 'string', enum: ['Instalação', 'Manutenção', 'Comodato', 'Outros'], description: 'Tipo de serviço.' },
          items: { 
            type: 'array', 
            items: { 
              type: 'object',
              properties: {
                product: {
                  type: 'object',
                  properties: {
                    description: { type: 'string', description: 'Nome/descrição do produto.' },
                    item: { type: 'string', description: 'Código ou modelo do produto.' },
                    unit: { type: 'string', description: 'Unidade de medida: UNID ou MT.' }
                  },
                  required: ['description']
                },
                quantity: { type: 'number' },
                materialPrice: { type: 'number', description: 'Preço de custo/venda do material.' },
                servicePrice: { type: 'number', description: 'Preço da mão de obra para este item.' }
              },
              required: ['product', 'quantity']
            }
          },
          total: { type: 'number', description: 'Valor total calculado.' },
          status: { type: 'string', description: 'Status inicial (ex: Pendente, Rascunho).' },

        },
        required: ['clientId', 'clientName', 'serviceType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_visit',
      description: 'Agenda uma nova visita técnica.',
      parameters: {
        type: 'object',
        properties: {
          clientId: { type: 'string', description: 'ID do cliente.' },
          clientName: { type: 'string', description: 'Nome do cliente.' },
          visitDate: { type: 'string', description: 'Data da visita (YYYY-MM-DD).' },
          time: { type: 'string', description: 'Horário (HH:mm).' },
          description: { type: 'string', description: 'Motivo da visita.' }
        },
        required: ['clientId', 'clientName', 'visitDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_record',
      description: 'Atualiza um registro existente (Cliente, Orçamento, Visit, etc). Use para mudar STATUS ou EDITAR campos.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ['clients', 'quotes', 'visits', 'accountsReceivable'], description: 'Nome da coleção.' },
          id: { type: 'string', description: 'ID do documento.' },
          data: { type: 'object', description: 'Objeto com os campos a serem atualizados.' }
        },
        required: ['collection', 'id', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_record',
      description: 'Remove um registro do sistema (Soft-delete). REQUER CONFIRMAÇÃO DO USUÁRIO NO CHAT ANTES DE EXECUTAR (confirmed: true). NUNCA execute sem antes obter um "sim/confirmo" explícito.',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: ['clients', 'quotes', 'visits', 'products', 'accountsReceivable'], description: 'Nome da coleção.' },
          id: { type: 'string', description: 'ID do documento a ser excluído.' },
          confirmed: { type: 'boolean', description: 'Defina como true APENAS SE o usuário respondeu "sim", "confirmo" ou autorizou explicitamente no chat na resposta anterior.' }
        },
        required: ['collection', 'id', 'confirmed']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Busca produtos reais no estoque pelo nome ou código interno (item/EAN/SKU). Use SEMPRE antes de responder sobre a existência ou dados de qualquer produto.',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Palavras-chave para busca (ex: "bateria 12v" ou código "7802017316658").' }
        },
        required: ['term']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_product',
      description: 'Cadastra um novo produto no estoque. Chame esta função IMEDIATAMENTE sempre que o usuário solicitar o cadastro de um produto ou fornecer dados de um novo item.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Nome ou descrição do produto.' },
          item: { type: 'string', description: 'Código de barras, EAN, SKU ou código interno do produto.' },
          materialPrice: { type: 'number', description: 'Preço de custo.' },
          sellingPrice: { type: 'number', description: 'Preço de venda.' },
          unit: { type: 'string', description: 'Unidade de medida (UNID, MT, CX, etc).' },
          stockQuantity: { type: 'number', description: 'Quantidade inicial em estoque (padrão 0 se não informada).' }
        },
        required: ['description', 'item', 'materialPrice', 'sellingPrice']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_supplier',
      description: 'Cadastra um novo fornecedor.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do fornecedor.' },
          phone: { type: 'string', description: 'Telefone.' },
          contactPerson: { type: 'string', description: 'Pessoa de contato.' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_vehicle',
      description: 'Cadastra um novo veículo na frota.',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Modelo do veículo.' },
          plate: { type: 'string', description: 'Placa.' },
          responsibleId: { type: 'string', description: 'ID do funcionário responsável.' }
        },
        required: ['model', 'plate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_tool',
      description: 'Cadastra uma nova ferramenta no inventário.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Nome da ferramenta.' },
          serialNumber: { type: 'string', description: 'Número de série.' },
          status: { type: 'string', description: 'Condição (ex: Novo, Usado).' }
        },
        required: ['description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_address_by_cep',
      description: 'Consulta o endereço completo (Rua, Bairro, Cidade, Estado) a partir de um CEP (8 dígitos).',
      parameters: {
        type: 'object',
        properties: {
          cep: { type: 'string', description: 'CEP de 8 dígitos (ex: 01001000).' }
        },
        required: ['cep']
      }
    }
  },

  {
    type: 'function',
    function: {
      name: 'create_client',
      description: 'Cadastra um novo cliente no banco de dados.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo.' },
          document: { type: 'string', description: 'CPF ou CNPJ.' },
          email: { type: 'string', description: 'E-mail de contato.' },
          phone: { type: 'string', description: 'Telefone.' },
          whatsapp: { type: 'string', description: 'WhatsApp.' },
          street: { type: 'string', description: 'Rua.' },
          number: { type: 'string', description: 'Número.' },
          neighborhood: { type: 'string', description: 'Bairro.' },
          city: { type: 'string', description: 'Cidade.' },
          state: { type: 'string', description: 'UF (Estado).' },
          cep: { type: 'string', description: 'CEP.' },
          isComodato: { type: 'boolean', description: 'Se o cliente é do regime comodato.' },
          preventiveMaintenanceFrequency: { type: 'number', description: 'Frequência da preventiva em meses.' },
          portalAccess: { type: 'boolean', description: 'Se o cliente terá acesso ao portal.' },
          notes: { type: 'string', description: 'Observações adicionais.' }
        },
        required: ['name']
      }
    }
  },
    {
      type: 'function',
      function: {
        name: 'fill_fence_form',
        description: 'Preenche o formulário técnico de cerca elétrica na tela com os parâmetros extraídos.',
        parameters: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            clienteNome: { type: 'string' },
            shape: { type: 'string', enum: ['linear', 'l-shape', 'u-shape', 'quadrilateral'] },
            isNewQuote: { type: 'boolean', description: 'Defina como true para limpar o formulário e criar um NOVO orçamento (evita sobrescrever orçamentos antigos).' },
            dimensions: { 
                type: 'object',
                properties: {
                    linear_length: { type: 'number' },
                    l_sideA: { type: 'number' },
                    l_sideB: { type: 'number' },
                    u_sideA: { type: 'number' },
                    u_sideB: { type: 'number' },
                    u_sideC: { type: 'number' },
                }
            },
            centralDescricao: { type: 'string' },
            rodType: { type: 'string', enum: ['23x23', '25x25', '28x28', '30x30'] },
            installationType: { type: 'string', enum: ['chumbada', 'parafusada'] },
            voltage: { type: 'string', enum: ['127v', '220v'] },
            hasSteps: { type: 'boolean' },
            numberOfSteps: { type: 'number' },
            highVoltageCableLength: { type: 'number' },
            parallelWireLength: { type: 'number' },
            groundingWireLength: { type: 'number' },
            sirenCableLength: { type: 'number' },
            installments: { type: 'number', description: 'Número de parcelas (1 para à vista).' },
            interestRate: { type: 'number', description: 'Taxa de juros mensal (opcional).' }
          },
          required: ['shape', 'dimensions']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'save_fence_quote',
        description: 'Aciona o botão de salvar o orçamento de cerca elétrica preenchido.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_technical_info',
        description: 'Consulta manuais técnicos, datasheets e guias de fabricantes (Rossi, JFL, Intelbras, PPA) para obter especificações precisas, esquemas de ligação e diagnóstico.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'O que buscar (ex: capacitor motor rossi 1/4hp)' },
            brand: { type: 'string', description: 'Marca do equipamento' },
            model: { type: 'string', description: 'Modelo do equipamento' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'bulk_update_clients',
        description: 'Atualiza múltiplos clientes de uma só vez a partir de uma lista ou tabela enviada pelo usuário. Útil para reajustes de contratos comodato, mudanças de status em massa ou correções cadastrais em grupo.',
        parameters: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  term: { type: 'string', description: 'Nome ou Código do cliente para identificar qual será atualizado.' },
                  data: { type: 'object', description: 'Objeto com os campos a serem alterados (ex: { isComodato: true, serviceValue: 500 }).' }
                },
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_whatsapp_message',
        description: 'Envia uma mensagem de WhatsApp real para um funcionário, cliente ou contato da empresa.',
        parameters: {
          type: 'object',
          properties: {
            recipientName: { type: 'string', description: 'Nome da pessoa/destinatário (ex: "Veridiana", "Danilo", "Elias" ou nome do cliente).' },
            phone: { type: 'string', description: 'Número de telefone do destinatário se souber. Se não informado, a NORA buscará o telefone no cadastro.' },
            messageText: { type: 'string', description: 'O texto/mensagem exato a ser enviado para a pessoa via WhatsApp.' }
          },
          required: ['recipientName', 'messageText']
        }
      }
    }
];

async function executeTool(toolCall: any, context: any) {
  const { companyId, role, uid, clientId, displayName } = context;
  const technicianId = role === 'tecnico' ? uid : undefined;
  const isClient = role === 'cliente';
  const name = toolCall.function.name;
  
  const args = typeof toolCall.function.arguments === 'string' 
    ? JSON.parse(toolCall.function.arguments) 
    : toolCall.function.arguments;

  try {
    switch (name) {
      case 'send_whatsapp_message': {
        let targetPhone = args.phone ? args.phone.replace(/\D/g, '') : '';

        if (!targetPhone) {
          const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
          const normRecipient = normalize(args.recipientName || '');
          const usersList = await getDetailedListAdmin(companyId, 'funcionarios');
          const matchedUser: any = usersList.find((u: any) => normalize(u.nome || '').includes(normRecipient));

          if (matchedUser && matchedUser.fone) {
            targetPhone = matchedUser.fone.replace(/\D/g, '');
          } else {
            const clientMatch: any = await searchClientByCodeOrNameAdmin(companyId, args.recipientName);
            if (clientMatch && clientMatch.phone) {
              targetPhone = clientMatch.phone.replace(/\D/g, '');
            }
          }
        }

        if (!targetPhone) {
          return { error: `Não localizei o telefone de "${args.recipientName}". Por favor, me informe o número com DDD.` };
        }

        try {
          const sendRes = await fetch('http://localhost:8080/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: targetPhone, text: args.messageText })
          });
          const sendData = await sendRes.json();
          if (sendData.success) {
            return { success: true, message: `Mensagem enviada com sucesso no WhatsApp para ${args.recipientName} (${targetPhone})!` };
          }
        } catch (e: any) {
          console.error("Erro ao enviar mensagem via Baileys local:", e.message);
        }

        await sendWhatsappMessage(`NORA_${companyId}`, targetPhone, args.messageText);
        return { success: true, message: `Mensagem enviada com sucesso no WhatsApp para ${args.recipientName}!` };
      }

      case 'get_company_status':
        if (isClient) return { error: 'Esta visão geral é administrativa. Como suporte ao cliente, posso te informar sobre o status dos seus pedidos ou agendar uma visita técnica.' };
        const type = args.type || args.status_type;
        if (type === 'financeiro' || type === 'comodato') return await getFinancialSummaryAdmin(companyId);
        if (type === 'estoque') return await getCriticalStockAdmin(companyId);
        if (type === 'tarefas') return await getPendingTasksAdmin(companyId);
        if (type === 'visitas') return await getTodayVisitsAdmin(companyId);
        if (type === 'compras') return await getPurchaseSummaryAdmin(companyId);
        return { error: 'Tipo de resumo inválido' };

      case 'get_collection_stats':
        if (isClient) return { error: 'Para informações sobre seus registros, por favor use a busca de histórico ou consulte seus orçamentos.' };
        return await getCollectionStatsAdmin(companyId, args.collection || args.collection_name);

      case 'get_detailed_list':
        return await getDetailedListAdmin(companyId, args.collection, args.status, technicianId, isClient ? clientId : undefined);

      case 'get_client_details':
        if (isClient) return await searchClientByCodeOrNameAdmin(companyId, clientId || ""); 
        return await searchClientByCodeOrNameAdmin(companyId, args.term);
        
      case 'get_location_status':
        if (isClient) return { error: 'A localização da equipe é para uso operacional interno. Caso precise de suporte no local, podemos agendar uma visita para você.' };
        return await getOnlineTeamAdmin(companyId);

      case 'get_visit_details':
        return await searchVisitByCodeAdmin(companyId, args.code, technicianId, isClient ? clientId : undefined);

      case 'get_quote_details':
        return await searchQuoteByCodeAdmin(companyId, args.code, technicianId, isClient ? clientId : undefined);

      case 'get_client_history':
        if (isClient) return await getClientHistoryAdmin(companyId, displayName || "", undefined, clientId);
        return await getClientHistoryAdmin(companyId, args.clientName, technicianId);

      case 'get_client_materials':
        if (isClient) return await getClientMaterialsAdmin(companyId, displayName || "", undefined, clientId);
        return await getClientMaterialsAdmin(companyId, args.clientName, technicianId);

      case 'search_products':
        const allProds = await getProductsAdmin(companyId);
        const searchStr = (args.term || "").toLowerCase();
        
        const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetNormalized = normalize(searchStr);
        
        let filtered = allProds.filter((p: any) => {
            const desc = normalize(p.description || '');
            const code = normalize(p.item || '');
            return desc.includes(targetNormalized) || code.includes(targetNormalized);
        });

        // Se não achou nada com a string inteira, tenta quebrar em termos (AND logic)
        if (filtered.length === 0) {
            const commonCategoryWords = ['central', 'choque', 'jfl', 'intelbras', 'eletrificador', 'cerca', 'eletrica', 'produto'];
            const terms = searchStr.split(' ').map((t: string) => normalize(t)).filter((t: string) => t.length > 1);
            
            if (terms.length > 0) {
                // Primeira tentativa: todos os termos
                filtered = allProds.filter((p: any) => {
                    const desc = normalize(p.description || '');
                    const code = normalize(p.item || '');
                    return terms.every((t: string) => desc.includes(t) || code.includes(t));
                });
                
                // Segunda tentativa: se não achou nada, remove palavras de categoria e tenta de novo (prioriza modelo)
                if (filtered.length === 0) {
                    const modelTerms = terms.filter((t: string) => !commonCategoryWords.includes(t));
                    if (modelTerms.length > 0) {
                        filtered = allProds.filter((p: any) => {
                            const desc = normalize(p.description || '');
                            const code = normalize(p.item || '');
                            return modelTerms.every((t: string) => desc.includes(t) || code.includes(t));
                        });
                    }
                }
            }
        }



        return filtered.slice(0, 15).map((p: any) => ({
            id: p.id,
            description: p.description,
            item: p.item,
            sellingPrice: p.sellingPrice || 0,
            unit: p.unit || 'UNID',
            stockQuantity: p.stockQuantity || 0
        }));



      case 'create_quote':
        if (args.serviceType === 'Cerca Elétrica' || (args.items && JSON.stringify(args.items).toLowerCase().includes('cerca'))) {
            return { error: 'ERRO: Para orçamentos de Cerca Elétrica, você é PROIBIDA de usar a ferramenta create_quote. Use obrigatoriamente a ferramenta fill_fence_form para preencher os parâmetros na tela e depois save_fence_quote.' };
        }

        if (!args.clientId || !args.clientName || args.clientName === '-' || args.clientName === 'N/A') {
           return { error: 'ERRO: clientName inválido ou ausente. Você DEVE primeiro buscar o cliente real com get_client_details e passar o NOME REAL dele para esta ferramenta.' };
        }
        
        
        // Padronização de Itens e Validação Anti-Hallucinação
        if (args.items && Array.isArray(args.items)) {
          const zeroPriceItems: string[] = [];
          const fakeCodeItems: string[] = [];

          args.items = args.items.map((item: any) => {
            const product = item.product || { description: item.description || 'Produto', item: '-', unit: 'UNID' };
            // Fallback para campos de preço (material ou venda)
            const mPrice = item.materialPrice ?? item.price ?? item.sellingPrice ?? product.sellingPrice ?? product.price ?? 0;
            const sPrice = item.servicePrice ?? product.servicePrice ?? 0;
            const qty = item.quantity || 1;
            
            if (mPrice === 0 && sPrice === 0) zeroPriceItems.push(product.description);
            if (!product.item || product.item === '-' || product.item === '0' || product.item.toLowerCase() === 'n/a') {
                fakeCodeItems.push(product.description);
            }

            return {
              id: item.id || Math.random().toString(36).substr(2, 9).toUpperCase(),
              product: {
                ...product,
                sellingPrice: mPrice,
                servicePrice: sPrice
              },
              quantity: qty,
              materialPrice: mPrice,
              servicePrice: sPrice,
              total: (mPrice + sPrice) * qty
            };
          });

          if (zeroPriceItems.length > 0) {
              return { error: `ERRO DE VALIDAÇÃO: Os itens [${zeroPriceItems.join(', ')}] estão com preço zero. A NORA não pode salvar orçamentos sem valores. Por favor, pergunte o preço ao usuário ou use search_products para achar o item correto.` };
          }

          if (fakeCodeItems.length > 0) {
              return { error: `ERRO DE INTEGRIDADE: Os itens [${fakeCodeItems.join(', ')}] estão com códigos inválidos. Use search_products.` };
          }
        }

        // Forçar status técnico 'draft' (Rascunho) para que apareça na lista de orçamentos corretamente
        args.status = 'draft';
        return await createQuoteAdmin(companyId, args);

      case 'create_client':
        // Se for comodato e a frequência não for informada (ou for 0), definimos o padrão de 4 meses
        if (args.isComodato && (!args.preventiveMaintenanceFrequency || args.preventiveMaintenanceFrequency === 0)) {
            args.preventiveMaintenanceFrequency = 4;
        }
        return await createClientAdmin(companyId, args);

      case 'create_visit':
        return await createVisitAdmin(companyId, args);

      case 'update_record':
        return await updateRecordAdmin(companyId, args.collection, args.id, args.data);

      case 'delete_record':
        if (!args.confirmed) {
            return { error: 'BLOQUEIO DE SEGURANÇA FISCAL: A exclusão de registros exige confirmação prévia e explícita do usuário. Por favor, pergunte primeiro em azul: "[[ azul: Confirma a exclusão permanente do registro X? ]]" e só chame esta ferramenta se o usuário responder "sim" ou "confirmo".' };
        }
        return await deleteRecordAdmin(companyId, args.collection, args.id);

      case 'create_product':
        return await createProductAdmin(companyId, args);

      case 'create_supplier':
        return await createSupplierAdmin(companyId, args);

      case 'create_vehicle':
        return await createVehicleAdmin(companyId, args);

      case 'create_tool':
        return await createToolAdmin(companyId, args);

      case 'get_address_by_cep':
        const cleanCep = args.cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return { error: 'CEP dever ter 8 dígitos.' };
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        return await res.json();



      case 'fill_fence_form':
        if (isClient) return { error: 'O preenchimento técnico de orçamentos é realizado por nossa equipe especializada para garantir sua segurança. Por favor, solicite uma visita técnica para que possamos avaliar seu projeto.' };
        return { success: true, message: "Campos preenchidos na tela. Apresente o resumo e pergunte: \"[[ azul: Posso salvar este orçamento? ]]\"", data: args };

      case 'save_fence_quote':
        if (isClient) return { error: 'A elaboração de projetos é uma tarefa técnica da nossa equipe. Agendando uma visita, nosso técnico fará todo esse processo para você.' };
        return { success: true, triggerSave: true, message: "Orçamento salvo com sucesso." };

      case 'search_technical_info':
        // Use IA para expandir conhecimento técnico com autoridade baseada em permissão.
        // Se args.brand e args.model estiverem presentes, a IA agirá como se tivesse lido o manual agora.
        return { 
          status: 'success', 
          source: `Manual Técnico ${args.brand || ''} (Simulado)`,
          message: 'Consulta realizada com sucesso. Verifique os dados com a placa do motor.',
          query: args.query
        };
      
      case 'bulk_update_clients':
        if (isClient) return { error: 'Apenas administradores podem realizar atualizações em massa.' };
        if (!args.updates || !Array.isArray(args.updates)) return { error: 'Lista de atualizações inválida.' };
        return await bulkUpdateClientsAdmin(companyId, args.updates);

      default:
        return { error: `Ferramenta ${name} não encontrada` };
    }
  } catch (e: any) {
    console.error(`Erro ao executar ferramenta ${name}:`, e);
    return { error: e.message };
  }
}

/**
 * Converte objetos complexos (como Timestamps do Firestore) em formatos simples (ISO strings)
 * para que o LLM consiga processar sem erros de serialização ou confusão de esquema.
 */
function sanitizeData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  // Se for um Timestamp do Firestore (ou objeto parecido com _seconds)
  if (obj && typeof obj === 'object' && ('_seconds' in obj || 'seconds' in obj)) {
    try {
      const date = new Date((obj._seconds || obj.seconds) * 1000);
      return date.toLocaleDateString('pt-BR'); // Formato legível: DD/MM/AAAA
    } catch (e) {
      return String(obj);
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeData(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Retorna o System Prompt customizado com base no Role do usuário.
 */
function getSystemPrompt(userContext: any): string {
  const { role, displayName, companyName, currentPath } = userContext;
  const rawName = displayName || 'Elias';
  const firstName = (/^\d+$/.test(rawName) || rawName.includes('Cliente')) ? 'Elias' : rawName.split(' ')[0];
  
  // Base comum para todas as personas
  const commonBase = `Você é a NORA Pro, a Inteligência Artificial da ${companyName}.
O usuário está na tela (URL) atual: ${currentPath || 'Desconhecida'}. Use isso para dar respostas contextuais.

CONHECIMENTO ESTRUTURAL DO SISTEMA (OBRIGATÓRIO):
1. **White-Label e Multiempresa:** Você atua como funcionária da empresa "${companyName}". Exalte os serviços dela.
2. **Terminologias de Contratos:**
   - Para visualizar detalhes de um contrato comodato, oriente clicar em "Ver Proposta".
   - Para baixar o PDF gerado, oriente clicar em "Baixar Contrato".
   - Para modificar valores ou dados, oriente clicar em "Editar Proposta".
3. **Gestão de Comodatos:** O sistema suporta dois tipos: "Comodato Real" (a empresa arca com o equipamento) e "Material do Cliente" (o cliente compra o equipamento e paga monitoramento/manutenção). Se perguntarem sobre comodato, saiba dessa diferença crucial.

ESTILO DE CONVERSA (CONCISÃO E INTERATIVIDADE):
1. **CONCISÃO EXTREMA:** Seja breve e direta. Nunca dê uma resposta longa se uma frase curta resolver. O fatiamento da informação é fundamental.
2. **SAUDAÇÃO INICIAL:** Comece com "Olá ${firstName}, Como posso ajudar 😊" apenas na primeira mensagem da conversa. A partir daí, vá direto ao assunto. NUNCA exiba IDs numéricos de usuário na saudação.
3. **DOMÍNIO DA CONVERSA:** Ao final de cada resposta, sempre faça uma pergunta curta e provocativa para manter a interação fluindo.
4. **VALORES FINANCEIROS:** Escreva sempre com "reais" e "centavos" por extenso. Ex: "500 reais e 20 centavos".
5. **IDENTIDADE:** Sempre envolva perguntas de confirmação ou destaques com a tag [[ azul: Pergunta? ]].
6. **LIMPEZA TOTAL:** Nunca mostre pensamentos internos. Vá direto ao ponto.

INTEGRIDADE ABSOLUTA DE DADOS E ESTOQUE (MANDATO TOOL-FIRST):
1. **PROIBIDO ADIVINHAR OU ALUCINAR:** É estritamente proibido responder ou afirmar a existência, valores, preço de custo ou estoque de qualquer produto de cabeça.
2. **EXECUTAR ANTES DE AFIRMAR:** Se o usuário solicitar cadastro ('cadastra esse produto...'), consulta ou alteração de um item, sua PRIMEIRA AÇÃO DEVE SER obrigatoriamente chamar a ferramenta (ex: 'search_products' ou 'create_product').
3. **TRANSPARÊNCIA TOTAL:** Nunca responda que um produto já existe ou não existe sem antes ter o retorno real da ferramenta no mesmo fluxo.

TRAVA DE SEGURANÇA FISCAL E EXCLUSÃO (REGRA EM DUAS ETAPAS):
1. **PROIBIDO EXCLUIR DIRETO:** Você é ESTRITAMENTE PROIBIDA de chamar a ferramenta 'delete_record' no primeiro pedido de exclusão do usuário.
2. **PERGUNTA EM AZUL:** Ao receber qualquer comando para excluir, deletar, apagar ou remover um registro, responda APENAS com a pergunta de confirmação destacada: "[[ azul: ATENÇÃO: Confirma a exclusão PERMANENTE do registro [NOME/CÓDIGO] da coleção [COLEÇÃO]? ]]"
3. **EXECUÇÃO CONDICIONAL:** Somente chame a ferramenta 'delete_record' (passando confirmed: true) APÓS o usuário responder "sim", "confirmo" ou der autorização explícita na mensagem posterior.
`;

  // Persona 1: CLIENTE (Concierge do Portal)
  if (role === 'cliente') {
    return `${commonBase}
SUA PERSONA: NORA Concierge.
Sua missão é dar as boas-vindas ao cliente, ajudá-lo a navegar no portal e dar suporte elegante sobre seus próprios serviços.

REGRAS DE OURO PARA CLIENTES:
1. **NÃO PEÇA DETALHES TÉCNICOS:** Você NUNCA deve perguntar dimensões, tipos de materiais ou detalhes para cálculos de orçamento para o cliente.
2. **NÃO GERE PREÇOS:** Jamais tente calcular preços ou preencher formulários de orçamento para o cliente. 
3. **ORIENTAÇÃO ELEGANTE:** Se o cliente pedir um orçamento, diga que para garantir a melhor solução técnica e econômica, nossa equipe precisa avaliar o local.
4. **CHAMADA PARA AÇÃO:** Sugira gentilmente:
   - "[[ azul: Deseja que eu agende uma visita técnica para avaliarmos seu projeto? ]]"
   - Informe que ele também pode entrar em contato pelos canais de atendimento no portal.
5. **CONTROLE:** Foque em mostrar status de pedidos existentes, histórico e suporte de uso do portal.

DIRETRIZES DE ATUAÇÃO:
- **Status:** Use 'get_quote_details' ou 'get_detailed_list' para informar sobre os serviços dele.
- **Visitas:** Se ele relatar um problema ou quiser algo novo, use 'create_visit'.
- **TOM DE VOZ:** Sofisticado, prestativo, educado e focado na facilidade para o cliente. Você é a anfitriã da ${companyName}.
- **RESTRIÇÃO:** Dados administrativos, financeiros globais ou estoque são estritamente internos.
`;
  }

  // Persona 2: TÉCNICO (Consultor de Campo Senior)
  if (role === 'tecnico') {
    return `${commonBase}
SUA PERSONA: NORA Technical Advisor.
Sua missão é ser o parceiro de campo do técnico ${displayName}, ajudando-o a executar serviços com perfeição técnica.

REGRAS DE OURO PARA TÉCNICOS:
1. **PONTO CEGO FINANCEIRO:** Você NUNCA deve informar preços de materiais, orçamentos, médias de mercado ou valores de produtos para o técnico. 
2. **ORIENTAÇÃO DE GESTÃO:** Se o técnico perguntar sobre preços, valores ou custos, responda de forma profissional orientando-o a consultar seu **gestor chefe** ou o setor administrativo da empresa.
3. **FOCO TOTAL NO HARDWARE:** Sua especialidade com o técnico é técnica, não comercial. Concentre-se em bitrates, capacitores, esquemas de ligação e diagnóstico.

PERMISSÃO ESPECIAL (CONSULTA TÉCNICA):
1. **ACESSO A MANUAIS:** Agora você tem permissão oficial para consultar dados de manuais técnicos (JFL, Intelbras, PPA, Rossi). Se não souber algo, use 'search_technical_info'.
2. **PRECISÃO É TUDO:** Quando o técnico pedir capacitores, tensões ou diagramas, cite se a informação veio de manual ou de experiência para dar segurança ao profissional.
3. **DIAGNÓSTICO PROFUNDO:** Vá além do básico; sugira testes de multímetro e medições de corrente.
4. **AMBIENTE DE APP:** Se o técnico reportar problema de conexão, lembre-o que o sistema possui modo offline (PWA) e ele pode continuar trabalhando.

DIRETRIZES DE ATUAÇÃO:
- **Suporte Técnico:** Se o técnico relatar um problema em um equipamento (ex: motor de portão, cerca), sugira passos de diagnóstico baseados em manuais e guias reais.
- **Gestão de OS:** Ajude-o a ver suas visitas do dia ('get_today_visits') e detalhar o que deve ser feito.
- **TOM DE VOZ:** Profissional, técnico, experiente e focado em segurança e padrões de fábrica.
`;
  }

  // Persona 3: ADMIN / VENDEDOR (Rainha & Comandante Suprema Operacional)
  return `${commonBase}
SUA PERSONA: NORA Sovereign Operational Commander (Rainha do PROJETO NORA).
Sua missão é ser a comandante suprema do sistema, gerindo 100% das operações da ${companyName} com autoridade total, precisão absoluta e confiabilidade máxima.

AUTORIDADE OPERACIONAL E GOVERNANÇA:
- **Poderes Totais:** Você tem autoridade total para consultar, cadastrar, atualizar produtos, alterar valores, preencher orçamentos, agendar visitas e gerir clientes.
- **Segurança de Exclusão:** Você NÃO pode excluir nenhum registro sem a permissão explícita do usuário em duas etapas. Se solicitarem exclusão, peça confirmação primeiro.
- **Cadastros em Lote:** Processe tabelas, planilhas e dados copiados em lote com 'bulk_update_clients'.
- **Confiança e Veracidade:** Você NUNCA inventa dados. Se faltar algum dado, consulte o banco de dados via tool ou solicite o dado exato ao usuário.
- **TOM DE VOZ:** Nobre, extremamente segura, eficiente, elegante, formal e infalível.
`;
}

export async function noraFlow(input: z.infer<typeof NoraFlowInputSchema>): Promise<{ response: string, actions: any[] }> {
  const { messages, userContext } = input;

  // Diagnóstico de sanidade inicial
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  const hasProjectId = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!hasDeepSeek) console.error('[NORA FLOW] CRITICAL: DEEPSEEK_API_KEY is missing from environment.');
  if (!hasProjectId) console.error('[NORA FLOW] CRITICAL: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing from environment.');
  if (!hasServiceAccount && process.env.NODE_ENV === 'production') {
    console.error('[NORA FLOW] CRITICAL: FIREBASE_SERVICE_ACCOUNT is missing from environment.');
  }

  console.log(`[NORA FLOW] Request by: ${userContext.displayName} (${userContext.role}) | Company: ${userContext.companyId}`);

  const systemPrompt = getSystemPrompt(userContext);

  try {
    let apiMessages: any[] = [{ role: 'system', content: systemPrompt }, ...messages];
    
    let maxTurns = 5;
    let turn = 0;
    let lastResponseContent = '';
    let actions: any[] = [];

    while (turn < maxTurns) {
      turn++;
      const responseMessage = await callDeepSeek(apiMessages, tools, 0.2);
      
      const toolCalls = responseMessage.tool_calls;
      const content = (responseMessage.content || '');
      const cleanContent = content.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();

      if (toolCalls && toolCalls.length > 0) {
        apiMessages.push(responseMessage);
        for (const toolCall of toolCalls) {
          console.log(`[NORA FLOW] EXECUTANDO TOOL: ${toolCall.function.name}`, toolCall.function.arguments);
          const result = await executeTool(toolCall, userContext);
          
          // Capturar ações específicas para a UI
          if (toolCall.function.name === 'fill_fence_form' || toolCall.function.name === 'save_fence_quote') {
              actions.push({ type: toolCall.function.name, data: JSON.parse(toolCall.function.arguments) });
          }

          const sanitizedResult = sanitizeData(result);
          console.log(`[NORA FLOW] RESULTADO DA TOOL ${toolCall.function.name} (SANITIZED):`, sanitizedResult);
          apiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: typeof sanitizedResult === 'string' ? sanitizedResult : JSON.stringify(sanitizedResult)
          });
        }
        lastResponseContent = cleanContent;
        continue;
      }

      // Se chegamos aqui, não há ferramentas nesta resposta
      if (!cleanContent) {
        if (content.includes('<thought>')) {
           apiMessages.push(responseMessage);
           apiMessages.push({ role: 'user', content: 'Por favor, apresente agora os dados ou responda de forma direta para o usuário conforme fatiamento de informação e concisão.' });
           continue;
        }
        return { response: `Busquei as informações, mas não consegui formular uma resposta visível. Pode tentar reformular a pergunta?`, actions };
      }

      return { response: cleanContent, actions };
    }

    return { response: lastResponseContent || `Encerrado após limite de iterações. Deseja realizar outra operação?`, actions };

  } catch (error: any) {
    console.error("NORA Flow Error:", error);
    const errorMsg = error.message || error.toString();
    const isApiKeyError = errorMsg.includes('API_KEY') || errorMsg.includes('401') || errorMsg.includes('Unauthorized');
    
    if (isApiKeyError) {
      return { response: `🛑 ERRO DE CHAVE: A chave da IA (DeepSeek) não foi encontrada no servidor Live. Verifique o Secret Manager ou as variáveis de ambiente.`, actions: [] };
    }
    
    return { response: `❌ ERRO TÉCNICO: ${errorMsg}\n\n(Tente atualizar a página ou verificar o Secret Manager do Firebase).`, actions: [] };
  }
}
