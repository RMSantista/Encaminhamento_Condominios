/**
 * Função principal: itera de REPASSE_MES_INICIO até o mês atual e repassa o
 * boleto da Premier para cada mês ainda não processado. Roda via trigger diário.
 * Idempotente via Gmail labels.
 */
function repassarBoleto() {
  // Guard: contrato
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. repassarBoleto() abortado.');
    return;
  }

  const mesAtual    = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  const todosMeses  = _gerarListaMeses(REPASSE_MES_INICIO, mesAtual);

  // Filtra meses sem nenhum label (nem E nem P)
  const mesesPendentes = todosMeses.filter(
    mes => !labelExiste(`${LABEL_PREFIXO}_${mes}-`)
  );

  if (!mesesPendentes.length) {
    Logger.log('repassarBoleto: todos os meses já processados.');
    return;
  }

  Logger.log(`repassarBoleto: ${mesesPendentes.length} mês(es) pendente(s): ${mesesPendentes.join(', ')}`);

  for (const mes of mesesPendentes) {
    _repassarMes(mes);
  }
}

/**
 * Processa o repasse de um único mês.
 * Busca o e-mail da Premier, extrai o PDF via OCR, verifica idempotência
 * pelo valorId e envia para a imobiliária.
 *
 * @param {string} mesRef - formato 'yyyy-MM'
 */
function _repassarMes(mesRef) {
  Logger.log(`_repassarMes: processando ${mesRef}`);

  const threads = buscarBoletoPremer(mesRef);
  if (!threads.length) {
    Logger.log(`_repassarMes: boleto da Premier de ${mesRef} não encontrado ainda.`);
    return;
  }

  const thread  = threads[0];
  const html    = thread.getMessages().pop().getBody();
  const linkPdf = extrairLinkBoleto(html);
  const pdfBlob = baixarPdf(linkPdf);

  // OCR: extrai mesRef e valorId reais do boleto
  let dados;
  try {
    dados = extrairDadosBoleto(pdfBlob, `e-mail Premier ${mesRef}`);
  } catch (e) {
    Logger.log(`_repassarMes: erro OCR — ${e.message}`);
    registrarLog({ funcao: 'repassarBoleto', mesRef, acao: 'ErrOCR', origem: 'E', detalhes: e.message });
    return;
  }

  // Guard: idempotência — prefixo cobre _E e _P do mesmo boleto
  const prefixo = construirPrefixo(dados.mesRef, dados.valorId);
  if (labelExiste(prefixo)) {
    Logger.log(`Boleto ${dados.mesRef} (valorId: ${dados.valorId}) já repassado. Nenhuma ação.`);
    registrarLog({ funcao: 'repassarBoleto', mesRef: dados.mesRef, valorId: dados.valorId, acao: 'Skip', origem: 'E', detalhes: 'Label já existe (E ou P)' });
    return;
  }

  const labelNome          = construirLabel(dados.mesRef, dados.valorId, 'Enc', 'E');
  const { assunto, corpo } = montarEmailRepasse(dados.mesRef);

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria para ${DESTINO_IMOBILIARIA}: "${assunto}"`);
    Logger.log(`[DRY_RUN] Label que seria criado: ${labelNome}`);
    registrarLog({ funcao: 'repassarBoleto', mesRef: dados.mesRef, valorId: dados.valorId, acao: 'Enc', origem: 'E', detalhes: '[DRY_RUN]' });
  } else {
    GmailApp.sendEmail(DESTINO_IMOBILIARIA, assunto, corpo, {
      attachments: [pdfBlob],
      name: 'Automação Condomínio'
    });
    Logger.log(`Boleto ${dados.mesRef} repassado para ${DESTINO_IMOBILIARIA}`);

    // Label aplicado à thread da Premier após envio confirmado
    const label = GmailApp.createLabel(labelNome);
    label.addToThread(thread);
    Logger.log(`Label criado na thread: ${labelNome}`);
    registrarLog({ funcao: 'repassarBoleto', mesRef: dados.mesRef, valorId: dados.valorId, acao: 'Enc', origem: 'E', detalhes: 'OK' });
  }
}

/**
 * Gera lista de meses 'yyyy-MM' de inicio até fim (inclusive).
 *
 * @param {string} inicio - formato 'yyyy-MM'
 * @param {string} fim    - formato 'yyyy-MM'
 * @returns {string[]}
 */
function _gerarListaMeses(inicio, fim) {
  const meses = [];
  let [ano, mes] = inicio.split('-').map(Number);
  const [anoFim, mesFim] = fim.split('-').map(Number);

  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    meses.push(`${ano}-${String(mes).padStart(2, '0')}`);
    if (++mes > 12) { mes = 1; ano++; }
  }

  return meses;
}

/**
 * Monta assunto e corpo do e-mail de repasse com as competências corretas.
 * Condomínio do mês X é lançado no aluguel do mês X+1.
 * @param {string} mesRef - formato 'yyyy-MM'
 * @returns {{ assunto: string, corpo: string }}
 */
function montarEmailRepasse(mesRef) {
  const [ano, mes]   = mesRef.split('-').map(Number);
  const nomeMes      = nomeMesPortugues(mes);
  const nomeProxMes  = nomeMesPortugues(mes === 12 ? 1 : mes + 1);
  const anoProxMes   = mes === 12 ? ano + 1 : ano;

  const corpo = `A/C Mariana - Setor de Proprietários.

Segue boleto de condomínio com valor correto, referente à competência de ${nomeMes}/${ano}, para ser lançado no aluguel de ${nomeProxMes}/${anoProxMes}.

Atenciosamente.`;

  return { assunto: ASSUNTO_REPASSE, corpo };
}

/**
 * Instala os triggers de tempo. Executar manualmente UMA vez no GAS.
 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // T1 — repasse via e-mail diário (16h–17h)
  ScriptApp.newTrigger('repassarBoleto')
    .timeBased().everyDays(1).atHour(16).create();

  // T2 — verificação de pendência diária ao meio-dia (alerta só no dia 10)
  ScriptApp.newTrigger('verificarPendencia')
    .timeBased().everyDays(1).atHour(12).create();

  // T3/T4/T5 — verificação da pasta manual (dias 10-13, 3× ao dia)
  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(8).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(12).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(16).create();

  Logger.log('Triggers instalados: 5');
  ScriptApp.getProjectTriggers().forEach(t =>
    Logger.log(`  - ${t.getHandlerFunction()} (${t.getTriggerSource()})`)
  );
}

// ── Helpers de label (escopo global GAS — usados por manual.js e alerta.js) ──

/**
 * Constrói o nome completo do label.
 * Formato: {LABEL_PREFIXO}_{mesRef}-{valorId}_{tipo}_em_{YYYY-MM-DD}_{origem}
 * Exemplo: Condomínio_2026-04-59372_Enc_em_2026-04-10_E
 */
function construirLabel(mesRef, valorId, tipo, origem) {
  const hoje = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  return `${LABEL_PREFIXO}_${mesRef}-${valorId}_${tipo}_em_${hoje}_${origem}`;
}

/**
 * Constrói o prefixo de busca para idempotência.
 * Cobre _E e _P do mesmo boleto (mesmo mesRef + valorId).
 * Exemplo: Condomínio_2026-04-59372
 */
function construirPrefixo(mesRef, valorId) {
  return `${LABEL_PREFIXO}_${mesRef}-${valorId}`;
}

/**
 * Verifica se existe algum label com o prefixo dado.
 * @param {string} prefixo
 * @returns {boolean}
 */
function labelExiste(prefixo) {
  return GmailApp.getUserLabels().some(l => l.getName().startsWith(prefixo));
}

// ── Utilitário ──────────────────────────────────────────────────

/**
 * @param {number} mes - 1 a 12
 * @returns {string}
 */
function nomeMesPortugues(mes) {
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return nomes[mes - 1];
}
