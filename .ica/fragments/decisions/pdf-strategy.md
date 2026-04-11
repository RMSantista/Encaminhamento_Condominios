---
id: pdf-strategy
type: decision
title: "Estratégia de download do PDF do boleto"
status: active
tags: [pdf, premier, urlfetch, blob, gmail-parsing]
depends_on: []
---

## Contexto

O e-mail da Premier Garantidora contém um botão "Visualizar Boleto". Ao clicar,
ele abre o PDF diretamente — não redireciona para um portal que exija login.
Isso foi confirmado pelo comportamento real do e-mail.

## Decisão

Extrair o `href` do botão via regex no HTML do e-mail e baixar o PDF com
`UrlFetchApp.fetch()`, gerando um `Blob` para anexar ao e-mail de repasse.

## Fluxo implementado

```
msg.getBody()         → HTML bruto do e-mail
↓ regex no href       → URL do PDF (link direto)
↓ UrlFetchApp.fetch() → resposta HTTP com o binário
↓ .getBlob()          → Blob com mimeType application/pdf
↓ GmailApp.sendEmail  → enviado como attachment
```

## Regex de extração

O botão no HTML da Premier tem a estrutura:
```html
<a href="https://...pdf..." ...>Visualizar Boleto</a>
```

Regex segura para extrair:
```javascript
const match = html.match(/href="(https?:\/\/[^"]+\.pdf[^"]*)"/i);
```

Se o link não terminar em `.pdf`, buscar pelo texto âncora:
```javascript
const match = html.match(/href="(https?:\/\/[^"]+)"[^>]*>\s*Visualizar Boleto/i);
```

## Tratamento de falha

Se `UrlFetchApp.fetch()` retornar código diferente de 200, lançar exceção
com a URL e o código de resposta — o Logger registra e o trigger não aplica
o label de "repassado", permitindo nova tentativa no dia seguinte.

## Alternativa rejeitada

Salvar o PDF no Drive antes de enviar: desnecessário, aumenta complexidade e
cria arquivos que precisam ser gerenciados. O Blob em memória é suficiente.
