
'use server';

import type { Quote, Client, Company as AppCompany } from "@/lib/data";

async function focusNFeApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    apiKey: string,
    baseUrl: string,
    body?: any
): Promise<{ success: boolean; data?: any; error?: string; debugPayload?: object }> {
    
    const url = `${baseUrl}${endpoint}`;
    
    try {
        const encodedApiKey = btoa(`${apiKey}:`);
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Authorization': `Basic ${encodedApiKey}`,
        };
        const options: RequestInit = { method, headers, cache: 'no-store' };

        if (body) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
        if (response.status === 204) return { success: true };

        const responseText = await response.text();
        let responseBody;
        try {
            responseBody = JSON.parse(responseText);
        } catch (e) {
            if (response.status === 401) return { success: false, error: `Acesso Negado (401). Verifique se o token de API está correto e corresponde ao ambiente.` };
            if (response.status >= 500) return { success: false, error: `Erro no servidor da Focus NFe (Status ${response.status}). Tente novamente mais tarde.` };
            return { success: false, error: `A resposta da API não é um JSON válido. Status: ${response.status}. Resposta: ${responseText || '(vazia)'}` };
        }

        if (!response.ok) {
            const errorMessages = responseBody.erros ? 
              Object.values(responseBody.erros).map((err: any) => err.mensagem || JSON.stringify(err)).join(' ') :
              (responseBody.mensagem || (responseBody.erros_autorizacao && responseBody.erros_autorizacao.map((err: any) => err.mensagem).join(' ')));
            const finalMessage = `${errorMessages || 'Erro desconhecido da API.'}` + (responseBody.ref ? ` (ref: ${responseBody.ref})` : '');
            return { success: false, error: finalMessage, data: responseBody, debugPayload: body };
        }

        return { success: true, data: responseBody };

    } catch (error: any) {
        return { success: false, error: "Falha na comunicação com a API da FocusNFe. Verifique a conexão e a URL.", debugPayload: body };
    }
}


export async function issueNfse(os: Quote, client: Client, company: AppCompany, serviceCodeParam?: string, codTributarioParam?: string) {
    if (!company || !company.cnpj) {
        return { success: false, error: 'Dados da empresa (especialmente CNPJ) não encontrados ou inválidos.' };
    }

    let environment = company.focusNfeEnvironment || 'homologacao';
    
    // Fallback to homologation if production token is missing
    if (environment === 'producao' && !company.focusNfeProductionToken) {
        console.warn("Token de produção não encontrado. Voltando para homologação.");
        environment = 'homologacao';
    }

    const apiKey = environment === 'producao' ? company.focusNfeProductionToken : company.focusNfeHomologationToken;
    const baseUrl = environment === 'producao' 
        ? company.focusNfeProductionUrl || 'https://api.focusnfe.com.br'
        : company.focusNfeHomologationUrl || 'https://homologacao.focusnfe.com.br';

    if (!apiKey) {
        return { success: false, error: `Token da Focus NFe para ambiente de ${environment} não configurado.` };
    }
    
    const ref = company.cnpj.replace(/\D/g, '');
    
    const serviceItemsDescription = os.items.map(item => `${item.quantity}x ${item.product.description}`).join('; ');
    let fullDescription = `Serviços de instalação e manutenção conforme O.S. ${os.quoteNumber.replace('ORC', 'O.S')}: ${serviceItemsDescription}`;
    if (os.notes) {
        fullDescription += `\n\nRELATÓRIO DE EXECUÇÃO:\n${os.notes}`;
    }
    
    const tomadorPayload: any = {
        razao_social: os.clientName,
        email: client.email,
        endereco: {
            logradouro: client.street,
            numero: client.number,
            bairro: client.neighborhood,
            codigo_municipio: client.codigo_municipio || company.codigo_municipio || "2800308",
            uf: client.state,
            cep: client.cep?.replace(/\D/g, ''),
        }
    };

    const clientDoc = client.document?.replace(/\D/g, '');
    if (clientDoc && clientDoc.length === 11) tomadorPayload.cpf = clientDoc;
    else if (clientDoc && clientDoc.length === 14) tomadorPayload.cnpj = clientDoc;
    
    const itemLista = serviceCodeParam || '14.06';

    const nfePayload: any = {
        data_emissao: new Date().toISOString(),
        natureza_operacao: "1",
        optante_simples_nacional: company.regime_tributario === "1",
        incentivador_cultural: false,
        regime_especial_tributacao: company.regime_tributario === "1" ? "6" : undefined,
        prestador: {
            cnpj: company.cnpj.replace(/\D/g, ''),
            inscricao_municipal: company.inscricao_municipal,
            codigo_municipio: company.codigo_municipio || "2800308",
        },
        tomador: tomadorPayload,
        servico: {
            aliquota: company.aliq_pis ?? 5.00,
            valor_servicos: os.total.toFixed(2),
            iss_retido: false,
            item_lista_servico: itemLista,
            codigo_cnae: (company.codigo_cnae || '4321500').replace(/\D/g, ''),
            discriminacao: fullDescription,
            codigo_municipio: company.codigo_municipio || "2800308",
        }
    };

     if (codTributarioParam) {
        nfePayload.servico.codigo_tributario_municipio = codTributarioParam;
    }
    
    const result = await focusNFeApiRequest(`/v2/nfse?ref=${ref}`, 'POST', apiKey, baseUrl, nfePayload);
    
    if (!result.success) {
      return { 
        success: false, 
        error: result.error,
        debugPayload: nfePayload
      };
    }

    return result;
}

export async function handleFocusNFeAction(action: 'cancel' | 'pdf' | 'xml' | 'email', invoiceRef: string, apiKey: string, baseUrl: string) {
    let endpoint = `/v2/nfse/${invoiceRef}`;
    let method: 'DELETE' | 'GET' | 'POST' = 'GET';
    let body;

    if (action === 'cancel') {
        method = 'DELETE';
        body = { justificativa: "Cancelamento a pedido do cliente" };
    } else if (action === 'email') {
        method = 'POST';
        endpoint += '/email';
    } else if (action === 'pdf' || action === 'xml') {
        const result = await focusNFeApiRequest(endpoint, 'GET', apiKey, baseUrl);
        if (result.success && result.data) {
            let url: string | undefined;
            if (action === 'pdf' && result.data.url_danfse) url = result.data.url_danfse;
            else if (action === 'xml' && result.data.caminho_xml_nota_fiscal) url = `${baseUrl}${result.data.caminho_xml_nota_fiscal}`;
            if (url) return { success: true, data: { url } };
        }
        return { success: false, error: result.error || `URL do ${action.toUpperCase()} não encontrada.` };
    } else {
        return { success: false, error: 'Ação desconhecida.' };
    }
    
    const result = await focusNFeApiRequest(endpoint, method, apiKey, baseUrl, body);
    return result;
}
