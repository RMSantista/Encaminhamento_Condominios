/**
 * Verifica se o boleto foi repassado nos dias 8, 9 e 10 do mês.
 * Nos dias 8 e 9 apenas registra silenciosamente.
 * Só envia alerta ao dono da conta ao meio-dia do dia DIA_ALERTA (10),
 * caso o boleto ainda não tenha chegado. Roda via trigger diário às 12h.
 */
function verificarPendencia() {
  // Guard: contrato
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. verificarPendencia() abortado.');
    return;
  }

  const hoje   = new Date();
  const dia    = Number(Utilities.formatDate(hoje, TIMEZONE, 'd'));
  const mesRef = Utilities.formatDate(hoje, TIMEZONE, 'yyyy-MM');

  // Só age nos dias configurados
  if (!DIAS_VERIFICACAO.includes(dia)) {
    Logger.log(`Dia ${dia}: fora do período de verificação. Nenhuma ação.`);
    return;
  }

  // Checa se houve qualquer repasse no mês (via E ou P, qualquer valorId)
  const prefixoMes = `${LABEL_PREFIXO}_${mesRef}`;
  if (labelExiste(prefixoMes)) {
    Logger.log(`Dia ${dia}: repasse de ${mesRef} confirmado. Nenhum alerta necessário.`);
    return;
  }

  // Dias 8 e 9: apenas registra — Premier ainda pode enviar antes do prazo
  if (dia < DIA_ALERTA) {
    Logger.log(`Dia ${dia}: boleto de ${mesRef} ainda não recebido. Aguardando até o meio-dia do dia ${DIA_ALERTA}.`);
    return;
  }

  // Dia 10 ao meio-dia sem boleto — dispara alerta
  const emailDono  = Session.getActiveUser().getEmail();
  const [ano, mes] = mesRef.split('-');
  const assunto    = `⚠️ Boleto Premier não recebido — ${mesRef}`;
  const corpo      = `Atenção,

Hoje é meio-dia do dia ${dia}/${mes}/${ano} e o boleto de condomínio da Premier Garantidora referente a ${mesRef} ainda não foi recebido nem repassado para a Pirâmid Imóveis.

Possíveis causas:
- A Premier cobrou via DDA mas não enviou o e-mail
- O e-mail chegou com assunto diferente do esperado (verifique a caixa de entrada)
- O boleto pode ter sido enviado via WhatsApp — verifique e coloque na pasta do Drive

Acesse script.google.com para verificar os logs da automação.

Atenciosamente,
Automação Condomínio`;

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria alerta para ${emailDono}: "${assunto}"`);
  } else {
    GmailApp.sendEmail(emailDono, assunto, corpo);
    Logger.log(`Alerta enviado para ${emailDono} — boleto de ${mesRef} não recebido até o meio-dia do dia ${dia}`);
  }
}
