// ═══════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DO PROJETO — altere aqui, nunca nos outros arquivos
// ═══════════════════════════════════════════════════════════════

// ── Contrato ────────────────────────────────────────────────────
const CONTRATO_FIM = '2027-12-31';   // formato YYYY-MM-DD
                                      // Alterar quando o contrato for renovado

// ── Premier Garantidora (remetente) ─────────────────────────────
const REMETENTE_PREMIER = 'boleto@premiergarantidora.com.br';
const ASSUNTO_PREMIER   = 'CONDOMINIO RESIDENCIAL VIDA PLENA vencerá';
                          // trecho do assunto (busca parcial)

// ── Pirâmid Imóveis (destinatário) ──────────────────────────────
const DESTINO_IMOBILIARIA = 'testes.trabalhoestudo@gmail.com';
const ASSUNTO_REPASSE     = 'Ajuste de Condomínio';

// ── Gmail labels ────────────────────────────────────────────────
// Formato: Condomínio_{mesRef}-{valorId}_{Enc|Reenc}_em_{YYYY-MM-DD}_{E|P}
const LABEL_PREFIXO = 'Condomínio';

// ── Comportamento ───────────────────────────────────────────────
const TIMEZONE  = 'America/Sao_Paulo';
const DRY_RUN   = false;  // true = executa tudo mas NÃO envia e-mail (para testes)

// ── Dias de verificação de pendência ────────────────────────────
const DIAS_VERIFICACAO = [8, 9, 10];  // verificarPendencia() verifica nesses dias
const DIA_ALERTA       = 10;          // alerta só é enviado a partir deste dia (ao meio-dia)

// ── Fluxo manual (boleto via WhatsApp → pasta Drive) ────────────
// ID obtido da URL ao abrir a pasta no Drive: drive.google.com/drive/folders/{ID}
const PASTA_MANUAL_ID         = '1-LITJk2RHnlXPwrMy_XwhsLFzTZjqVRu';
const DIAS_VERIFICACAO_MANUAL = [10, 11, 12, 13];

// ── Log ──────────────────────────────────────────────────────────
const LOG_PLANILHA_NOME = 'Log_Condominio_Automacao';
