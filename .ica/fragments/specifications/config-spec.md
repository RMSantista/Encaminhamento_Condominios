---
id: config-spec
type: specification
title: "Parâmetros de configuração — config.js"
status: active
tags: [config, constantes, parametros, contrato, hardcode]
depends_on: []
---

## Regra absoluta

**Nenhuma string de negócio pode aparecer fora de `config.js`.**
Qualquer valor que mude se o contrato, a imobiliária ou a seguradora mudar
deve estar aqui. Outros arquivos importam do config via acesso global (padrão GAS).

## Conteúdo completo de `src/config.js`

```javascript
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
```

## Como usar nos outros módulos

Os valores acima são globais em GAS. Referenciá-los diretamente:

```javascript
// Em qualquer outro arquivo src/:
const threads = GmailApp.search(`from:${REMETENTE_PREMIER} subject:${ASSUNTO_PREMIER}`);
```

## Parametrização da data-fim

`CONTRATO_FIM` é comparado como `new Date(CONTRATO_FIM)` em todas as funções
com consequência real (envio, alerta). Funções de setup e teste ignoram esta
verificação para permitir execução manual a qualquer momento.
