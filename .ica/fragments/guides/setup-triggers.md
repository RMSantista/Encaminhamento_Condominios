---
id: setup-triggers
type: guide
title: "Configuração dos triggers no Google Apps Script"
status: active
tags: [triggers, agendamento, gas, setup, time-based]
depends_on: [repasse-spec, alerta-spec]
---

## Visão geral dos triggers

O projeto usa **5 triggers de tempo**, todos instalados via `installTriggers()`:

| # | Função | Horário | Frequência | Lógica interna |
|---|---|---|---|---|
| T1 | `repassarBoleto()` | 16h–17h | Diário | Loop de REPASSE_MES_INICIO até mês atual; guard de idempotência por label |
| T2 | `verificarPendencia()` | 12h–13h | Diário | Age apenas nos dias 8, 9 e 10; alerta só no dia 10 ao meio-dia |
| T3 | `verificarPastaManual()` | 8h–9h | Diário | Age apenas nos dias 10–13 |
| T4 | `verificarPastaManual()` | 12h–13h | Diário | Age apenas nos dias 10–13 |
| T5 | `verificarPastaManual()` | 16h–17h | Diário | Age apenas nos dias 10–13 |

A lógica de "quando agir" fica **no código**, não no trigger — isso garante que
o comportamento esteja versionado e que os triggers sejam simples de gerenciar.

## Instalar via código (recomendado)

Execute `installTriggers()` manualmente **uma única vez** no editor do GAS:

```javascript
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('repassarBoleto')
    .timeBased().everyDays(1).atHour(16).create();

  ScriptApp.newTrigger('verificarPendencia')
    .timeBased().everyDays(1).atHour(12).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(8).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(12).create();

  ScriptApp.newTrigger('verificarPastaManual')
    .timeBased().everyDays(1).atHour(16).create();

  Logger.log('Triggers instalados: 5');
}
```

Como executar:
1. `clasp push --force`
2. `clasp open`
3. No editor web: selecionar `installTriggers` no dropdown → clicar ▶️

## Verificar triggers ativos

```bash
clasp logs   # últimas execuções com timestamp
```

Ou no GAS: **Execuções** no menu lateral — lista todas as execuções com status e logs.

## Primeira autorização OAuth

Na primeira execução de qualquer função que use GmailApp ou DriveApp, o GAS
pedirá autorização OAuth. Isso acontece **apenas na execução manual**, não no trigger.

Sequência correta:
1. Execute `repassarBoleto` manualmente com `DRY_RUN = true`
2. Autorize as permissões na janela pop-up
3. Confirme que os logs apareceram
4. Mude `DRY_RUN = false` e troque `DESTINO_IMOBILIARIA` para o endereço real
5. `clasp push --force`
6. Execute `installTriggers`
