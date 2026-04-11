---
id: tooling-clasp
type: decision
title: "Uso de clasp para versionamento do Google Apps Script"
status: active
tags: [gas, clasp, arquitetura, github, versionamento]
depends_on: []
---

## Contexto

O projeto é uma automação pessoal que precisa acessar Gmail e Drive sem servidor
dedicado. A solução precisa ser gratuita, de baixa manutenção e versionável no
GitHub para compor um portfólio técnico.

## Decisão

Usar **Google Apps Script (GAS)** como runtime e **clasp** como ferramenta de
desenvolvimento local e versionamento.

## Justificativa

**GAS** resolve o problema sem custo ou infraestrutura:
- Acesso nativo a `GmailApp`, `DriveApp`, `UrlFetchApp` sem autenticação OAuth manual
- Triggers de tempo nativos (sem cron job externo)
- Roda na conta Google do usuário — zero custo, zero servidor

**clasp** resolve o problema de portfólio e manutenção:
- Permite editar os arquivos `.js` localmente com qualquer editor
- `clasp push` sincroniza com o GAS em segundos
- O código fica num repositório Git normal no GitHub
- `clasp logs` acessa os logs de execução pelo terminal

## Estrutura de arquivos resultante

O GAS não usa `import/export` — cada arquivo `.js` em `src/` é um módulo global
carregado pelo runtime. A ordem de carregamento é controlada pelo `appsscript.json`.

## Alternativas rejeitadas

- **Node.js + cron job**: precisaria de servidor ou serviço pago (Railway, Render)
- **Python + scheduler**: mesma razão; mais complexo para acessar Gmail
- **Editar direto no editor web do GAS**: sem versionamento, não serve para portfólio
