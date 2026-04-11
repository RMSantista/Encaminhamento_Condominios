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
// ── Contrato ────────────────────────────────────────────────────
const CONTRATO_FIM = '2027-12-31';   // formato YYYY-MM-DD

// ── Premier Garantidora (remetente) ─────────────────────────────
const REMETENTE_PREMIER = 'boleto@premiergarantidora.com.br';
const ASSUNTO_PREMIER   = 'CONDOMINIO RESIDENCIAL VIDA PLENA vencerá';

// ── Pirâmid Imóveis (destinatário) ──────────────────────────────
const DESTINO_IMOBILIARIA = 'administrativo@piramidimoveis.com.br';  // produção
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

// ── Repasse via e-mail (Premier → Imobiliária) ──────────────────
const REPASSE_MES_INICIO = '2026-02'; // Primeiro mês a verificar no trigger de repasse

// ── Fluxo manual (boleto via WhatsApp → pasta Drive) ────────────
const PASTA_MANUAL_ID         = '1-LITJk2RHnlXPwrMy_XwhsLFzTZjqVRu';
const DIAS_VERIFICACAO_MANUAL = [10, 11, 12, 13];

// ── Log ──────────────────────────────────────────────────────────
const LOG_PLANILHA_NOME = 'Log_Condominio_Automacao';
```

## Descrição das constantes

| Constante | Descrição |
|---|---|
| `CONTRATO_FIM` | Data de encerramento do contrato; todas as funções abortam silenciosamente após essa data |
| `REMETENTE_PREMIER` | E-mail da Premier usado na busca no Gmail |
| `ASSUNTO_PREMIER` | Trecho do assunto para busca parcial no Gmail |
| `DESTINO_IMOBILIARIA` | Destinatário do e-mail de repasse; trocar para endereço de teste durante homologação |
| `ASSUNTO_REPASSE` | Assunto fixo do e-mail enviado à imobiliária |
| `LABEL_PREFIXO` | Prefixo dos Gmail labels de controle de idempotência |
| `DRY_RUN` | `true` = simula sem enviar e-mail nem criar labels |
| `DIAS_VERIFICACAO` | Dias do mês em que `verificarPendencia()` é executada |
| `DIA_ALERTA` | Dia a partir do qual o alerta de não-recebimento é disparado (ao meio-dia) |
| `REPASSE_MES_INICIO` | Primeiro mês que `repassarBoleto()` considera no loop; ajustar ao reiniciar ciclo |
| `PASTA_MANUAL_ID` | ID da pasta no Drive onde boletos enviados via WhatsApp são depositados |
| `DIAS_VERIFICACAO_MANUAL` | Dias do mês em que `verificarPastaManual()` age |
| `LOG_PLANILHA_NOME` | Nome da planilha de log criada automaticamente na pasta manual |

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
