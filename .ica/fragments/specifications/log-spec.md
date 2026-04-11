---
id: log-spec
type: specification
title: "Especificação do módulo de log — src/log.js"
status: active
tags: [log, planilha, sheets, auditoria, rastreabilidade]
depends_on: [config-spec]
---

## Responsabilidade

Registrar cada ação relevante em uma planilha Google Sheets criada
automaticamente na pasta do Drive (`PASTA_MANUAL_ID`). Erros de log nunca
interrompem o fluxo principal.

## Função pública

```javascript
registrarLog({ funcao, mesRef, valorId, arquivo, acao, origem, detalhes })
```

Todos os campos são opcionais exceto `acao`. Campos não fornecidos ficam em branco.

## Colunas da planilha

| Coluna | Exemplo |
|---|---|
| Timestamp | `2026-04-11 16:03:22` |
| Função | `repassarBoleto` |
| MesRef | `2026-04` |
| ValorId | `59372` |
| Arquivo | `boleto_abril.pdf` |
| Ação | `Enc` / `Reenc` / `Skip` / `ErrOCR` |
| Origem | `E` (email) / `P` (pasta) |
| Detalhes | `OK` / `Label já existe` / mensagem de erro |

## Valores possíveis de Ação

| Ação | Significado |
|---|---|
| `Enc` | Primeiro envio bem-sucedido |
| `Reenc` | Reenvio (label já existia) |
| `Skip` | Idempotência ativada — boleto já processado |
| `ErrOCR` | Falha na extração de dados do PDF |

## Criação automática da planilha

Na primeira execução, `registrarLog()` cria a planilha `LOG_PLANILHA_NOME`
na pasta `PASTA_MANUAL_ID` e persiste o ID em `PropertiesService`
(chave `'LOG_SPREADSHEET_ID'`). Execuções seguintes reutilizam o mesmo arquivo.

```javascript
// Busca ID salvo
let ssId = PropertiesService.getScriptProperties().getProperty('LOG_SPREADSHEET_ID');
if (!ssId || !_planilhaExiste(ssId)) {
  // Cria nova planilha e move para a pasta
  ...
  PropertiesService.getScriptProperties().setProperty('LOG_SPREADSHEET_ID', ssId);
}
```

## Comportamento em caso de erro

Qualquer falha dentro de `registrarLog()` é capturada e logada via
`Logger.log()` — nunca propaga para o chamador. O fluxo principal continua.
