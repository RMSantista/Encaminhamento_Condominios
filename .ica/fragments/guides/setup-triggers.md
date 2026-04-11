---
id: setup-triggers
type: guide
title: "Configuração dos triggers no Google Apps Script"
status: active
tags: [triggers, agendamento, gas, setup, time-based]
depends_on: [repasse-spec, alerta-spec]
---

## Visão geral

Dois triggers de tempo são necessários:

| Trigger | Função | Frequência | Lógica interna |
|---|---|---|---|
| T1 | `repassarBoleto()` | Diário | Guarda de idempotência via label |
| T2 | `verificarPendencia()` | Diário | Age apenas nos dias 8, 9 e 10 |

Ambos rodam diariamente; a lógica de "quando agir" fica no código, não no trigger.
Isso simplifica o gerenciamento e garante que o comportamento esteja versionado.

## Opção A — Instalar via código (recomendado)

Adicione esta função em `src/repasse.js` e execute manualmente **uma única vez**
no editor do GAS:

```javascript
function installTriggers() {
  // Remove triggers existentes para evitar duplicatas
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Trigger diário para repasse (janela: 6h–7h da manhã)
  ScriptApp.newTrigger('repassarBoleto')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  // Trigger diário para alerta (janela: 8h–9h da manhã)
  ScriptApp.newTrigger('verificarPendencia')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('Triggers instalados com sucesso.');
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(`  - ${t.getHandlerFunction()} (${t.getTriggerSource()})`);
  });
}
```

Como executar:
1. `clasp push`
2. `clasp open`
3. No editor web: selecionar `installTriggers` no dropdown → clicar ▶️

## Opção B — Instalar pela UI do GAS

1. `clasp open`
2. Menu lateral: **Triggers** (ícone de relógio)
3. Botão **+ Adicionar trigger** (canto inferior direito)
4. Configurar:
   - Função: `repassarBoleto`
   - Implantação: Head
   - Origem do evento: Com base no tempo
   - Tipo: Temporizador por dia
   - Hora: 6h–7h
5. Repetir para `verificarPendencia` (hora: 8h–9h)

## Verificar triggers ativos

```bash
clasp logs   # mostra últimas execuções com timestamp
```

Ou no GAS: **Execuções** no menu lateral — lista todas as execuções com status e logs.

## Primeira autorização

Na primeira execução de qualquer função que use GmailApp, o GAS pedirá
autorização OAuth. Isso acontece **apenas na execução manual**, não no trigger.

Sequência correta:
1. Execute `repassarBoleto` manualmente uma vez (`DRY_RUN = true`)
2. Autorize as permissões na janela pop-up
3. Confirme que os logs apareceram corretamente
4. Mude `DRY_RUN = false` em config.js
5. `clasp push`
6. Execute `installTriggers`

A partir daqui os triggers rodam automaticamente.
