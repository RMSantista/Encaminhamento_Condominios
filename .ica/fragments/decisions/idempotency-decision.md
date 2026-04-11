---
id: idempotency-decision
type: decision
title: "Controle de idempotência via Gmail labels"
status: active
tags: [idempotencia, gmail-labels, estado, segurança, duplicatas]
depends_on: []
---

## Contexto

`repassarBoleto()` roda via trigger diário. Sem controle, enviaria o boleto
múltiplas vezes no mesmo mês. Precisamos de estado persistente e gratuito
que viva dentro do ecossistema Google.

## Decisão

Usar **Gmail labels** como mecanismo de estado. Um label com nome
`Condominio/Repassado-YYYY-MM` aplicado à thread da Premier sinaliza que o
repasse do mês já foi feito.

## Protocolo de verificação

```javascript
// ANTES de qualquer ação:
const labelNome = `${LABEL_BASE}-${mesRef}`;  // ex: "Condominio/Repassado-2026-04"
if (GmailApp.getUserLabelByName(labelNome)) {
  Logger.log(`Repasse de ${mesRef} já realizado. Abortando.`);
  return;
}

// APÓS envio bem-sucedido:
const label = GmailApp.getUserLabelByName(labelNome)
  || GmailApp.createLabel(labelNome);
label.addToThread(thread);
```

## Onde o label é criado

O label só é criado DEPOIS que `GmailApp.sendEmail()` executar sem lançar
exceção. Se o envio falhar, o label não é criado e a função tentará novamente
no próximo dia.

## Por que não usar PropertiesService

`PropertiesService` também funcionaria, mas o label tem vantagem:
é visível na caixa de entrada do Gmail, permitindo auditoria manual imediata
sem precisar abrir o editor do GAS.

## Nomenclatura dos labels

```
Condominio/                          ← grupo pai
  Repassado-2026-01
  Repassado-2026-02
  ...
  Repassado-2026-12
```

O Gmail cria automaticamente a hierarquia ao criar um label com `/` no nome.
