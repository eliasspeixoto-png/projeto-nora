import { Company, Client, Quote } from "@/lib/data";

export function processContractTemplate(template: string, company: Company, client: Client, quote: Quote): string {
    if (!template) return '';
    let result = template;
    
    // Format the items table for the contract
    const itemsTable = quote.items.map(item => `${item.quantity}x ${item.product.description}`).join('\n');
    
    const address = `${company.street || ''}, ${company.number || ''} - ${company.city || ''}/${company.state || ''}`;
    
    const replacements: Record<string, string> = {
        '{{companyName}}': company.name || '',
        '{{companyCnpj}}': company.cnpj || '',
        '[COMPANY_NAME]': company.name || '',
        '[COMPANY_CNPJ]': company.cnpj || '',
        '[COMPANY_ADDRESS]': address,
        '{{clientName}}': client.name || '',
        '{{clientDocument}}': client.document || '',
        '{{clientAddress}}': `${client.street || ''}, ${client.number || ''} - ${client.city || ''}/${client.state || ''}`,
        '[CLIENT_NAME]': client.name || '',
        '[CLIENT_DOCUMENT]': client.document || '',
        '[CLIENT_ADDRESS]': `${client.street || ''}, ${client.number || ''} - ${client.city || ''}/${client.state || ''}`,
        '{{monthlyFee}}': (quote.comodatoMonthlyFee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        '{{installationFee}}': (quote.installationFee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        '[MONTHLY_FEE]': (quote.comodatoMonthlyFee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        '[INSTALLATION_FEE]': (quote.installationFee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        '{{equipmentList}}': itemsTable,
        '[EQUIPMENT_LIST]': itemsTable,
        '{{date}}': new Date().toLocaleDateString('pt-BR'),
        '[DATE]': new Date().toLocaleDateString('pt-BR'),
        '[QUOTE_NUMBER]': quote.quoteNumber || '',
    };

    for (const [key, value] of Object.entries(replacements)) {
        result = result.split(key).join(value);
    }
    
    return result;
}