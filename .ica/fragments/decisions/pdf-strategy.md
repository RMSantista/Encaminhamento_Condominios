---
id: pdf-strategy
type: decision
title: "Estratégia de download do PDF do boleto"
status: active
tags: [pdf, premier, urlfetch, blob, gmail-parsing, ocr]
depends_on: []
---

## Contexto

O e-mail da Premier Garantidora contém um botão "Ver boleto atualizado". Ao
clicar, ele abre o PDF diretamente — não redireciona para um portal que exija
login. Isso foi confirmado pelo comportamento real do e-mail.

O boleto também pode chegar via WhatsApp como arquivo PDF, sendo depositado
manualmente em uma pasta do Drive.

## Fluxo por e-mail

```
msg.getBody()         → HTML bruto do e-mail
↓ regex no href       → URL do PDF (link direto)
↓ UrlFetchApp.fetch() → resposta HTTP com o binário
↓ .getBlob()          → Blob com mimeType application/pdf
↓ extrairDadosBoleto  → { mesRef, valorId, vencimento, valor } via OCR
↓ GmailApp.sendEmail  → enviado como attachment
```

## Regex de extração do link

O botão no HTML da Premier tem anchor text "Ver boleto atualizado":

```javascript
// Regex primária: busca pelo href seguido do texto âncora
const re = /href="(https?:\/\/[^"]+)"[^>]*>\s*(?:Visualizar Boleto|Ver boleto[^<]*)/i;
```

Fallback para `.pdf` no href se o texto âncora mudar:
```javascript
const reFallback = /href="(https?:\/\/[^"]+\.pdf[^"]*)"/i;
```

## Fluxo por pasta manual (WhatsApp)

```
DriveApp.getFolderById(PASTA_MANUAL_ID)
↓ getFilesByType(MimeType.PDF)
↓ arquivo.getBlob()
↓ extrairDadosBoleto  → { mesRef, valorId, vencimento, valor } via OCR
↓ GmailApp.sendEmail  → enviado como attachment
↓ arquivo.setTrashed(true)
```

## OCR

O PDF é processado pelo módulo `ocr.js` que usa a Drive API v2 (serviço
avançado `Drive_OCR`) para converter PDF → Google Doc temporário, ler o texto
e apagar o Doc. Veja `ocr-spec` para detalhes.

## Tratamento de falha

- **Link não encontrado no HTML**: `extrairLinkBoleto()` lança exceção com o
  motivo; execução abortada para o mês, nenhum label criado.
- **HTTP != 200**: `baixarPdf()` lança exceção com URL e código de resposta.
- **OCR falha**: `extrairDadosBoleto()` envia alerta por e-mail ao dono da
  conta, arquivo permanece na pasta para intervenção manual, lança exceção.

## Alternativa rejeitada

Salvar o PDF no Drive antes de enviar: desnecessário, aumenta complexidade e
cria arquivos que precisam ser gerenciados. O Blob em memória é suficiente
para o fluxo por e-mail.
