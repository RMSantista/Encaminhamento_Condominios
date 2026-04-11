/**
 * Baixa o PDF do boleto a partir de uma URL direta.
 * @param {string} url - URL do PDF
 * @returns {GoogleAppsScript.Base.Blob} Blob do PDF
 * @throws {Error} se o HTTP não retornar 200
 */
function baixarPdf(url) {
  Logger.log(`Baixando PDF: ${url}`);

  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const codigo   = response.getResponseCode();

  if (codigo !== 200) {
    throw new Error(`Falha ao baixar PDF. URL: ${url} | HTTP: ${codigo}`);
  }

  const blob = response.getBlob().setName('boleto_condominio.pdf');
  Logger.log(`PDF baixado com sucesso. Tamanho: ${blob.getBytes().length} bytes`);
  return blob;
}
