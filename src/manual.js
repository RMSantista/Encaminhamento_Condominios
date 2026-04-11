/**
 * Verifica pasta manual do Drive: extrai dados via OCR, agrupa por boleto,
 * resolve duplicatas e envia um e-mail por boleto em ordem crescente de vencimento.
 * Roda via trigger diário (3× ao dia: 8h, 12h, 16h) nos dias definidos em
 * DIAS_VERIFICACAO_MANUAL.
 */
function verificarPastaManual() {
  // Guard: contrato
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. verificarPastaManual() abortado.');
    return;
  }

  const hoje = new Date();
  const dia  = Number(Utilities.formatDate(hoje, TIMEZONE, 'd'));

  if (!DIAS_VERIFICACAO_MANUAL.includes(dia)) {
    Logger.log(`Dia ${dia}: fora do período de verificação manual. Nenhuma ação.`);
    return;
  }

  // Listar PDFs na pasta (arquivos com extensão .pdf)
  const pasta    = DriveApp.getFolderById(PASTA_MANUAL_ID);
  const iterator = pasta.getFilesByType(MimeType.PDF);
  const arquivos = [];
  while (iterator.hasNext()) {
    arquivos.push(iterator.next());
  }

  if (!arquivos.length) {
    Logger.log('Pasta manual vazia. Nenhuma ação.');
    return;
  }

  Logger.log(`${arquivos.length} PDF(s) encontrado(s) na pasta manual.`);

  // Extrair dados via OCR para cada arquivo
  const boletos = [];
  for (const arquivo of arquivos) {
    try {
      const blob  = arquivo.getBlob().setName(arquivo.getName());
      const dados = extrairDadosBoleto(blob, arquivo.getName());
      boletos.push({ arquivo, ...dados });
      Logger.log(`OCR OK: "${arquivo.getName()}" → mesRef=${dados.mesRef} valorId=${dados.valorId}`);
    } catch (e) {
      // Alerta de OCR já enviado por ocr.js; arquivo permanece na pasta
      Logger.log(`OCR falhou para "${arquivo.getName()}": ${e.message}`);
      registrarLog({
        funcao:   'verificarPastaManual',
        arquivo:  arquivo.getName(),
        acao:     'ErrOCR',
        origem:   'P',
        detalhes: e.message
      });
    }
  }

  if (!boletos.length) {
    Logger.log('Nenhum boleto válido extraído via OCR.');
    return;
  }

  // Agrupar por (mesRef + valorId) — duplicatas totais ficam no mesmo grupo
  const grupos = _agruparPorBoleto(boletos);

  // Ordenar grupos por data de vencimento (ascendente)
  const gruposOrdenados = Object.values(grupos).sort((a, b) => {
    return _vencimentoParaMs(a.representante.vencimento)
         - _vencimentoParaMs(b.representante.vencimento);
  });

  // Processar cada grupo em ordem
  for (const grupo of gruposOrdenados) {
    _processarGrupo(grupo);
  }
}

// ── Funções internas ─────────────────────────────────────────────

/**
 * Agrupa boletos por (mesRef + valorId).
 * Boletos com mesma chave são duplicatas totais — mesmo boleto, múltiplas cópias.
 *
 * @param {Array} boletos
 * @returns {Object} mapa chave → { representante, todos }
 */
function _agruparPorBoleto(boletos) {
  const grupos = {};
  for (const boleto of boletos) {
    const chave = `${boleto.mesRef}-${boleto.valorId}`;
    if (!grupos[chave]) {
      grupos[chave] = { representante: boleto, todos: [boleto] };
    } else {
      grupos[chave].todos.push(boleto);
    }
  }
  return grupos;
}

/**
 * Envia e-mail para um grupo de boletos e move todos os arquivos para a lixeira.
 * Duplicatas totais → envia apenas o primeiro; exclui todos.
 *
 * @param {{ representante: Object, todos: Array }} grupo
 */
function _processarGrupo(grupo) {
  const { representante, todos } = grupo;
  const { mesRef, valorId }      = representante;
  const isDuplicata              = todos.length > 1;

  // Determinar tipo: Enc (primeiro envio) ou Reenc (label já existe)
  const prefixo = construirPrefixo(mesRef, valorId);
  const tipo    = labelExiste(prefixo) ? 'Reenc' : 'Enc';

  const labelNome          = construirLabel(mesRef, valorId, tipo, 'P');
  const { assunto, corpo } = montarEmailRepasse(mesRef);
  const nomePrincipal      = representante.arquivo.getName();

  Logger.log(`Processando grupo ${mesRef}-${valorId}: tipo=${tipo} | ${todos.length} arquivo(s)`);

  if (DRY_RUN) {
    const detalhe = `[DRY_RUN]${isDuplicata ? ` | ${todos.length} cópias` : ''}`;
    Logger.log(`[DRY_RUN] Enviaria "${nomePrincipal}" para ${DESTINO_IMOBILIARIA}`);
    Logger.log(`[DRY_RUN] Label: ${labelNome}`);
    registrarLog({
      funcao:   'verificarPastaManual',
      mesRef,
      valorId,
      arquivo:  nomePrincipal,
      acao:     tipo,
      origem:   'P',
      detalhes: detalhe
    });
    return;
  }

  // Envio real (apenas o representante como anexo)
  const pdfBlob = representante.arquivo.getBlob().setName(nomePrincipal);
  GmailApp.sendEmail(DESTINO_IMOBILIARIA, assunto, corpo, {
    attachments: [pdfBlob],
    name: 'Automação Condomínio'
  });
  Logger.log(`"${nomePrincipal}" repassado para ${DESTINO_IMOBILIARIA}`);

  // Label flutuante (sem thread — boleto veio do Drive, não de e-mail)
  GmailApp.createLabel(labelNome);
  Logger.log(`Label flutuante criado: ${labelNome}`);

  // Mover todos os arquivos do grupo para a lixeira
  const nomesDescartados = todos.map(b => {
    b.arquivo.setTrashed(true);
    Logger.log(`"${b.arquivo.getName()}" movido para a lixeira.`);
    return b.arquivo.getName();
  });

  const detalhe = isDuplicata
    ? `${todos.length} cópias descartadas: ${nomesDescartados.join(', ')}`
    : 'OK';

  registrarLog({
    funcao:   'verificarPastaManual',
    mesRef,
    valorId,
    arquivo:  nomePrincipal,
    acao:     tipo,
    origem:   'P',
    detalhes: detalhe
  });
}

/**
 * Converte data de vencimento DD/MM/YYYY para timestamp (ms) para ordenação.
 * @param {string} vencimento - formato DD/MM/YYYY
 * @returns {number}
 */
function _vencimentoParaMs(vencimento) {
  const [d, m, y] = vencimento.split('/');
  return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
}
