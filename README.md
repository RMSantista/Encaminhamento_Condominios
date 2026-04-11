# Encaminhamento_Condominios

Automação em **Google Apps Script** que monitora Gmail e Drive, detecta o boleto
mensal de condomínio enviado pela Premier Garantidora, extrai os dados via OCR
e repassa automaticamente para a Pirâmid Imóveis — com log em Sheets e alerta
caso o boleto não chegue até o dia 10.

## Funcionalidades

- Detecção automática do e-mail da Premier via filtro de remetente + assunto
- Download do PDF do boleto diretamente do link no e-mail
- Extração de dados (vencimento, valor, mês de referência) via OCR — Drive API v2
- Repasse para a imobiliária com assunto, corpo e competências corretas
- Controle de idempotência via Gmail labels com valorId (nunca envia duas vezes)
- Fluxo manual: boletos via WhatsApp depositados em pasta do Drive são processados automaticamente
- Tratamento de duplicatas e reenvio (Enc/Reenc) no fluxo manual
- Alerta de não-recebimento ao meio-dia do dia 10 se o boleto não tiver chegado
- Log de todas as ações em planilha Google Sheets criada automaticamente
- Data-fim do contrato parametrizável (auto-desativa após o prazo)
- Modo DRY_RUN para testes sem envio real

## Stack

- Google Apps Script (runtime)
- clasp (desenvolvimento local e deploy)
- Drive API v2 — OCR de PDFs
- Gmail API / GAS nativa
- Google Sheets — log de execuções
- GitHub (versionamento)

## Arquitetura

```
src/
├── config.js     ← todas as constantes de negócio (nunca hardcode)
├── gmail.js      ← busca e parsing do e-mail da Premier
├── pdf.js        ← download do PDF como Blob
├── ocr.js        ← extração de dados do PDF via Drive API OCR
├── repasse.js    ← orquestração do fluxo por e-mail + helpers de label
├── manual.js     ← fluxo manual: pasta Drive → OCR → envio
├── log.js        ← registro em Google Sheets
└── alerta.js     ← alerta de não-recebimento (dia 10 ao meio-dia)
```

O projeto usa **Indexed Context Architecture (ICA)** — cada decisão, especificação
e guia vive como fragmento atômico em `.ica/fragments/`, indexado em
`.ica/manifest.yaml`. O `CLAUDE.md` instrui o Claude Code a carregar apenas o
contexto relevante para cada tarefa.

## Triggers

| Função | Horário | Comportamento |
|---|---|---|
| `repassarBoleto()` | 16h diário | Loop de `REPASSE_MES_INICIO` até mês atual; processa meses sem label |
| `verificarPendencia()` | 12h diário | Age dias 8–10; alerta só ao meio-dia do dia 10 |
| `verificarPastaManual()` | 8h, 12h, 16h diário | Age dias 10–13; processa PDFs da pasta manual |

## Setup

Veja `.ica/fragments/guides/setup-clasp.md` para instruções completas.

Pré-requisitos: Node.js >= 18, conta Google, clasp (`npm install -g @google/clasp`).
Serviço avançado obrigatório: **Drive API v2** com identificador `Drive_OCR` no projeto GAS.

## Configuração

Edite `src/config.js` com os dados do seu contrato antes de fazer deploy.
Nenhuma string de negócio existe fora desse arquivo.

## Testes

Defina `DRY_RUN = true` em `config.js` para simular sem envio real.
Para testes de ponta a ponta, aponte `DESTINO_IMOBILIARIA` para um endereço controlado.
Veja `.ica/fragments/guides/testing.md` para o checklist completo.

## Licença

MIT
