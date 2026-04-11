---
id: setup-clasp
type: guide
title: "Setup do ambiente: clasp + Google Apps Script"
status: active
tags: [setup, clasp, node, instalação, primeiro-uso, scriptid]
depends_on: [tooling-clasp]
---

## Pré-requisitos

- Node.js ≥ 18 instalado (`node --version`)
- Conta Google com acesso ao Gmail
- Git instalado

## Passo 1 — Instalar clasp

```bash
npm install -g @google/clasp
clasp --version   # verificar instalação
```

## Passo 2 — Autenticar no Google

```bash
clasp login
```

Abrirá o navegador para autorização OAuth. Aceite as permissões.
Credenciais salvas em `~/.clasprc.json` (global, não versionado).

## Passo 3 — Criar o projeto no Apps Script

1. Acesse [script.google.com](https://script.google.com)
2. Clique em **Novo projeto**
3. Renomeie para `Encaminhamento_Condominios`
4. Copie o **Script ID** da URL: `https://script.google.com/d/{SCRIPT_ID}/edit`

## Passo 4 — Criar a estrutura local

```bash
mkdir Encaminhamento_Condominios
cd Encaminhamento_Condominios
git init
```

Criar o arquivo `.clasp.json` manualmente:
```json
{
  "scriptId": "SEU_SCRIPT_ID_AQUI",
  "rootDir": "./src"
}
```

Criar `src/appsscript.json`:
```json
{
  "timeZone": "America/Sao_Paulo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

## Passo 5 — Criar os arquivos fonte

Criar os arquivos em `src/` (vazios por enquanto):
```bash
touch src/config.js src/gmail.js src/pdf.js src/repasse.js src/alerta.js
```

## Passo 6 — Push inicial

```bash
clasp push
```

Confirmar com `Y` se perguntar sobre sobrescrever arquivos remotos.

## Passo 7 — Verificar no GAS

```bash
clasp open
```

Deve abrir o editor web com os arquivos `config`, `gmail`, `pdf`, `repasse`, `alerta`.

## Solução de problemas comuns

**Erro `scopes` no push:** adicione os `oauthScopes` no `appsscript.json` conforme Passo 4.

**Erro de autenticação expirada:** rode `clasp login` novamente.

**`clasp push` não aparece no GAS:** verifique se `rootDir` no `.clasp.json` aponta para `./src`.

**Ordem dos arquivos:** o GAS carrega em ordem alfabética por padrão.
`config.js` carrega antes de `gmail.js`, `pdf.js`, `repasse.js` e `alerta.js` — correto.
