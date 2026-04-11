# Boleto Condomínio Automation

Automação em **Google Apps Script** que monitora o Gmail, detecta o boleto
mensal de condomínio enviado pela seguradora Premier e o repassa automaticamente
para a imobiliária Pirâmid Imóveis — com alerta caso o boleto não chegue até o dia 10.

## Funcionalidades

- Detecção automática do e-mail da Premier via filtro de remetente + assunto
- Download do PDF do boleto diretamente do link no e-mail
- Repasse para a imobiliária com assunto, corpo e competências corretas
- Controle de idempotência via Gmail labels (nunca envia duas vezes)
- Alerta de não-recebimento nos dias 8, 9 e 10 do mês
- Data-fim do contrato parametrizável (auto-desativa após o prazo)
- Modo DRY_RUN para testes sem envio real

## Stack

- Google Apps Script (runtime)
- clasp (desenvolvimento local e deploy)
- Gmail API / GAS nativa
- GitHub (versionamento)

## Arquitetura

O projeto usa Indexed Context Architecture (ICA) — cada decisão, especificação
e guia vive como fragmento atômico em `.ica/fragments/`, indexado em
`.ica/manifest.yaml`. O `CLAUDE.md` instrui o Claude Code a carregar apenas o
contexto relevante para cada tarefa.

## Setup

Veja `.ica/fragments/guides/setup-clasp.md` para instruções completas de instalação.

Pré-requisitos: Node.js >= 18, conta Google, clasp (`npm install -g @google/clasp`).

## Configuração

Edite `src/config.js` com os dados do seu contrato antes de fazer deploy.
Nenhuma string de negócio existe fora desse arquivo.

## Testes

Defina `DRY_RUN = true` em `config.js` e execute as funções manualmente no
editor do GAS. Veja `.ica/fragments/guides/testing.md` para o checklist completo.

## Licença

MIT
