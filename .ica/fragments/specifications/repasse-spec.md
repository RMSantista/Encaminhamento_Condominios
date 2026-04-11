---
id: repasse-spec
type: specification
title: "Especificação de repassarBoleto() — src/repasse.js"
status: active
tags: [repasse, gmail, pdf, trigger, logica-principal, orchestration, loop, ocr]
depends_on: [config-spec, pdf-strategy, idempotency-decision, email-spec]
---

## Responsabilidade

Orquestrar o repasse mensal: iterar de `REPASSE_MES_INICIO` até o mês atual,
detectar meses ainda não processados e, para cada um, baixar o PDF via e-mail,
extrair dados via OCR, enviar para a imobiliária e registrar o label de controle.

Este arquivo chama funções de `gmail.js`, `pdf.js`, `ocr.js` e `log.js`;
não implementa I/O diretamente.

## Fluxo completo

```
repassarBoleto()
│
├── 1. Guard: contrato expirado? → return
├── 2. Gerar lista de meses [REPASSE_MES_INICIO … mês atual]
├── 3. Filtrar meses sem label → mesesPendentes
│       └── nenhum pendente? → return ("todos processados")
└── 4. Para cada mes em mesesPendentes → _repassarMes(mes)

_repassarMes(mesRef)
│
├── 1. Buscar thread da Premier no Gmail para o mês
│       └── não encontrou? → return ("não chegou ainda")
├── 2. Extrair link do PDF do HTML do e-mail         [gmail.js]
├── 3. Baixar PDF como Blob                          [pdf.js]
├── 4. Extrair dados via OCR                         [ocr.js]
│       └── erro OCR? → registrarLog(ErrOCR) + return
├── 5. Guard idempotência por valorId (prefixo completo)
│       └── label existe? → registrarLog(Skip) + return
├── 6. Montar corpo do e-mail                        [email-spec]
├── 7. Enviar e-mail (ou DRY_RUN log)
└── 8. Criar label + registrarLog(Enc)               [idempotency-decision]
```

## Dados extraídos pelo OCR

O OCR retorna `{ mesRef, valorId, vencimento, valor }` onde:
- `mesRef` — `'YYYY-MM'` derivado da data de vencimento (ex: `'2026-04'`)
- `valorId` — valor sem separadores, usado como ID único (ex: `'59372'`)
- `vencimento` — `'DD/MM/AAAA'`
- `valor` — formato original (ex: `'593,72'`)

## Helpers de label (escopo global GAS)

Declarados em `repasse.js`, usados também por `manual.js` e `alerta.js`:

```javascript
// Nome completo: Condomínio_2026-04-59372_Enc_em_2026-04-10_E
construirLabel(mesRef, valorId, tipo, origem)

// Prefixo de busca (cobre E e P do mesmo boleto)
construirPrefixo(mesRef, valorId)  // → "Condomínio_2026-04-59372"

// Verifica se existe qualquer label com o prefixo dado
labelExiste(prefixo)               // → boolean
```

## Helpers internos

```javascript
// Gera ['2026-02', '2026-03', '2026-04'] dado início e fim
_gerarListaMeses(inicio, fim)

// Lógica de um único mês (extraída para reuso e clareza)
_repassarMes(mesRef)
```

## Onde ficam as funções auxiliares

| Função | Arquivo |
|---|---|
| `buscarBoletoPremer(mesRef)` | `src/gmail.js` |
| `extrairLinkBoleto(html)` | `src/gmail.js` |
| `baixarPdf(url)` | `src/pdf.js` |
| `extrairDadosBoleto(pdfBlob, nome)` | `src/ocr.js` |
| `registrarLog(params)` | `src/log.js` |
| `montarEmailRepasse(mesRef)` | `src/repasse.js` (local) |
| `nomeMesPortugues(mes)` | `src/repasse.js` (local) |
