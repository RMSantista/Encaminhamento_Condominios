/**
 * Busca threads da Premier no Gmail para o mês de referência.
 * @param {string} mesRef - formato 'yyyy-MM'
 * @returns {GoogleAppsScript.Gmail.GmailThread[]}
 */
function buscarBoletoPremer(mesRef) {
  const [ano, mes] = mesRef.split('-').map(Number);
  const depois = Utilities.formatDate(new Date(ano, mes - 1, 1), TIMEZONE, 'yyyy/MM/dd');
  const antes  = Utilities.formatDate(new Date(ano, mes, 1),     TIMEZONE, 'yyyy/MM/dd');

  const query = `from:${REMETENTE_PREMIER} subject:"${ASSUNTO_PREMIER}" after:${depois} before:${antes}`;
  Logger.log(`Buscando threads: ${query}`);

  return GmailApp.search(query);
}

/**
 * Extrai o link direto do PDF do boleto a partir do HTML do e-mail.
 * @param {string} html - HTML bruto da mensagem
 * @returns {string} URL do PDF
 * @throws {Error} se nenhum link for encontrado
 */
function extrairLinkBoleto(html) {
  // Tenta link terminando em .pdf
  let match = html.match(/href="(https?:\/\/[^"]+\.pdf[^"]*)"/i);

  // Fallback: link com texto âncora "Visualizar Boleto"
  if (!match) {
    match = html.match(/href="(https?:\/\/[^"]+)"[^>]*>\s*Visualizar Boleto/i);
  }

  if (!match || !match[1]) {
    throw new Error('Link do PDF não encontrado no e-mail da Premier.');
  }

  Logger.log(`Link do PDF extraído: ${match[1]}`);
  return match[1];
}
