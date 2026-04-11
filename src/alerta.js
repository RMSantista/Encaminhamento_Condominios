/**
 * Guarda: verifica se o boleto foi repassado nos dias 8, 9 e 10 do mês.
 * Se não foi, envia alerta ao dono da conta. Roda via trigger diário.
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

  // Checa se o repasse já foi feito
  const labelNome = `${LABEL_BASE}-${mesRef}`;
  if (GmailApp.getUserLabelByName(labelNome)) {
    Logger.log(`Repasse de ${mesRef} confirmado. Nenhum alerta necessário.`);
    return;
  }

  // Alerta
  const emailDono = Session.getActiveUser().getEmail();
  const [ano, mes] = mesRef.split('-');
  const assunto   = `⚠️ Boleto Premier não recebido — ${mesRef}`;
  const corpo     = `Atenção,

Hoje é dia ${dia}/${mes}/${ano} e o boleto de condomínio da Premier Garantidora referente a ${mesRef} ainda não foi repassado para a Pirâmid Imóveis.

Possíveis causas:
- A Premier cobrou via DDA mas não enviou o e-mail
- O e-mail chegou com assunto diferente do esperado (verifique a caixa de entrada)

Acesse script.google.com para verificar os logs da automação.

Atenciosamente,
Automação Condomínio`;

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria alerta para ${emailDono}: "${assunto}"`);
  } else {
    GmailApp.sendEmail(emailDono, assunto, corpo);
    Logger.log(`Alerta enviado para ${emailDono} — boleto de ${mesRef} pendente no dia ${dia}`);
  }
}
