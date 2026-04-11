/**
 * Função principal: detecta boleto da Premier e repassa para a imobiliária.
 * Roda via trigger diário. Idempotente via Gmail labels.
 */
function repassarBoleto() {
  // Guard 1: contrato
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. repassarBoleto() abortado.');
    return;
  }

  const hoje    = new Date();
  const mesRef  = Utilities.formatDate(hoje, TIMEZONE, 'yyyy-MM');
  const labelNome = `${LABEL_BASE}-${mesRef}`;

  // Guard 2: idempotência
  if (GmailApp.getUserLabelByName(labelNome)) {
    Logger.log(`Boleto de ${mesRef} já repassado. Nenhuma ação.`);
    return;
  }

  // Busca
  const threads = buscarBoletoPremer(mesRef);   // gmail.js
  if (!threads.length) {
    Logger.log(`Boleto da Premier de ${mesRef} não encontrado ainda.`);
    return;
  }

  const thread = threads[0];
  const html   = thread.getMessages().pop().getBody();

  // PDF
  const linkPdf = extrairLinkBoleto(html);      // gmail.js
  const pdfBlob = baixarPdf(linkPdf);           // pdf.js

  // E-mail
  const { assunto, corpo } = montarEmailRepasse(mesRef);

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria para ${DESTINO_IMOBILIARIA}: "${assunto}"`);
    Logger.log(`[DRY_RUN] Corpo: ${corpo}`);
  } else {
    GmailApp.sendEmail(DESTINO_IMOBILIARIA, assunto, corpo, {
      attachments: [pdfBlob],
      name: 'Automação Condomínio'
    });
    Logger.log(`Boleto de ${mesRef} repassado com sucesso para ${DESTINO_IMOBILIARIA}`);

    // Aplica label apenas após envio confirmado
    const label = GmailApp.getUserLabelByName(labelNome)
      || GmailApp.createLabel(labelNome);
    label.addToThread(thread);
  }
}

/**
 * Monta assunto e corpo do e-mail de repasse com as competências corretas.
 * Condomínio do mês X é lançado no aluguel do mês X+1.
 * @param {string} mesRef - formato 'yyyy-MM'
 * @returns {{ assunto: string, corpo: string }}
 */
function montarEmailRepasse(mesRef) {
  const [ano, mes]    = mesRef.split('-').map(Number);
  const proxMes       = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const nomeMes       = nomeMesPortugues(mes);
  const nomeProxMes   = nomeMesPortugues(mes === 12 ? 1 : mes + 1);
  const anoProxMes    = mes === 12 ? ano + 1 : ano;

  const corpo = `A/C Mariana - Setor de Proprietários.

Segue boleto de condomínio com valor correto, referente à competência de ${nomeMes}/${ano}, para ser lançado no aluguel de ${nomeProxMes}/${anoProxMes}.

Atenciosamente.`;

  return { assunto: ASSUNTO_REPASSE, corpo };
}

/**
 * Instala os dois triggers de tempo. Executar manualmente UMA vez no GAS.
 */
function installTriggers() {
  // Remove triggers existentes para evitar duplicatas
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Trigger diário para repasse (janela: 6h–7h da manhã)
  ScriptApp.newTrigger('repassarBoleto')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  // Trigger diário para alerta (janela: 8h–9h da manhã)
  ScriptApp.newTrigger('verificarPendencia')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('Triggers instalados com sucesso.');
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(`  - ${t.getHandlerFunction()} (${t.getTriggerSource()})`);
  });
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
