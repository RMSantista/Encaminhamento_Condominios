---
id: manual-spec
type: specification
title: "Especificação do fluxo manual — src/manual.js"
status: active
tags: [manual, drive, pasta, whatsapp, ocr, duplicata, reenvio]
depends_on: [config-spec, ocr-spec, idempotency-decision, email-spec]
---

## Responsabilidade

Processar boletos depositados manualmente na pasta do Drive (`PASTA_MANUAL_ID`).
Cobre o caso em que a Premier envia o boleto via WhatsApp em vez de e-mail.

## Quando executa

`verificarPastaManual()` roda via trigger 3× ao dia (8h, 12h, 16h), mas age
apenas nos dias definidos em `DIAS_VERIFICACAO_MANUAL` (padrão: 10, 11, 12, 13).

## Fluxo completo

```
verificarPastaManual()
│
├── 1. Guard: contrato expirado? → return
├── 2. Dia fora de DIAS_VERIFICACAO_MANUAL? → return (log)
├── 3. Listar PDFs em PASTA_MANUAL_ID
│       └── pasta vazia? → return (log)
├── 4. Para cada PDF → extrairDadosBoleto() via OCR
│       └── erro OCR → registrarLog(ErrOCR) + arquivo permanece na pasta
├── 5. Agrupar boletos por (mesRef + valorId)
├── 6. Ordenar grupos por vencimento (ascendente)
└── 7. Para cada grupo → _processarGrupo()

_processarGrupo(grupo)
│
├── 1. Determinar tipo: Enc (sem label) ou Reenc (label existe)
├── 2. Montar e-mail de repasse
├── 3. Enviar e-mail com PDF do representante do grupo
├── 4. Criar label flutuante (sem thread — boleto não veio de e-mail)
├── 5. Mover TODOS os arquivos do grupo para lixeira
└── 6. registrarLog()
```

## Tratamento de duplicatas

Arquivos com mesmo `(mesRef + valorId)` são considerados o **mesmo boleto**.
Apenas o primeiro é enviado; todos são movidos para a lixeira após o envio.

## Label flutuante

Como o boleto veio do Drive (não de um e-mail), o label é criado **sem**
associação a uma thread:

```javascript
GmailApp.createLabel(labelNome);  // sem .addToThread()
```

O label aparece em "Todos os labels" no Gmail e é detectado por `labelExiste()`
normalmente, garantindo idempotência cruzada com o fluxo de e-mail.

## Tipo Enc vs. Reenc

| Situação | Tipo no label |
|---|---|
| Nenhum label com o prefixo `Condomínio_{mesRef}-{valorId}` existe | `Enc` |
| Label existe (boleto já foi enviado via e-mail ou pasta antes) | `Reenc` |

## Onde ficam as funções auxiliares

| Função | Arquivo |
|---|---|
| `extrairDadosBoleto(blob, nome)` | `src/ocr.js` |
| `montarEmailRepasse(mesRef)` | `src/repasse.js` |
| `construirLabel/Prefixo/labelExiste` | `src/repasse.js` (escopo global) |
| `registrarLog(params)` | `src/log.js` |
