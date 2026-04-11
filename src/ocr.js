/**
 * Extrai dados do boleto de condomínio a partir de um PDF via OCR.
 * Utiliza o serviço avançado Drive API para converter o PDF em Google Doc
 * temporário, lê o texto extraído e o apaga em seguida.
 *
 * Requer: serviço avançado "Drive API" habilitado no projeto GAS.
 */

/**
 * Extrai os dados relevantes do boleto PDF da Premier Garantidora.
 *
 * @param {GoogleAppsScript.Base.Blob} pdfBlob - Blob do arquivo PDF
 * @param {string} nomeArquivo - Nome descritivo do arquivo (usado em logs e alertas)
 * @returns {{ mesRef: string, valorId: string, vencimento: string, valor: string }}
 *   mesRef     — mês de referência no formato 'YYYY-MM'  (ex: '2026-04')
 *   valorId    — valor sem separadores                   (ex: '59372')
 *   vencimento — data de vencimento no formato DD/MM/AAAA (ex: '13/04/2026')
 *   valor      — valor com separadores originais          (ex: '593,72')
 * @throws {Error} se a identificação da Premier, vencimento ou valor não forem encontrados
 */
function extrairDadosBoleto(pdfBlob, nomeArquivo) {
  Logger.log(`[OCR] Iniciando extração para: ${nomeArquivo}`);

  const texto = _extrairTextoPdf(pdfBlob, nomeArquivo);

  Logger.log(`[OCR] Texto extraído (${texto.length} caracteres). Iniciando parsing.`);

  _validarIdentificacaoPremier(texto, nomeArquivo);

  const vencimento = _extrairVencimento(texto, nomeArquivo);
  const valor      = _extrairValor(texto, nomeArquivo);
  const mesRef     = _calcularMesRef(vencimento);
  const valorId    = valor.replace(/[.,]/g, '');

  Logger.log(`[OCR] Dados extraídos — mesRef: ${mesRef} | vencimento: ${vencimento} | valor: ${valor} | valorId: ${valorId}`);

  return { mesRef, valorId, vencimento, valor };
}

// ── Funções internas ─────────────────────────────────────────────

/**
 * Converte o PDF em Google Doc temporário via Drive API OCR e retorna o texto.
 * O Doc temporário é sempre apagado no finally, mesmo em caso de erro.
 *
 * @param {GoogleAppsScript.Base.Blob} pdfBlob
 * @param {string} nomeArquivo - usado somente em logs
 * @returns {string} texto extraído pelo OCR
 */
function _extrairTextoPdf(pdfBlob, nomeArquivo) {
  Logger.log(`[OCR] Criando Doc temporário via Drive API OCR para: ${nomeArquivo}`);

  const resource = {
    title: '_ocr_tmp_' + Date.now(),
    mimeType: 'application/vnd.google-apps.document'
  };

  let docId = null;

  try {
    const file = Drive_OCR.Files.insert(resource, pdfBlob, {
      ocr: true,
      ocrLanguage: 'pt'
    });

    docId = file.id;
    Logger.log(`[OCR] Doc temporário criado. ID: ${docId}`);

    const doc   = DocumentApp.openById(docId);
    const texto = doc.getBody().getText();

    Logger.log(`[OCR] Texto lido do Doc temporário. Tamanho: ${texto.length} caracteres.`);
    return texto;

  } finally {
    if (docId) {
      try {
        Drive_OCR.Files.remove(docId);
        Logger.log(`[OCR] Doc temporário removido. ID: ${docId}`);
      } catch (errRemocao) {
        Logger.log(`[OCR] AVISO: falha ao remover Doc temporário (ID: ${docId}): ${errRemocao.message}`);
      }
    }
  }
}

/**
 * Verifica se o texto contém a identificação da Premier Garantidora.
 * Lança erro (com alerta por e-mail) se não encontrar.
 *
 * @param {string} texto
 * @param {string} nomeArquivo
 */
function _validarIdentificacaoPremier(texto, nomeArquivo) {
  const rePremier     = /PREMIER\s+GARANTIDORA\s+DE\s+CREDITOS/i;
  const reCondominio  = /CONDOMINIO\s+RESIDENCIAL\s+VIDA\s+PLENA/i;

  if (!rePremier.test(texto)) {
    const motivo = 'Identificação "PREMIER GARANTIDORA DE CREDITOS" não encontrada no texto extraído pelo OCR.';
    Logger.log(`[OCR] ERRO — ${motivo}`);
    _enviarAlertaFalhaOcr(nomeArquivo, motivo);
    throw new Error(`[OCR] ${motivo} Arquivo: ${nomeArquivo}`);
  }

  Logger.log('[OCR] Identificação Premier confirmada.');

  if (!reCondominio.test(texto)) {
    Logger.log('[OCR] AVISO: identificação do condomínio "CONDOMINIO RESIDENCIAL VIDA PLENA" não encontrada. Prosseguindo.');
  } else {
    Logger.log('[OCR] Identificação do condomínio confirmada.');
  }
}

/**
 * Extrai a data de vencimento do texto OCR.
 * Lança erro (com alerta por e-mail) se não encontrar.
 *
 * @param {string} texto
 * @param {string} nomeArquivo
 * @returns {string} data no formato DD/MM/AAAA
 */
function _extrairVencimento(texto, nomeArquivo) {
  const re = /Vencimento[:\s]+([\d]{2}\/[\d]{2}\/[\d]{4})/i;
  const match = texto.match(re);

  if (!match) {
    const motivo = 'Campo "Vencimento" não encontrado ou em formato inesperado no texto extraído pelo OCR.';
    Logger.log(`[OCR] ERRO — ${motivo}`);
    _enviarAlertaFalhaOcr(nomeArquivo, motivo);
    throw new Error(`[OCR] ${motivo} Arquivo: ${nomeArquivo}`);
  }

  Logger.log(`[OCR] Vencimento extraído: ${match[1]}`);
  return match[1];
}

/**
 * Extrai o valor do boleto do texto OCR.
 * Lança erro (com alerta por e-mail) se não encontrar.
 *
 * @param {string} texto
 * @param {string} nomeArquivo
 * @returns {string} valor no formato original (ex: '593,72')
 */
function _extrairValor(texto, nomeArquivo) {
  const re = /Valor\s+do\s+documento\s*[\r\n]+([\d.,]+)/i;
  const match = texto.match(re);

  if (!match) {
    const motivo = 'Campo "Valor do documento" não encontrado ou em formato inesperado no texto extraído pelo OCR.';
    Logger.log(`[OCR] ERRO — ${motivo}`);
    _enviarAlertaFalhaOcr(nomeArquivo, motivo);
    throw new Error(`[OCR] ${motivo} Arquivo: ${nomeArquivo}`);
  }

  Logger.log(`[OCR] Valor extraído: ${match[1]}`);
  return match[1];
}

/**
 * Calcula o mês de referência a partir da data de vencimento.
 *
 * @param {string} vencimento - formato DD/MM/AAAA
 * @returns {string} formato YYYY-MM (ex: '2026-04')
 */
function _calcularMesRef(vencimento) {
  const partes = vencimento.split('/');   // ['13', '04', '2026']
  const mes    = partes[1];              // '04'
  const ano    = partes[2];              // '2026'
  return `${ano}-${mes}`;
}

/**
 * Envia alerta por e-mail ao usuário ativo informando falha no OCR.
 * O arquivo original NÃO é movido para lixeira — fica disponível para intervenção manual.
 *
 * @param {string} nomeArquivo - nome do arquivo que falhou
 * @param {string} motivo - descrição do problema encontrado
 */
function _enviarAlertaFalhaOcr(nomeArquivo, motivo) {
  try {
    const emailDono = Session.getActiveUser().getEmail();
    const assunto   = `⚠️ OCR falhou — ${nomeArquivo}`;
    const corpo     = `Atenção,

A extração de dados via OCR falhou para o arquivo abaixo e requer intervenção manual.

Arquivo : ${nomeArquivo}
Motivo  : ${motivo}

O arquivo NÃO foi removido ou movido para a lixeira. Acesse o Drive para verificá-lo manualmente e, se necessário, reencaminhe o boleto para a imobiliária.

Acesse script.google.com para consultar os logs completos da execução.

Atenciosamente,
Automação Condomínio`;

    GmailApp.sendEmail(emailDono, assunto, corpo);
    Logger.log(`[OCR] Alerta de falha enviado para ${emailDono}. Motivo: ${motivo}`);
  } catch (errAlerta) {
    Logger.log(`[OCR] AVISO: falha ao enviar alerta de OCR por e-mail: ${errAlerta.message}`);
  }
}
