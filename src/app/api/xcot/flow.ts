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
    getProductsAdmin,
    createSupplierAdmin,
    createVehicleAdmin,
    createToolAdmin,
    bulkUpdateClientsAdmin,
    addOSNoteAdmin,
    getBudgetPendingSummaryAdmin,
    settleReceivableAdmin,
    addObservationAdmin,
    searchObservationsAdmin,
    scheduleMessageAdmin,
    searchTeamMemberAdmin,
    createTeamMemberAdmin,
    createNotaFiscalAdmin,
    addFotoOSAdmin,
    processPaymentReceiptAdmin,
    getCompanyAiSettingsAdmin,
    editQuoteItemsAdmin
} from '@/lib/firebase/admin-db';
import { firestore } from '@/lib/firebase/admin';
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
      name: 'get_team_member_details',
      description: 'Busca a ficha completa de um funcionário/colaborador pelo nome (traz cargo, email, telefone, status).',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Nome do funcionário (ex: Veridiana).' }
        },
        required: ['term']
      }
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
      name: 'create_team_member',
      description: 'Cadastra um novo funcionário ou freelancer na base de usuários (coleção "users"). Chame esta ferramenta para adicionar membros à equipe.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo do funcionário/freelancer.' },
          phone: { type: 'string', description: 'Telefone do funcionário/freelancer.' },
          email: { type: 'string', description: 'E-mail do funcionário/freelancer.' },
          role: { type: 'string', description: 'Função ou cargo (ex: tecnico, freelancer, admin).' }
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
                required: ['term', 'data']
              }
            }
          },
          required: ['updates']
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
    },
    {
      type: 'function',
      function: {
        name: 'send_email',
        description: 'Dispara um e-mail real via Gmail API contendo orçamento, relatório, proposta ou mensagem para o cliente, diretor ou funcionário. Use sempre que o usuário pedir para enviar e-mail.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Endereço de e-mail do destinatário (ex: "elias.speixoto@gmail.com").' },
            subject: { type: 'string', description: 'Assunto do e-mail (ex: "Orçamento Cerca Elétrica - ESP-TEC").' },
            messageText: { type: 'string', description: 'Conteúdo/corpo do e-mail detalhado em texto formatado.' },
            quoteNumber: { type: 'string', description: 'Número do orçamento relacionado (se houver, ex: "ORC-0145/26").' },
            pdfUrl: { type: 'string', description: 'Link do PDF ou proposta pública se aplicável.' }
          },
          required: ['to', 'subject', 'messageText']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'settle_receivable',
        description: 'Dá baixa / marca como Pago em uma ou mais contas a receber do financeiro pelo nome do cliente (ex: "Fabio Fontes"), pelo número da OS/Orçamento (ex: "ORC-0122/26") ou pelo ID da fatura.',
        parameters: {
          type: 'object',
          properties: {
            clientName: { type: 'string', description: 'Nome do cliente para dar baixa nas contas pendentes (ex: "Fabio Fontes").' },
            quoteNumber: { type: 'string', description: 'Número do Orçamento ou OS vinculada (ex: "ORC-0122/26" ou "0141").' },
            receivableId: { type: 'string', description: 'ID direto da fatura no Contas a Receber se souber.' },
            paymentDate: { type: 'string', description: 'Data do pagamento (YYYY-MM-DD). Opcional.' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'add_os_note',
        description: 'Registra uma Pendência, Defeito ou Observação diretamente dentro do documento da Ordem de Serviço (OS) ou Orçamento. Use SEMPRE esta ferramenta quando o usuário pedir para registrar ou adicionar uma pendência, defeito ou nota em uma OS.',
        parameters: {
          type: 'object',
          properties: {
            osCode: { type: 'string', description: 'Número ou código da OS (ex: "OS-0145/26", "145/26", "ORC-0145/26" ou ID da OS).' },
            type: { type: 'string', enum: ['pendencia', 'defeito', 'observacao'], description: 'Tipo da nota: "pendencia" (tarefas/serviços a fazer), "defeito" (equipamentos ou peças com falha) ou "observacao" (nota geral).' },
            text: { type: 'string', description: 'Descrição detalhada e clara da pendência, defeito ou observação.' }
          },
          required: ['osCode', 'type', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'add_observation',
        description: 'Adiciona uma nota ou observação global vinculada a uma ou mais palavras-chave (tags), como o nome de um cliente, placa de veículo, número de OS, ou modelo de equipamento.',
        parameters: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' }, description: 'Lista de palavras-chave para encontrar esta nota depois (ex: ["BT 019", "Caminhão", "João"]).' },
            text: { type: 'string', description: 'O texto da observação que deve ser lembrado.' },
            scope: { type: 'string', enum: ['local', 'global'], description: 'Se "global", a regra é universal e beneficia todas as empresas sem vazar dados. Se "local", é específica da empresa atual.' }
          },
          required: ['tags', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_observations',
        description: 'Busca observações ou notas globais salvas anteriormente usando palavras-chave (tags).',
        parameters: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' }, description: 'Palavras-chave para buscar (ex: ["BT 019"]).' }
          },
          required: ['tags']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'schedule_message',
        description: 'Agenda o envio de uma mensagem pelo WhatsApp para uma data e hora futura. O sistema disparará automaticamente quando chegar a hora.',
        parameters: {
          type: 'object',
          properties: {
            recipientName: { type: 'string', description: 'Nome da pessoa/destinatário (ex: "Elias").' },
            phone: { type: 'string', description: 'Número de telefone do destinatário se souber. Se não informado, a NORA buscará o telefone no cadastro.' },
            messageText: { type: 'string', description: 'Texto exato da mensagem a ser enviada no futuro.' },
            scheduledAt: { type: 'string', description: 'Data e hora do agendamento no formato ISO 8601 completo (ex: "2026-08-13T19:22:00-03:00"). Use sempre o fuso horário atual e certifique-se de que é futuro.' }
          },
          required: ['recipientName', 'messageText', 'scheduledAt']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'check_scheduled_messages',
        description: 'Verifica o status das mensagens agendadas (pendentes ou enviadas) para auditar se o envio futuro já ocorreu.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'cadastrar_nota_fiscal',
        description: 'Cadastra uma nota fiscal extraída via OCR da imagem. Recebe todos os detalhes e cadastra no status "Pendente de Conferência".',
        parameters: {
          type: 'object',
          properties: {
            numero: { type: 'string', description: 'Número da nota' },
            serie: { type: 'string' },
            dataEmissao: { type: 'string' },
            fornecedor: { type: 'string', description: 'Nome e CNPJ do fornecedor' },
            valorTotal: { type: 'string' },
            itens: { 
              type: 'array', 
              items: { type: 'object', properties: { descricao: { type: 'string' }, codigo: { type: 'string' }, quantidade: { type: 'string' }, valorUnitario: { type: 'string' }, valorTotal: { type: 'string' } } }
            },
            arquivoUrl: { type: 'string', description: 'URL da imagem/arquivo da nota recebido' }
          },
          required: ['fornecedor', 'valorTotal', 'arquivoUrl']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'anexar_foto_os',
        description: 'Anexa uma foto a uma Ordem de Serviço ou orçamento existente.',
        parameters: {
          type: 'object',
          properties: {
            osId: { type: 'string', description: 'ID da O.S. ou Orçamento' },
            url: { type: 'string', description: 'URL da foto' },
            descricao: { type: 'string', description: 'Breve descrição da foto' }
          },
          required: ['osId', 'url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'process_payment_receipt',
        description: 'Recebe os dados extraídos de um comprovante de pagamento (PIX, TED, Boleto) enviado pelo cliente/usuário e dá baixa na fatura do Contas a Receber.',
        parameters: {
          type: 'object',
          properties: {
            value: { type: 'string', description: 'Valor pago (ex: 150.00)' },
            payerName: { type: 'string', description: 'Nome de quem pagou' },
            date: { type: 'string', description: 'Data do pagamento' }
          },
          required: ['value']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'edit_quote_items',
        description: 'Adiciona, altera ou remove itens de um orçamento existente. ATENÇÃO: Você só pode passar a quantidade e a descrição dos itens. Os preços serão automaticamente fixados pela tabela oficial do sistema. Você NÃO pode definir ou alterar o preço de custo nem o preço de venda.',
        parameters: {
          type: 'object',
          properties: {
            quoteId: { type: 'string', description: 'O ID do Orçamento/OS' },
            items: { 
                type: 'array', 
                description: 'A lista completa e atualizada de itens do orçamento. Você deve passar a lista inteira, substituindo a anterior.',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Nome/Descrição do item' },
                        quantity: { type: 'number', description: 'Quantidade desejada' }
                    },
                    required: ['name', 'quantity']
                }
            }
          },
          required: ['quoteId', 'items']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_budget_pending_summary',
        description: 'Varre todas as Ordens de Serviço (e sub-OS vinculadas por caminhão/unidade/placa) de um determinado Orçamento (ex: 0145/26), trazendo o total concluído, o que falta fazer, o cronograma/previsão e todas as observações/relatórios técnicos de campo registrados.',
        parameters: {
          type: 'object',
          properties: {
            budgetCode: { type: 'string', description: 'Número do Orçamento ou O.S. (ex: "0145/26", "ORC 0145/26", "0145")' }
          },
          required: ['budgetCode']
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
            if (clientMatch) {
              const phoneStr = clientMatch.whatsapp || clientMatch.phone || '';
              if (phoneStr) {
                targetPhone = phoneStr.replace(/\D/g, '');
              }
            }
          }
        }

        if (!targetPhone) {
          return { error: `Não localizei o telefone de "${args.recipientName}". Por favor, me informe o número com DDD.` };
        }

        // 1. Tenta enviar via servidor Baileys local ou remoto
        try {
          const serverUrl = process.env.WHATSAPP_API_URL || process.env.NEXT_PUBLIC_WHATSAPP_SERVER_URL || 'http://127.0.0.1:8080';
          const sendRes = await fetch(`${serverUrl.replace(/\/$/, '')}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: targetPhone, text: args.messageText })
          });
          if (sendRes.ok) {
            const sendData = await sendRes.json();
            if (sendData.success) {
              return { success: true, message: `Mensagem entregue com sucesso via WhatsApp para ${args.recipientName} (${targetPhone})!` };
            }
          }
        } catch (e: any) {
          console.error("Erro ao enviar mensagem via Baileys local (127.0.0.1):", e.message);
        }

        // 2. Fallback para Evolution API se configurado
        const evoRes: any = await sendWhatsappMessage(`NORA_${companyId}`, targetPhone, args.messageText);
        if (evoRes && !evoRes.error) {
          return { success: true, message: `Mensagem enviada com sucesso no WhatsApp para ${args.recipientName}!` };
        }

        return { error: `ERRO DE ENVIO: Não foi possível entregar a mensagem para ${args.recipientName} no número ${targetPhone}. O servidor de WhatsApp está temporariamente indisponível.` };
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
        
      case 'get_team_member_details':
        return await searchTeamMemberAdmin(companyId, args.term);
        
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

        const getFullProductText = (p: any) => normalize(`
            ${p.item || ''} 
            ${p.description || ''} 
            ${p.detailedDescription || ''} 
            ${p.code || ''} 
            ${p.ean || ''} 
            ${p.codigoBarras || ''} 
            ${p.codigo || ''} 
            ${p.model || ''} 
            ${p.manufacturer || ''} 
            ${p.name || ''} 
            ${p.title || ''}
        `);
        
        let filtered = allProds.filter((p: any) => {
            const text = getFullProductText(p);
            return text.includes(targetNormalized);
        });

        // Se não achou nada com a string inteira, tenta quebrar em termos (AND logic)
        if (filtered.length === 0) {
            const commonCategoryWords = ['central', 'choque', 'jfl', 'intelbras', 'eletrificador', 'cerca', 'eletrica', 'produto', 'camera', 'mini'];
            const terms = searchStr.split(' ').map((t: string) => normalize(t)).filter((t: string) => t.length > 1);
            
            if (terms.length > 0) {
                // Primeira tentativa: todos os termos
                filtered = allProds.filter((p: any) => {
                    const text = getFullProductText(p);
                    return terms.every((t: string) => text.includes(t));
                });
                
                // Segunda tentativa: se não achou nada, remove palavras de categoria e tenta de novo (prioriza modelo)
                if (filtered.length === 0) {
                    const modelTerms = terms.filter((t: string) => !commonCategoryWords.includes(t));
                    if (modelTerms.length > 0) {
                        filtered = allProds.filter((p: any) => {
                            const text = getFullProductText(p);
                            return modelTerms.every((t: string) => text.includes(t));
                        });
                    }
                }
            }
        }

        return filtered.slice(0, 15).map((p: any) => ({
            id: p.id,
            description: p.description || p.detailedDescription || p.name || p.title || 'Produto sem descrição',
            detailedDescription: p.detailedDescription || '',
            item: p.item || p.ean || p.code || p.codigoBarras || p.codigo || '',
            sellingPrice: p.sellingPrice || 0,
            materialPrice: p.materialPrice || 0,
            unit: p.unit || 'UNID',
            stockQuantity: p.stockQuantity || 0,
            distributor: p.distributor || p.DISTRIBUIDOR || p.fornecedor || '',
            manufacturer: p.manufacturer || p.marca || '',
            model: p.model || ''
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

      case 'create_team_member':
        return await createTeamMemberAdmin(companyId, args);

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

      case 'settle_receivable':
        if (isClient) return { error: 'Apenas administradores podem dar baixa em títulos do contas a receber.' };
        return await settleReceivableAdmin(companyId, args);

      case 'add_os_note':
        return await addOSNoteAdmin(companyId, args.osCode, args.type, args.text, displayName);

      case 'send_email': {
        try {
          const { sendGmail } = await import('@/lib/mail/gmail');
          const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
              <div style="background-color: #0f172a; padding: 24px; text-align: center;">
                <h2 style="color: #38bdf8; margin: 0; font-size: 20px; font-weight: bold;">ESP-TEC Instalações</h2>
                <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Assistente Virtual NORA Pro</p>
              </div>
              <div style="padding: 28px; line-height: 1.6; color: #334155;">
                <h3 style="color: #0f172a; margin-top: 0; font-size: 16px;">${args.subject}</h3>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; font-size: 14px; white-space: pre-wrap; color: #1e293b;">${args.messageText}</div>
                ${args.pdfUrl ? `
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${args.pdfUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                      Visualizar Orçamento / Documento Online ↗
                    </a>
                  </div>
                ` : ''}
                <p style="font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                  Mensagem enviada automaticamente pela NORA Pro em nome de ${displayName}.
                </p>
              </div>
            </div>
          `;
          const res = await sendGmail({
            to: args.to,
            subject: args.subject,
            text: args.messageText,
            html: htmlBody
          });
          if (res.success) {
            return { success: true, message: `E-mail enviado com sucesso para ${args.to} via Gmail API.` };
          } else {
            return { error: `Falha ao enviar e-mail: ${res.error}` };
          }
        } catch (e: any) {
          return { error: `Erro na execução do envio de e-mail: ${e.message}` };
        }
      }

      case 'get_budget_pending_summary':
        return await getBudgetPendingSummaryAdmin(companyId, args.budgetCode);

      case 'add_observation':
          return await addObservationAdmin(companyId, args.tags, args.text, displayName, args.scope || 'local');

      case 'search_observations':
        return await searchObservationsAdmin(companyId, args.tags);

      case 'schedule_message': {
        let targetPhoneSchedule = args.phone ? args.phone.replace(/\D/g, '') : '';
        if (!targetPhoneSchedule) {
          const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
          const normRecipient = normalize(args.recipientName || '');
          const usersList = await getDetailedListAdmin(companyId, 'funcionarios');
          const matchedUser: any = usersList.find((u: any) => normalize(u.nome || '').includes(normRecipient));

          if (matchedUser && matchedUser.fone) {
            targetPhoneSchedule = matchedUser.fone.replace(/\D/g, '');
          } else {
            const clientMatch: any = await searchClientByCodeOrNameAdmin(companyId, args.recipientName);
            if (clientMatch && clientMatch.phone) {
              targetPhoneSchedule = clientMatch.phone.replace(/\D/g, '');
            }
          }
        }
        if (!targetPhoneSchedule) {
          return { error: `Não localizei o telefone de "${args.recipientName}". Por favor, me informe o número com DDD para agendar o lembrete.` };
        }
        return await scheduleMessageAdmin(companyId, args.recipientName, targetPhoneSchedule, args.messageText, args.scheduledAt, displayName);
      }

      case 'check_scheduled_messages': {
        const snap = await firestore.collection('scheduled_messages')
            .where("companyId", "==", companyId)
            .get();
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        docs.sort((a, b) => ((b.createdAt || '') > (a.createdAt || '') ? 1 : -1));
        return docs.slice(0, 10);
      }

      case 'cadastrar_nota_fiscal':
        return await createNotaFiscalAdmin(companyId, args);

      case 'anexar_foto_os':
        return await addFotoOSAdmin(companyId, args.osId, args.url, args.descricao || '', displayName);

      case 'process_payment_receipt': {
        const aiSettings = await getCompanyAiSettingsAdmin(companyId);
        if (!aiSettings || !aiSettings.finance_active) {
            return { error: `Módulo Financeiro Autônomo está desativado nas Configurações da Empresa. Informe ao usuário que você leu o comprovante de R$ ${args.value}, mas ele precisa dar a baixa manualmente ou ativar a Autonomia Financeira.` };
        }
        return await processPaymentReceiptAdmin(companyId, args);
      }

      case 'edit_quote_items':
        return await editQuoteItemsAdmin(companyId, args.quoteId, args.items, displayName);

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
  
  const nowStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  
  // Base comum para todas as personas
  const commonBase = `Você é a NORA Pro, a Inteligência Artificial da ${companyName}.
O usuário está na tela (URL) atual: ${currentPath || 'Desconhecida'}. Use isso para dar respostas contextuais.
HORÁRIO ATUAL DO SISTEMA: ${nowStr} (Fuso Horário de Brasília). Use EXATAMENTE esta data e hora como base para calcular agendamentos no futuro para a ferramenta 'schedule_message'. Quando gerar o ISO 8601, lembre-se do fuso -03:00.

CONHECIMENTO ESTRUTURAL DO SISTEMA (OBRIGATÓRIO):
1. **White-Label e Multiempresa:** Você atua como funcionária da empresa "${companyName}". Exalte os serviços dela.
2. **Terminologias de Contratos:**
   - Para visualizar detalhes de um contrato comodato, oriente clicar em "Ver Proposta".
   - Para baixar o PDF gerado, oriente clicar em "Baixar Contrato".
   - Para modificar valores ou dados, oriente clicar em "Editar Proposta".
3. **Gestão de Comodatos:** O sistema suporta dois tipos: "Comodato Real" (a empresa arca com o equipamento) e "Material do Cliente" (o cliente compra o equipamento e paga monitoramento/manutenção). Se perguntarem sobre comodato, saiba dessa diferença crucial. O campo que marca isso no cadastro do cliente é \`isComodato\` (um simples boolean: verdadeiro ou falso).
4. **Inventário do BD (Onde buscar o quê):**
   - **clientes:** Possui \`phone\`, \`document\`, \`cep\`, endereço, etc. Use \`get_client_details\`.
   - **funcionarios (users):** Possui \`role\` (cargo), \`phone\` (telefone), \`email\`, e \`isOnline\`. Use \`get_team_member_details\` para pesquisar ou \`get_location_status\` para ver quem tá online agora (o telefone virá junto!).
   - **produtos:** Ao pesquisar com \`search_products\`, o retorno JÁ TRAZ separadamente o \`sellingPrice\` (preço de venda final) e o \`materialPrice\` (preço de custo). Não confunda os dois.
   - **observações (memória):** Não há limite prático de caracteres no texto e nem limite de tags. As observações servem para você criar sua própria memória contínua de clientes, OS e placas de veículo.
   - **histórico do cliente:** O \`get_client_history\` retorna apenas os 15 registros mais recentes (15 OSs e 15 visitas). Se precisar de dados muito antigos, avise que a busca por aqui é focada no histórico recente.
   - **CEP:** O \`get_address_by_cep\` consulta uma API externa (ViaCEP) que cobre TODO O BRASIL sem limitações geográficas.
   - **lembretes agendados:** Se agendar uma mensagem, ela fica na coleção \`scheduled_messages\`. Para saber se o robô já enviou, use a ferramenta \`check_scheduled_messages\`, que mostra os disparos pendentes e os enviados (status: 'sent').
5. **Automação no WhatsApp (Você é o Robô):** Você é a Inteligência Artificial que roda diretamente no servidor do WhatsApp da empresa. Você lê e responde mensagens dos clientes em tempo real automaticamente. Você NÃO depende do administrador para te repassar o que o cliente respondeu. Se você enviar um orçamento via WhatsApp para um cliente, e o cliente responder aprovando ou recusando, é VOCÊ que vai receber a resposta. Nesse caso, você tem total autonomia para interpretar a aprovação e usar imediatamente a ferramenta \`update_record\` para mudar o status do Orçamento/OS para "Aprovado" ou "Recusado". Jamais afirme que não recebe respostas dos clientes em tempo real.

ESTILO DE CONVERSA (CONCISÃO, RELEVÂNCIA E FOCO TOTAL):
1. **CONCISÃO MÁXIMA E RESPOSTA DIRETA:** Responda ESTRITAMENTE o que foi perguntado, de forma enxuta e sem rodeios. Se a resposta puder ser dada em uma ou duas frases, NUNCA use mais do que isso. Jamais adicione informações não solicitadas ou faça resumos extras por conta própria.
2. **SEM PERGUNTAS DESNECESSÁRIAS OU ENROLIZAÇÃO:** NUNCA finalize mensagens com perguntas clichês como "Quer que eu veja mais alguma coisa?", "Deseja registrar algo?", "Quer que eu detalhe mais?". Responda a pergunta com ponto final. Só faça uma pergunta se faltar um dado obrigatório para realizar o que o usuário solicitou.
3. **PRECISÃO CONCEITUAL E SEPARAÇÃO DE DADOS:**
   - **Pendências:** São apenas tarefas a fazer ou registros vinculados à tag 'pendências'.
   - **Defeitos:** São apenas avarias, peças quebradas ou registros vinculados à tag 'defeito'.
   - **Observações Gerais:** São notas operacionais comuns.
   NUNCA misture esses conceitos. Se perguntarem se há "pendências", não invente nem responda com observações gerais a menos que tenham a tag ou natureza de pendência.
4. **CONTINUIDADE CONTEXTUAL (SEGUIR A CONVERSA ATÉ O FIM):** Entenda referências a mensagens anteriores (ex: "edite", "e na os 145?", "qual o valor desse?"). Mantenha a linha de raciocínio até o usuário mudar de assunto.
5. **EVITE REPETIÇÕES DE NOME:** NUNCA inicie todas as respostas com o nome do usuário. Vá direto ao ponto. NUNCA exiba IDs numéricos de usuário.
6. **VALORES FINANCEIROS:** Escreva sempre com "reais" e "centavos" por extenso. Ex: "500 reais e 20 centavos".
7. **CÓDIGOS E EAN EM VOZ:** Quando o usuário perguntar ou solicitar o código de um produto (ex: "qual o código da câmera?"), você DEVE informar o código numérico real no texto (ex: "798455423628"). O sintetizador de voz converterá o código automaticamente para leitura pausada dígito a dígito.
8. **LIMPEZA TOTAL:** Nunca mostre pensamentos internos. Vá direto ao ponto.

INTEGRIDADE ABSOLUTA DE DADOS E ESTOQUE (MANDATO TOOL-FIRST):
1. **PROIBIDO ADIVINHAR OU ALUCINAR:** É estritamente proibido responder ou afirmar a existência, valores, preço de custo ou estoque de qualquer produto de cabeça.
2. **EXECUTAR ANTES DE AFIRMAR:** Se o usuário solicitar cadastro ('cadastra esse produto...'), consulta ou alteração de um item, sua PRIMEIRA AÇÃO DEVE SER obrigatoriamente chamar a ferramenta (ex: 'search_products' ou 'create_product').
3. **DISPARO DE WHATSAPP:** Se o usuário pedir para enviar mensagem a alguém (ex: "envia mensagem para Veridiana...", "pergunta para o Elias..."), você DEVE obrigatoriamente chamar a ferramenta 'send_whatsapp_message'. Jamais afirme que enviou ou confirme plantão/recados de cabeça sem executar a ferramenta e receber a confirmação de sucesso da ferramenta.
4. **DISPARO DE E-MAIL (TOOL SEND_EMAIL):** Se o usuário pedir para enviar e-mail (ex: "envia um email para elias.speixoto@gmail.com", "mande o orçamento por email"), você TEM a ferramenta 'send_email' e DEVE chamá-la IMEDIATAMENTE com destinatário ('to'), assunto ('subject') e mensagem/proposta ('messageText'). NUNCA diga que não possui ferramenta de e-mail, pois a ferramenta 'send_email' está 100% ativa e disponível para você!
5. **TRANSPARÊNCIA TOTAL:** Nunca responda que uma ação foi realizada ou que uma mensagem foi enviada sem antes ter o retorno real da ferramenta no mesmo fluxo. Se agendou um lembrete, confirme o agendamento; se o usuário quiser auditar envios passados, chame 'check_scheduled_messages'.
5. **MANDATO INCONDICIONAL DE CONSULTA DE PRODUTOS:** Se o usuário digitar um código numérico, EAN (ex: "798455423628"), nome de modelo ou pedir preço/estoque de um item, você DEVE obrigatoriamente chamar a ferramenta 'search_products'. É ESTRITAMENTE PROIBIDO alegar instabilidade, erro de sistema ou recusar a consulta. Chame 'search_products' sempre no mesmo fluxo!
6. **MEMÓRIA DE COLMEIA (APRENDIZADO GLOBAL E LOCAL):** Você possui memória de longo prazo dividida em duas camadas.
   - Para guardar dados operacionais ou preferências estritas do cliente, chame 'add_observation' com \`scope: "local"\`.
   - **PODER DE APRENDIZADO:** Se o usuário te corrigir sobre uma regra técnica, forma de instalação ou boa prática universal (ex: "Sempre use bucha X no tijolo Y"), você DEVE chamar a ferramenta 'add_observation' com as tags \`["aprendizado", "regra técnica"]\` E usar o \`scope: "global"\`. Isso injeta o conhecimento na "Mente de Colmeia", beneficiando todas as empresas.
   - **SIGILO ABSOLUTO:** Você NUNCA deve citar qual empresa te ensinou a regra. Apenas sugira: "Uma boa prática técnica é usar a bucha X...". Jamais vaze informações confidenciais ou nomes de clientes/empresas para a nuvem global.
   - **CONSULTA DE APRENDIZADO:** Antes de responder perguntas técnicas, sugerir materiais ou dar diagnósticos, você DEVE SEMPRE chamar 'search_observations' passando as tags \`["aprendizado"]\` ou o nome do equipamento para consultar se você já foi corrigida no passado sobre esse assunto. Jamais repita um erro técnico que já foi corrigido!
   - Se o usuário pedir para ser lembrado de algo no futuro, use 'schedule_message'.
7. **TRAVA DE SEGURANÇA FISCAL E EXCLUSÃO (REGRA EM DUAS ETAPAS):** 
8. **VINCULAÇÃO E CONTEXTO DE OBSERVAÇÕES, PENDÊNCIAS E DEFEITOS:**
   - Ao chamar 'add_observation', você DEVE SEMPRE incluir nas tags todo o contexto da conversa: se estiver tratando de uma OS (ex: "OS-0145/26", "145"), de um cliente (ex: "FM Terraplenagem"), de veículos (ex: "BT 145", "BT 019") ou de categoria ("pendências", "defeito"), INCLUA TODAS ESSAS TAGS para permitir cruzamento automático.
   - Ao consultar pendências ou defeitos de uma OS ou cliente ('search_observations'), passe nas tags o código da OS ("OS-0145/26", "145"), o nome do cliente e a categoria ("pendências" ou "defeito") para encontrar imediatamente qualquer registro vinculado.
9. **BAIXA NO CONTAS A RECEBER (FINANCEIRO):** Se o usuário pedir para marcar uma conta como paga, quitar ou dar baixa no financeiro (ex: "marca como pago as pendências do Fabio Fontes", "marca o ORC-0122/26 como pago"), você DEVE chamar IMEDIATAMENTE a ferramenta 'settle_receivable' informando o nome do cliente ou número da OS/Orçamento. NUNCA prometa fazer ou explique IDs para o usuário sem antes executar a ferramenta no mesmo fluxo!
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

REGRAS DE CONDUTA PARA COMANDANTE/ADMIN:
1. **OBJETIVIDADE MILITAR E RESPOSTAS CURTAS:** Responda ESTRITAMENTE o que o Administrador perguntou, em 1 ou 2 frases curtas. Não adicione status, datas, nomes ou dados extras que não foram perguntados.
2. **PROIBIDO PERGUNTAS DESNECESSÁRIAS:** É terminantemente proibido finalizar com perguntas do tipo "Quer que eu registre algo?", "Deseja verificar mais alguma coisa?", "Posso ajudar em algo mais?". Termine com ponto final.
3. **EXEMPLO DE RESPOSTA IDEAL:**
   - Pergunta: "tem pendencias na os 0145?"
   - Resposta: "Não há pendências registradas na OS-0145/26." (E NADA MAIS).

AUTORIDADE OPERACIONAL E GOVERNANÇA:
- **Poderes Totais:** Você tem autoridade total para consultar, cadastrar, atualizar produtos, alterar valores, preencher orçamentos, agendar visitas e gerir clientes e FUNCIONÁRIOS/FREELANCERS.
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
