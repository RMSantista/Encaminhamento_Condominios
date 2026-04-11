---
id: repasse-spec
type: specification
title: "Especificação de repassarBoleto() — src/repasse.js"
status: active
tags: [repasse, gmail, pdf, trigger, logica-principal, orchestration]
depends_on: [config-spec, pdf-strategy, idempotency-decision, email-spec]
---

## Responsabilidade

Orquestrar o fluxo completo de repasse: detectar → verificar → baixar → enviar → marcar.
Este arquivo chama funções de `gmail.js` e `pdf.js`; não implementa I/O diretamente.

## Fluxo completo

```
repassarBoleto()
│
├── 1. Guard: contrato expirado? → return (log)
├── 2. Guard: já repassado este mês (label)? → return (log)
├── 3. Buscar thread da Premier no mês corrente
│       └── não encontrou? → return (log "boleto não chegou ainda")
├── 4. Extrair link do PDF do e-mail       [gmail.js]
│       └── falhou regex? → throw erro
├── 5. Baixar PDF como Blob                [pdf.js]
│       └── HTTP != 200? → throw erro
├── 6. Montar corpo do e-mail              [email-spec]
├── 7. Enviar e-mail (ou DRY_RUN log)
└── 8. Aplicar label de controle           [idempotency-decision]
```

## Implementação de `src/repasse.js`

```javascript
function repassarBoleto() {
  // Guard 1: contrato
  if (new Date() > new Date(CONTRATO_FIM)) {
    Logger.log('Contrato encerrado. repassarBoleto() abortado.');
    return;
  }

  const hoje    = new Date();
  const mesRef  = Utilities.formatDate(hoje, TIMEZONE, 'yyyy-MM');
  const labelNome = `${LABEL_BASE}-${mesRef}`;

  // Guard 2: idempotência
  if (GmailApp.getUserLabelByName(labelNome)) {
    Logger.log(`Boleto de ${mesRef} já repassado. Nenhuma ação.`);
    return;
  }

  // Busca
  const threads = buscarBoletoPremer(mesRef);   // gmail.js
  if (!threads.length) {
    Logger.log(`Boleto da Premier de ${mesRef} não encontrado ainda.`);
    return;
  }

  const thread = threads[0];
  const html   = thread.getMessages().pop().getBody();

  // PDF
  const linkPdf = extrairLinkBoleto(html);      // gmail.js
  const pdfBlob = baixarPdf(linkPdf);           // pdf.js

  // E-mail
  const { assunto, corpo } = montarEmailRepasse(mesRef);  // repasse.js (local)

  if (DRY_RUN) {
    Logger.log(`[DRY_RUN] Enviaria para ${DESTINO_IMOBILIARIA}: "${assunto}"`);
    Logger.log(`[DRY_RUN] Corpo: ${corpo}`);
  } else {
    GmailApp.sendEmail(DESTINO_IMOBILIARIA, assunto, corpo, {
      attachments: [pdfBlob],
      name: 'Automação Condomínio'
    });
    Logger.log(`Boleto de ${mesRef} repassado com sucesso para ${DESTINO_IMOBILIARIA}`);

    // Aplica label apenas após envio confirmado
    const label = GmailApp.getUserLabelByName(labelNome)
      || GmailApp.createLabel(labelNome);
    label.addToThread(thread);
  }
}

function montarEmailRepasse(mesRef) {
  const [ano, mes]    = mesRef.split('-').map(Number);
  const proxMes       = mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const nomeMes       = nomeMesPortugues(mes);
  const nomeProxMes   = nomeMesPortugues(mes === 12 ? 1 : mes + 1);
  const anoProxMes    = mes === 12 ? ano + 1 : ano;

  const corpo = `A/C Mariana - Setor de Proprietários.

Segue boleto de condomínio com valor correto, referente à competência de ${nomeMes}/${ano}, para ser lançado no aluguel de ${nomeProxMes}/${anoProxMes}.

Atenciosamente.`;

  return { assunto: ASSUNTO_REPASSE, corpo };
}

function nomeMesPortugues(mes) {
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return nomes[mes - 1];
}
```

## Onde ficam as funções auxiliares

| Função | Arquivo |
|---|---|
| `buscarBoletoPremer(mesRef)` | `src/gmail.js` |
| `extrairLinkBoleto(html)` | `src/gmail.js` |
| `baixarPdf(url)` | `src/pdf.js` |
| `montarEmailRepasse(mesRef)` | `src/repasse.js` (local) |
