
/**
 * Dicionário de termos técnicos e correções comuns no domínio de segurança eletrônica.
 */
export const orthographyDictionary: Record<string, string> = {
  // Câmeras e CFTV
  'camera': 'câmera',
  'cameras': 'câmeras',
  'video': 'vídeo',
  'gravacao': 'gravação',
  'visualizacao': 'visualização',
  'monitoramento': 'monitoramento',
  'infravermelho': 'infravermelho',
  
  // Orçamentos e Serviços
  'orcamento': 'orçamento',
  'orcamentos': 'orçamentos',
  'instalacao': 'instalação',
  'instalaçao': 'instalação',
  'intalacao': 'instalação',
  'intalaçao': 'instalação',
  'intalação': 'instalação',
  'istalacao': 'instalação',
  'istalaçao': 'instalação',
  'istalação': 'instalação',
  'manutencao': 'manutenção',
  'manutençao': 'manutenção',
  'manutencoes': 'manutenções',
  'previsao': 'previsão',
  'distracao': 'distração',
  'distraçao': 'distração',

  'tecnico': 'técnico',
  'tecnicos': 'técnicos',
  'servico': 'serviço',
  'servicos': 'serviços',
  'execucao': 'execução',
  'finalizacao': 'finalização',
  
  // Equipamentos e Dispositivos
  'eletronica': 'eletrônica',
  'eletronico': 'eletrônico',
  'eletronicos': 'eletrônicos',
  'botoes': 'botões',
  'botao': 'botão',
  'configuracao': 'configuração',
  'configuracoes': 'configurações',
  'portao': 'portão',
  'portoes': 'portões',
  'fechadura': 'fechadura',
  'interfone': 'interfone',
  'alarme': 'alarme',
  'cerca': 'cerca',
  'concertina': 'concertina',
  'conector': 'conector',
  'conectores': 'conectores',
  'roteador': 'roteador',
  
  // Termos Gerais de Processo
  'atencao': 'atenção',
  'revisao': 'revisão',
  'aprovacao': 'aprovação',
  'pendencia': 'pendência',
  'relatorio': 'relatório',
  'endereco': 'endereço',
  'numero': 'número',
  'descricao': 'descrição',
  'situacao': 'situação',

  // Erros comuns e concordância
  'precisp': 'preciso',
  'precisi': 'preciso',
  'precisom': 'preciso',
  'preciso': 'preciso',
  'amaha': 'amanhã',
  'amanha': 'amanhã',
  'pra': 'para',
  'frese': 'frase',
  'freses': 'frases',
  'corija': 'corrija',
  'corija-me': 'corrija-me',



  // Siglas (Devem permanecer em maiúsculo)
  'dvr': 'DVR',
  'nvr': 'NVR',
  'cftv': 'CFTV',
  'hd': 'HD',
  'ip': 'IP',
  'wifi': 'Wi-Fi',
  'pwa': 'PWA',
};

/**
 * Corrige pontuação básica e espaçamentos.
 */
export function fixPunctuation(text: string): string {
  if (!text) return '';
  
  let fixed = text;

  // 1. Remover espaços duplos
  fixed = fixed.replace(/\s+/g, ' ');

  // 2. Corrigir espaços antes de pontuação (ex: "ola , mundo" -> "ola, mundo")
  fixed = fixed.replace(/\s+([,.!?;:])/g, '$1');

  // 3. Garantir espaço após pontuação (ex: "ola,mundo" -> "ola, mundo")
  // Mas ignorar números (ex: 12,5)
  fixed = fixed.replace(/([,.!?;:])(?=[^\s\d])/g, '$1 ');

  // 4. Remover regra de ponto final automático que afetava buscas
  // (Removido para garantir integridade em nomes e termos de busca)

  return fixed;
}

/**
 * Sugestões comuns para autocompletar termos técnicos.
 */
export const commonSuggestions: string[] = [
  'Câmera Intelbras',
  'Câmera Dome',
  'Câmera Bullet',
  'DVR 4 Canais',
  'DVR 8 Canais',
  'DVR 16 Canais',
  'Manutenção de Cerca Elétrica',
  'Instalação de Câmeras',
  'Orçamento de Segurança',
  'Configuração de Acesso Remoto',
  'Troca de Bateria 12V',
  'Central de Choque Genno',
  'Sensor de Presença',
  'Fechadura Eletrônica',
  'Cabo de Rede Cat5e',
  'Conector BNC',
  'Fonte de Alimentação 12V',
];

/**
 * Corrige uma palavra individual se ela estiver no dicionário, preservando a capitalização.
 */
export function correctWord(word: string): string {
  const normalized = word.toLowerCase();
  const correction = orthographyDictionary[normalized];
  
  if (!correction) return word;

  // Preservar capitalização
  if (word === word.toUpperCase()) return correction.toUpperCase();
  if (word[0] === word[0].toUpperCase()) {
    return correction.charAt(0).toUpperCase() + correction.slice(1);
  }
  
  return correction;
}

/**
 * Corrige todo o texto, palavra por palavra, e aplica regras de capitalização (Sentence Case).
 */
export function correctFullText(text: string): string {
  if (!text) return '';
  
  // 1. Corrigir palavras pelo dicionário preservando a capitalização original
  // Não convertemos o texto todo para minúsculo para preservar nomes próprios (ex: Elias Silva)
  let corrected = text.replace(/(\w+)/g, (match) => {
    return correctWord(match);
  });

  // 3. Corrigir pontuação e espaçamentos localmente
  corrected = fixPunctuation(corrected);

  // 4. Regra de iniciar com maiúscula (no início do texto)
  corrected = corrected.replace(/^(\s*)(\w)/, (match, prefix, firstChar) => {
    return prefix + firstChar.toUpperCase();
  });

  // 5. Regra de iniciar com maiúscula após pontuação (. ! ?)
  corrected = corrected.replace(/([.!?]\s+)(\w)/g, (match, punctuation, nextChar) => {
    return punctuation + nextChar.toUpperCase();
  });

  return corrected;
}



