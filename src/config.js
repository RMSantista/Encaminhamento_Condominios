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
const DESTINO_IMOBILIARIA = 'administrativo@piramidimoveis.com.br';
const ASSUNTO_REPASSE     = 'Ajuste de Condomínio';

// ── Gmail labels ────────────────────────────────────────────────
const LABEL_BASE = 'Condominio/Repassado';  // prefixo; mês é concatenado dinamicamente

// ── Comportamento ───────────────────────────────────────────────
const TIMEZONE  = 'America/Sao_Paulo';
const DRY_RUN   = false;  // true = executa tudo mas NÃO envia e-mail (para testes)

// ── Dias de verificação de pendência ────────────────────────────
const DIAS_VERIFICACAO = [8, 9, 10];  // verificarPendencia() age nesses dias
