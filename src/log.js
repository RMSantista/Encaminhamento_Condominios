// ═══════════════════════════════════════════════════════════════
//  LOG — registra ações em planilha Google Sheets na pasta Drive
// ═══════════════════════════════════════════════════════════════

const _LOG_SPREADSHEET_ID_KEY = 'LOG_SPREADSHEET_ID';

const _LOG_CABECALHO = [
  'Timestamp',
  'Função',
  'MesRef',
  'ValorId',
  'Arquivo',
  'Ação',
  'Origem',
  'Detalhes',
];

// ── Obter (ou criar) a planilha de log ──────────────────────────

/**
 * Retorna a planilha de log, criando-a se necessário.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function _obterPlanilhaLog() {
  const props = PropertiesService.getScriptProperties();
  const idSalvo = props.getProperty(_LOG_SPREADSHEET_ID_KEY);

  if (idSalvo) {
    try {
      const planilha = SpreadsheetApp.openById(idSalvo);
      return planilha;
    } catch (e) {
      Logger.log(
        '[log] Planilha de log com ID "%s" não pôde ser aberta (%s). Recriando.',
        idSalvo,
        e.message
      );
    }
  }

  return _criarPlanilhaLog(props);
}

/**
 * Cria a planilha de log, move para a pasta correta e persiste o ID.
 * @param {GoogleAppsScript.Properties.Properties} props
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function _criarPlanilhaLog(props) {
  Logger.log('[log] Criando planilha de log "%s".', LOG_PLANILHA_NOME);

  const planilha = SpreadsheetApp.create(LOG_PLANILHA_NOME);

  // Mover do root para a pasta dos boletos manuais
  const file = DriveApp.getFileById(planilha.getId());
  DriveApp.getFolderById(PASTA_MANUAL_ID).addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  Logger.log(
    '[log] Planilha de log criada com ID "%s" e movida para a pasta "%s".',
    planilha.getId(),
    PASTA_MANUAL_ID
  );

  // Configurar cabeçalho na primeira aba
  const aba = planilha.getActiveSheet();
  aba.setName('Log');
  aba.appendRow(_LOG_CABECALHO);
  aba.setFrozenRows(1);

  // Persistir ID para reutilização futura
  props.setProperty(_LOG_SPREADSHEET_ID_KEY, planilha.getId());

  return planilha;
}

// ── API pública ─────────────────────────────────────────────────

/**
 * Registra uma linha de log na planilha.
 *
 * @param {Object}  params
 * @param {string} [params.funcao]    - Nome da função que gerou o evento
 * @param {string} [params.mesRef]    - Mês de referência (ex: '2026-04')
 * @param {string} [params.valorId]   - ID/valor do boleto (ex: '59372')
 * @param {string} [params.arquivo]   - Nome do arquivo PDF
 * @param {string} [params.acao]      - Ação realizada: Enc / Reenc / Skip / Alerta / ErrOCR
 * @param {string} [params.origem]    - Origem do boleto: 'E' (e-mail) / 'P' (pasta manual)
 * @param {string} [params.detalhes]  - Mensagem livre com resultado ou erro
 */
function registrarLog({ funcao, mesRef, valorId, arquivo, acao, origem, detalhes } = {}) {
  const vazio = '—';
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  const linha = [
    timestamp,
    funcao   || vazio,
    mesRef   || vazio,
    valorId  || vazio,
    arquivo  || vazio,
    acao     || vazio,
    origem   || vazio,
    detalhes || vazio,
  ];

  try {
    const planilha = _obterPlanilhaLog();
    planilha.getActiveSheet().appendRow(linha);
  } catch (e) {
    // Nunca deixar falha no log interromper o fluxo principal
    Logger.log('[log] Erro ao registrar log: %s', e.message);
  }
}
